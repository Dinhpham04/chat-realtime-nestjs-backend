import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import {
    RedisChunkSession,
    ChunkUploadProgress,
    IRedisChunkSessionService
} from '../../shared/interfaces/redis-services.interface';

/**
 * Redis-based chunk upload session service
 * Fast session management for chunk uploads with auto-cleanup
 */
@Injectable()
export class RedisChunkSessionService implements IRedisChunkSessionService {
    private readonly SESSION_TTL = 24 * 60 * 60; // 24 hours
    private readonly PROGRESS_TTL = 60 * 60; // 1 hour for progress tracking

    constructor(
        @Inject('IOREDIS_CLIENT')
        private readonly redis: Redis
    ) { }

    /**
     * Create new chunk upload session
     */
    async createSession(sessionData: Partial<RedisChunkSession>): Promise<RedisChunkSession> {
        const session: RedisChunkSession = {
            uploadId: sessionData.uploadId!,
            fileName: sessionData.fileName!,
            totalSize: sessionData.totalSize!,
            mimeType: sessionData.mimeType!,
            chunkSize: sessionData.chunkSize!,
            totalChunks: sessionData.totalChunks!,
            uploadedChunks: [],
            failedChunks: [],
            status: 'pending',
            uploadedBy: sessionData.uploadedBy!,
            createdAt: new Date(),
            updatedAt: new Date(),
            expiresAt: new Date(Date.now() + this.SESSION_TTL * 1000)
        };

        const key = `chunk_session:${session.uploadId}`;

        // Store session data
        await this.redis.hset(key, {
            uploadId: session.uploadId,
            fileName: session.fileName,
            totalSize: session.totalSize.toString(),
            mimeType: session.mimeType,
            chunkSize: session.chunkSize.toString(),
            totalChunks: session.totalChunks.toString(),
            status: session.status,
            uploadedBy: session.uploadedBy,
            createdAt: session.createdAt.toISOString(),
            updatedAt: session.updatedAt.toISOString(),
            expiresAt: session.expiresAt.toISOString()
        });

        // Set TTL
        await this.redis.expire(key, this.SESSION_TTL);

        // Initialize progress tracking
        await this.initializeProgress(session.uploadId, session.totalChunks);

        return session;
    }

    /**
     * Get session by upload ID
     */
    async getSession(uploadId: string): Promise<RedisChunkSession | null> {
        const key = `chunk_session:${uploadId}`;
        const data = await this.redis.hgetall(key);

        if (!data.uploadId) {
            return null;
        }

        // Get uploaded and failed chunks
        const uploadedChunks = await this.getUploadedChunks(uploadId);
        const failedChunks = await this.getFailedChunks(uploadId);

        return {
            uploadId: data.uploadId,
            fileName: data.fileName,
            totalSize: parseInt(data.totalSize),
            mimeType: data.mimeType,
            chunkSize: parseInt(data.chunkSize),
            totalChunks: parseInt(data.totalChunks),
            uploadedChunks,
            failedChunks,
            status: data.status as any,
            uploadedBy: data.uploadedBy,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
            expiresAt: new Date(data.expiresAt)
        };
    }

    /**
     * Mark chunk as completed
     */
    async markChunkCompleted(uploadId: string, chunkNumber: number): Promise<void> {
        const pipeline = this.redis.pipeline();

        // Add to uploaded chunks set
        pipeline.sadd(`chunk_uploaded:${uploadId}`, chunkNumber.toString());

        // Remove from failed chunks if exists
        pipeline.srem(`chunk_failed:${uploadId}`, chunkNumber.toString());

        // Update session status and timestamp
        pipeline.hset(`chunk_session:${uploadId}`, {
            status: 'uploading',
            updatedAt: new Date().toISOString()
        });

        // Update progress
        const totalChunks = await this.getTotalChunks(uploadId);
        const completedCount = await this.getUploadedChunksCount(uploadId) + 1;

        pipeline.hset(`chunk_progress:${uploadId}`, {
            completedChunks: completedCount.toString(),
            percentage: Math.round((completedCount / totalChunks) * 100).toString(),
            lastUpdated: new Date().toISOString()
        });

        await pipeline.exec();
    }

    /**
     * Mark chunk as failed
     */
    async markChunkFailed(uploadId: string, chunkNumber: number): Promise<void> {
        const pipeline = this.redis.pipeline();

        // Add to failed chunks set
        pipeline.sadd(`chunk_failed:${uploadId}`, chunkNumber.toString());

        // Remove from uploaded chunks if exists
        pipeline.srem(`chunk_uploaded:${uploadId}`, chunkNumber.toString());

        // Update timestamp
        pipeline.hset(`chunk_session:${uploadId}`, {
            updatedAt: new Date().toISOString()
        });

        await pipeline.exec();
    }

    /**
     * Get upload progress
     */
    async getProgress(uploadId: string): Promise<ChunkUploadProgress> {
        const progressData = await this.redis.hgetall(`chunk_progress:${uploadId}`);
        const failedChunks = await this.getFailedChunks(uploadId);

        const totalChunks = parseInt(progressData.totalChunks) || 0;
        const completedChunks = parseInt(progressData.completedChunks) || 0;
        const percentage = parseInt(progressData.percentage) || 0;
        const isComplete = completedChunks === totalChunks && totalChunks > 0;

        return {
            uploadId,
            totalChunks,
            completedChunks,
            failedChunks, // Now returns array as expected
            percentage,
            isComplete
        };
    }    /**
     * Update session status
     */
    async updateStatus(uploadId: string, status: RedisChunkSession['status']): Promise<void> {
        await this.redis.hset(`chunk_session:${uploadId}`, {
            status,
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Delete session and cleanup
     */
    async deleteSession(uploadId: string): Promise<void> {
        const pipeline = this.redis.pipeline();

        pipeline.del(`chunk_session:${uploadId}`);
        pipeline.del(`chunk_uploaded:${uploadId}`);
        pipeline.del(`chunk_failed:${uploadId}`);
        pipeline.del(`chunk_progress:${uploadId}`);

        await pipeline.exec();
    }

    /**
     * Get sessions by user ID
     */
    async getSessionsByUser(userId: string): Promise<RedisChunkSession[]> {
        // Search for sessions by user (this is less efficient in Redis)
        // Consider using a separate index for this
        const keys = await this.redis.keys('chunk_session:*');
        const sessions: RedisChunkSession[] = [];

        for (const key of keys) {
            const session = await this.getSession(key.replace('chunk_session:', ''));
            if (session && session.uploadedBy === userId) {
                sessions.push(session);
            }
        }

        return sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    /**
     * Cleanup expired sessions
     */
    async cleanupExpiredSessions(): Promise<number> {
        const keys = await this.redis.keys('chunk_session:*');
        let cleaned = 0;

        for (const key of keys) {
            const ttl = await this.redis.ttl(key);
            if (ttl === -1) { // No TTL set, check expiration manually
                const data = await this.redis.hget(key, 'expiresAt');
                if (data && new Date(data) < new Date()) {
                    const uploadId = key.replace('chunk_session:', '');
                    await this.deleteSession(uploadId);
                    cleaned++;
                }
            }
        }

        return cleaned;
    }

    // Private helper methods
    private async initializeProgress(uploadId: string, totalChunks: number): Promise<void> {
        await this.redis.hset(`chunk_progress:${uploadId}`, {
            totalChunks: totalChunks.toString(),
            completedChunks: '0',
            percentage: '0',
            lastUpdated: new Date().toISOString()
        });

        await this.redis.expire(`chunk_progress:${uploadId}`, this.PROGRESS_TTL);
    }

    private async getUploadedChunks(uploadId: string): Promise<number[]> {
        const chunks = await this.redis.smembers(`chunk_uploaded:${uploadId}`);
        return chunks.map(chunk => parseInt(chunk)).sort((a, b) => a - b);
    }

    private async getFailedChunks(uploadId: string): Promise<number[]> {
        const chunks = await this.redis.smembers(`chunk_failed:${uploadId}`);
        return chunks.map(chunk => parseInt(chunk)).sort((a, b) => a - b);
    }

    private async getUploadedChunksCount(uploadId: string): Promise<number> {
        return await this.redis.scard(`chunk_uploaded:${uploadId}`);
    }

    private async getFailedChunksCount(uploadId: string): Promise<number> {
        return await this.redis.scard(`chunk_failed:${uploadId}`);
    }

    private async getTotalChunks(uploadId: string): Promise<number> {
        const data = await this.redis.hget(`chunk_session:${uploadId}`, 'totalChunks');
        return parseInt(data || '0') || 0;
    }
}
