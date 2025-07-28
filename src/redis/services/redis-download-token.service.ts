import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import {
    DownloadToken,
    FileDownloadStats,
    IRedisDownloadTokenService
} from '../../shared/interfaces/redis-services.interface';

export interface DownloadTokenOptions {
    expiresIn?: number;
    permissions?: ('read' | 'download')[];
    maxDownloads?: number;
    ipAddress?: string;
}

/**
 * Redis-based download token service
 * Secure file access with granular permissions and tracking
 */
@Injectable()
export class RedisDownloadTokenService implements IRedisDownloadTokenService {
    private readonly DEFAULT_EXPIRY = 60 * 60; // 1 hour
    private readonly SECRET_KEY: string;

    constructor(
        @Inject('IOREDIS_CLIENT')
        private readonly redis: Redis
    ) {
        this.SECRET_KEY = process.env.DOWNLOAD_TOKEN_SECRET || 'your-secret-key';
    }

    /**
     * Generate secure download token
     */
    async generateToken(
        fileId: string,
        userId: string,
        options: DownloadTokenOptions = {}
    ): Promise<string> {
        const {
            expiresIn = this.DEFAULT_EXPIRY,
            permissions = ['read', 'download'],
            maxDownloads,
            ipAddress
        } = options;

        // Generate cryptographically secure token
        const tokenId = crypto.randomBytes(32).toString('hex');

        const tokenData: DownloadToken = {
            fileId,
            userId,
            permissions,
            expiresAt: new Date(Date.now() + expiresIn * 1000),
            downloadCount: 0,
            maxDownloads,
            ipAddress
        };

        // Store in Redis with TTL
        await this.redis.setex(
            `download_token:${tokenId}`,
            expiresIn,
            JSON.stringify(tokenData)
        );

        // Track token by user for management
        await this.redis.sadd(`user_tokens:${userId}`, tokenId);
        await this.redis.expire(`user_tokens:${userId}`, 24 * 60 * 60); // 24 hours

        return tokenId;
    }

    /**
     * Validate and retrieve token data
     */
    async validateToken(
        tokenId: string,
        requiredPermission: 'read' | 'download' = 'read',
        clientIp?: string
    ): Promise<DownloadToken> {
        const data = await this.redis.get(`download_token:${tokenId}`);

        if (!data) {
            throw new UnauthorizedException('Invalid or expired download token');
        }

        const token: DownloadToken = JSON.parse(data);

        // Check expiration
        if (new Date() > token.expiresAt) {
            await this.redis.del(`download_token:${tokenId}`);
            throw new UnauthorizedException('Download token has expired');
        }

        // Check permissions
        if (!token.permissions.includes(requiredPermission)) {
            throw new UnauthorizedException(`Token does not have ${requiredPermission} permission`);
        }

        // Check IP restriction if set
        if (token.ipAddress && clientIp && token.ipAddress !== clientIp) {
            throw new UnauthorizedException('Token is restricted to a different IP address');
        }

        // Check download limits
        if (token.maxDownloads && (token.downloadCount || 0) >= token.maxDownloads) {
            throw new UnauthorizedException('Download limit exceeded for this token');
        }

        return token;
    }

    /**
     * Track download usage
     */
    async trackDownload(tokenId: string): Promise<void> {
        const data = await this.redis.get(`download_token:${tokenId}`);

        if (data) {
            const token: DownloadToken = JSON.parse(data);
            token.downloadCount = (token.downloadCount || 0) + 1;

            // Update token with new download count
            const ttl = await this.redis.ttl(`download_token:${tokenId}`);
            if (ttl > 0) {
                await this.redis.setex(
                    `download_token:${tokenId}`,
                    ttl,
                    JSON.stringify(token)
                );
            }

            // Track download event
            await this.logDownloadEvent(tokenId, token);
        }
    }

    /**
     * Revoke token before expiration
     */
    async revokeToken(tokenId: string, userId?: string): Promise<void> {
        // Verify ownership if userId provided
        if (userId) {
            const data = await this.redis.get(`download_token:${tokenId}`);
            if (data) {
                const token: DownloadToken = JSON.parse(data);
                if (token.userId !== userId) {
                    throw new UnauthorizedException('Cannot revoke token owned by another user');
                }
            }
        }

        await this.redis.del(`download_token:${tokenId}`);

        if (userId) {
            await this.redis.srem(`user_tokens:${userId}`, tokenId);
        }
    }

    /**
     * Get user's active tokens
     */
    async getUserTokens(userId: string): Promise<Array<{ tokenId: string; token: DownloadToken }>> {
        const tokenIds = await this.redis.smembers(`user_tokens:${userId}`);
        const tokens: Array<{ tokenId: string; token: DownloadToken }> = [];

        for (const tokenId of tokenIds) {
            const data = await this.redis.get(`download_token:${tokenId}`);
            if (data) {
                const token: DownloadToken = JSON.parse(data);
                tokens.push({ tokenId, token });
            } else {
                // Clean up expired token reference
                await this.redis.srem(`user_tokens:${userId}`, tokenId);
            }
        }

        return tokens.sort((a, b) => b.token.expiresAt.getTime() - a.token.expiresAt.getTime());
    }

    /**
     * Revoke all tokens for a user
     */
    async revokeAllUserTokens(userId: string): Promise<number> {
        const tokenIds = await this.redis.smembers(`user_tokens:${userId}`);
        let revokedCount = 0;

        if (tokenIds.length > 0) {
            const pipeline = this.redis.pipeline();

            tokenIds.forEach(tokenId => {
                pipeline.del(`download_token:${tokenId}`);
            });

            pipeline.del(`user_tokens:${userId}`);

            await pipeline.exec();
            revokedCount = tokenIds.length;
        }

        return revokedCount;
    }

    /**
     * Create one-time download token
     */
    async generateOneTimeToken(
        fileId: string,
        userId: string,
        expiresIn: number = 300 // 5 minutes default
    ): Promise<string> {
        return this.generateToken(fileId, userId, {
            expiresIn,
            maxDownloads: 1,
            permissions: ['download']
        });
    }

    /**
     * Create read-only token (for previews)
     */
    async generatePreviewToken(
        fileId: string,
        userId: string,
        expiresIn: number = 900 // 15 minutes default
    ): Promise<string> {
        return this.generateToken(fileId, userId, {
            expiresIn,
            permissions: ['read']
        });
    }

    /**
     * Get download statistics for a file
     */
    async getFileDownloadStats(fileId: string): Promise<{
        totalDownloads: number;
        uniqueUsers: number;
        recentDownloads: Array<{ timestamp: Date; userId: string; tokenId: string }>;
    }> {
        const events = await this.redis.lrange(`download_events:${fileId}`, 0, -1);
        const downloadEvents = events.map(event => JSON.parse(event));

        const uniqueUsers = new Set(downloadEvents.map(event => event.userId)).size;
        const recentDownloads = downloadEvents
            .slice(-10) // Last 10 downloads
            .map(event => ({
                timestamp: new Date(event.timestamp),
                userId: event.userId,
                tokenId: event.tokenId
            }));

        return {
            totalDownloads: downloadEvents.length,
            uniqueUsers,
            recentDownloads
        };
    }

    // Private helper methods
    private async logDownloadEvent(tokenId: string, token: DownloadToken): Promise<void> {
        const event = {
            timestamp: new Date().toISOString(),
            tokenId,
            userId: token.userId,
            fileId: token.fileId
        };

        // Log to file-specific download events (keep last 100)
        await this.redis.lpush(`download_events:${token.fileId}`, JSON.stringify(event));
        await this.redis.ltrim(`download_events:${token.fileId}`, 0, 99);
        await this.redis.expire(`download_events:${token.fileId}`, 30 * 24 * 60 * 60); // 30 days

        // Log to user-specific download events (keep last 50)
        await this.redis.lpush(`user_downloads:${token.userId}`, JSON.stringify(event));
        await this.redis.ltrim(`user_downloads:${token.userId}`, 0, 49);
        await this.redis.expire(`user_downloads:${token.userId}`, 7 * 24 * 60 * 60); // 7 days
    }
}
