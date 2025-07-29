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
     * Create new chunk upload session with enhanced validation
     */
    async createSession(sessionData: Partial<RedisChunkSession>): Promise<RedisChunkSession> {
        // Enhanced validation
        if (!sessionData.uploadId?.trim()) {
            throw new Error('Upload ID is required and cannot be empty');
        }
        if (!sessionData.fileName?.trim()) {
            throw new Error('File name is required and cannot be empty');
        }
        if (!sessionData.totalSize || sessionData.totalSize <= 0) {
            throw new Error('Total size must be greater than 0');
        }
        if (!sessionData.mimeType?.trim()) {
            throw new Error('MIME type is required and cannot be empty');
        }
        if (!sessionData.chunkSize || sessionData.chunkSize <= 0) {
            throw new Error('Chunk size must be greater than 0');
        }
        if (!sessionData.totalChunks || sessionData.totalChunks <= 0) {
            throw new Error('Total chunks must be greater than 0');
        }
        if (!sessionData.uploadedBy?.trim()) {
            throw new Error('Uploaded by user ID is required and cannot be empty');
        }

        // Validate chunk size calculation
        const expectedChunks = Math.ceil(sessionData.totalSize / sessionData.chunkSize);
        if (Math.abs(sessionData.totalChunks - expectedChunks) > 1) {
            throw new Error(`Invalid chunk calculation. Expected ~${expectedChunks} chunks, got ${sessionData.totalChunks}`);
        }

        try {
            const session: RedisChunkSession = {
                uploadId: sessionData.uploadId,
                fileName: sessionData.fileName,
                totalSize: sessionData.totalSize,
                mimeType: sessionData.mimeType,
                chunkSize: sessionData.chunkSize,
                totalChunks: sessionData.totalChunks,
                uploadedChunks: [],
                failedChunks: [],
                status: 'pending',
                uploadedBy: sessionData.uploadedBy,
                createdAt: new Date(),
                updatedAt: new Date(),
                expiresAt: new Date(Date.now() + this.SESSION_TTL * 1000)
            };

            const key = `chunk_session:${session.uploadId}`;

            // Use pipeline for atomic operation
            const pipeline = this.redis.pipeline();

            // Store session data
            pipeline.hset(key, {
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
            pipeline.expire(key, this.SESSION_TTL);

            // Initialize chunk tracking sets with TTL
            pipeline.del(`chunk_uploaded:${session.uploadId}`); // Clear any existing data
            pipeline.del(`chunk_failed:${session.uploadId}`);
            pipeline.expire(`chunk_uploaded:${session.uploadId}`, this.SESSION_TTL);
            pipeline.expire(`chunk_failed:${session.uploadId}`, this.SESSION_TTL);

            await pipeline.exec();

            // Initialize progress tracking
            await this.initializeProgress(session.uploadId, session.totalChunks);

            console.log(`Redis session created: ${session.uploadId}, expires: ${session.expiresAt.toISOString()}, file: ${session.fileName} (${session.totalSize} bytes, ${session.totalChunks} chunks)`);

            return session;
        } catch (error) {
            console.error(`Error creating session ${sessionData.uploadId}:`, error);
            throw new Error(`Failed to create upload session: ${error.message}`);
        }
    }

    /**
     * Get session by upload ID
     */
    async getSession(uploadId: string): Promise<RedisChunkSession | null> {
        const key = `chunk_session:${uploadId}`;
        const data = await this.redis.hgetall(key);

        if (!data.uploadId) {
            console.log(`Redis session not found for uploadId: ${uploadId}`);
            return null;
        }

        // Get uploaded and failed chunks
        const uploadedChunks = await this.getUploadedChunks(uploadId);
        const failedChunks = await this.getFailedChunks(uploadId);

        const session = {
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

        console.log(`Redis session found: ${uploadId}, status: ${session.status}, expires: ${session.expiresAt.toISOString()}, uploaded chunks: ${uploadedChunks.length}/${session.totalChunks}`);

        return session;
    }

    /**
     * Mark chunk as completed with enhanced race condition protection
     */
    async markChunkCompleted(uploadId: string, chunkNumber: number): Promise<void> {
        if (!uploadId?.trim()) {
            throw new Error('Upload ID is required');
        }
        if (chunkNumber < 0) {
            throw new Error('Chunk number must be non-negative');
        }

        try {
            // Use Lua script for atomic operation to prevent race conditions
            const luaScript = `
                local uploadId = ARGV[1]
                local chunkNumber = ARGV[2]
                local timestamp = ARGV[3]
                local sessionTTL = ARGV[4]
                
                local uploadedKey = 'chunk_uploaded:' .. uploadId
                local failedKey = 'chunk_failed:' .. uploadId
                local sessionKey = 'chunk_session:' .. uploadId
                local progressKey = 'chunk_progress:' .. uploadId
                
                -- Check if session exists
                if redis.call('exists', sessionKey) == 0 then
                    return 'SESSION_NOT_FOUND'
                end
                
                -- Add to uploaded chunks set
                redis.call('sadd', uploadedKey, chunkNumber)
                -- Remove from failed chunks if exists
                redis.call('srem', failedKey, chunkNumber)
                
                -- Update session status and timestamp
                redis.call('hset', sessionKey, 'status', 'uploading', 'updatedAt', timestamp)
                
                -- Get current progress
                local totalChunks = redis.call('hget', sessionKey, 'totalChunks')
                local completedCount = redis.call('scard', uploadedKey)
                local percentage = math.floor((completedCount / tonumber(totalChunks)) * 100)
                
                -- Update progress
                redis.call('hset', progressKey, 
                    'completedChunks', completedCount,
                    'percentage', percentage,
                    'lastUpdated', timestamp)
                
                -- Refresh TTL
                redis.call('expire', sessionKey, sessionTTL)
                redis.call('expire', uploadedKey, sessionTTL)
                redis.call('expire', failedKey, sessionTTL)
                redis.call('expire', progressKey, sessionTTL)
                
                return 'SUCCESS'
            `;

            const result = await this.redis.eval(
                luaScript,
                0,
                uploadId,
                chunkNumber.toString(),
                new Date().toISOString(),
                this.SESSION_TTL.toString()
            );

            if (result === 'SESSION_NOT_FOUND') {
                throw new Error(`Session ${uploadId} not found or expired`);
            }

            console.log(`Chunk ${chunkNumber} marked as completed for upload ${uploadId}`);
        } catch (error) {
            console.error(`Error marking chunk ${chunkNumber} as completed for ${uploadId}:`, error);
            throw error;
        }
    }

    /**
     * Mark chunk as failed with enhanced error handling
     */
    async markChunkFailed(uploadId: string, chunkNumber: number, errorMessage?: string): Promise<void> {
        if (!uploadId?.trim()) {
            throw new Error('Upload ID is required');
        }
        if (chunkNumber < 0) {
            throw new Error('Chunk number must be non-negative');
        }

        try {
            // Use Lua script for atomic operation
            const luaScript = `
                local uploadId = ARGV[1]
                local chunkNumber = ARGV[2]
                local timestamp = ARGV[3]
                local sessionTTL = ARGV[4]
                local errorMessage = ARGV[5]
                
                local uploadedKey = 'chunk_uploaded:' .. uploadId
                local failedKey = 'chunk_failed:' .. uploadId
                local sessionKey = 'chunk_session:' .. uploadId
                local progressKey = 'chunk_progress:' .. uploadId
                
                -- Check if session exists
                if redis.call('exists', sessionKey) == 0 then
                    return 'SESSION_NOT_FOUND'
                end
                
                -- Add to failed chunks set
                redis.call('sadd', failedKey, chunkNumber)
                -- Remove from uploaded chunks if exists
                redis.call('srem', uploadedKey, chunkNumber)
                
                -- Update session with error info
                local updateData = {'updatedAt', timestamp}
                if errorMessage and errorMessage ~= '' then
                    table.insert(updateData, 'lastError')
                    table.insert(updateData, errorMessage)
                end
                redis.call('hset', sessionKey, unpack(updateData))
                
                -- Get current progress
                local totalChunks = redis.call('hget', sessionKey, 'totalChunks')
                local completedCount = redis.call('scard', uploadedKey)
                local failedCount = redis.call('scard', failedKey)
                local percentage = 0
                if tonumber(totalChunks) > 0 then
                    percentage = math.floor((completedCount / tonumber(totalChunks)) * 100)
                end
                
                -- Update progress with failed count
                redis.call('hset', progressKey,
                    'completedChunks', completedCount,
                    'failedChunks', failedCount,
                    'percentage', percentage,
                    'lastUpdated', timestamp)
                
                -- Refresh TTL
                redis.call('expire', sessionKey, sessionTTL)
                redis.call('expire', uploadedKey, sessionTTL)
                redis.call('expire', failedKey, sessionTTL)
                redis.call('expire', progressKey, sessionTTL)
                
                return 'SUCCESS'
            `;

            const result = await this.redis.eval(
                luaScript,
                0,
                uploadId,
                chunkNumber.toString(),
                new Date().toISOString(),
                this.SESSION_TTL.toString(),
                errorMessage || ''
            );

            if (result === 'SESSION_NOT_FOUND') {
                throw new Error(`Session ${uploadId} not found or expired`);
            }

            console.log(`Chunk ${chunkNumber} marked as failed for upload ${uploadId}${errorMessage ? `: ${errorMessage}` : ''}`);
        } catch (error) {
            console.error(`Error marking chunk ${chunkNumber} as failed for ${uploadId}:`, error);
            throw error;
        }
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
     * Uses Redis indexing for better performance
     */
    async getSessionsByUser(userId: string): Promise<RedisChunkSession[]> {
        if (!userId) {
            return [];
        }

        try {
            // Use Redis SCAN instead of KEYS for better performance
            const sessions: RedisChunkSession[] = [];
            const stream = this.redis.scanStream({
                match: 'chunk_session:*',
                count: 100
            });

            for await (const keys of stream) {
                // Process keys in batches
                const pipeline = this.redis.pipeline();
                for (const key of keys) {
                    pipeline.hget(key, 'uploadedBy');
                }
                const results = await pipeline.exec();

                // Check which sessions belong to the user
                const userSessionKeys: string[] = [];
                results?.forEach((result, index) => {
                    if (result && result[1] === userId) {
                        userSessionKeys.push(keys[index]);
                    }
                });

                // Get full session data for user's sessions
                for (const key of userSessionKeys) {
                    const uploadId = key.replace('chunk_session:', '');
                    const session = await this.getSession(uploadId);
                    if (session) {
                        sessions.push(session);
                    }
                }
            }

            return sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        } catch (error) {
            console.error(`Error getting sessions for user ${userId}:`, error);
            return [];
        }
    }

    /**
     * Get active sessions for a user (for rate limiting)
     * More efficient than getSessionsByUser for counting
     */
    async getUserActiveSessions(userId: string): Promise<RedisChunkSession[]> {
        if (!userId) {
            return [];
        }

        const sessions = await this.getSessionsByUser(userId);
        return sessions.filter(session =>
            ['pending', 'uploading', 'assembling'].includes(session.status)
        );
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

    /**
     * Enhanced methods for WebSocket integration and better performance
     */

    /**
     * Check if all chunks are uploaded (optimized version)
     */
    async isSessionComplete(uploadId: string): Promise<boolean> {
        try {
            const [totalChunks, uploadedCount] = await Promise.all([
                this.getTotalChunks(uploadId),
                this.getUploadedChunksCount(uploadId)
            ]);

            return totalChunks > 0 && uploadedCount === totalChunks;
        } catch (error) {
            console.error(`Error checking session completion ${uploadId}:`, error);
            return false;
        }
    }

    /**
     * Get session progress for WebSocket updates
     */
    async getSessionProgress(uploadId: string): Promise<{
        progress: number;
        uploadedChunks: number;
        totalChunks: number;
        failedChunks: number;
        status: string;
    } | null> {
        try {
            const sessionKey = `chunk_session:${uploadId}`;
            const sessionData = await this.redis.hgetall(sessionKey);

            if (!sessionData.uploadId) return null;

            const [uploadedCount, failedCount, totalChunks] = await Promise.all([
                this.getUploadedChunksCount(uploadId),
                this.getFailedChunksCount(uploadId),
                parseInt(sessionData.totalChunks || '0')
            ]);

            const progress = totalChunks > 0
                ? Math.round((uploadedCount / totalChunks) * 100)
                : 0;

            return {
                progress,
                uploadedChunks: uploadedCount,
                totalChunks,
                failedChunks: failedCount,
                status: sessionData.status || 'unknown'
            };
        } catch (error) {
            console.error(`Error getting session progress ${uploadId}:`, error);
            return null;
        }
    }

    /**
     * Update session status with atomic operation
     */
    async updateSessionStatus(
        uploadId: string,
        status: string,
        errorMessage?: string
    ): Promise<boolean> {
        try {
            const sessionKey = `chunk_session:${uploadId}`;
            const updateData: Record<string, string> = {
                'status': status,
                'updatedAt': new Date().toISOString()
            };

            if (errorMessage) {
                updateData['errorMessage'] = errorMessage;
            }

            const result = await this.redis.hset(sessionKey, updateData);
            return result !== null;
        } catch (error) {
            console.error(`Error updating session status ${uploadId}:`, error);
            return false;
        }
    }

    /**
     * Clean up completed or failed sessions efficiently
     */
    async cleanupSession(uploadId: string): Promise<boolean> {
        try {
            const pipeline = this.redis.pipeline();

            // Remove all session-related keys
            pipeline.del(`chunk_session:${uploadId}`);
            pipeline.del(`chunk_uploaded:${uploadId}`);
            pipeline.del(`chunk_failed:${uploadId}`);
            pipeline.del(`chunk_progress:${uploadId}`);

            const results = await pipeline.exec();
            return results?.every(result => result && result[0] === null) || false;
        } catch (error) {
            console.error(`Error cleaning up session ${uploadId}:`, error);
            return false;
        }
    }

    /**
     * Get active sessions count for user (rate limiting)
     */
    async getUserActiveSessionsCount(userId: string): Promise<number> {
        if (!userId) return 0;

        try {
            let activeCount = 0;
            const stream = this.redis.scanStream({
                match: 'chunk_session:*',
                count: 100
            });

            for await (const keys of stream) {
                const pipeline = this.redis.pipeline();
                for (const key of keys) {
                    pipeline.hmget(key, 'uploadedBy', 'status');
                }
                const results = await pipeline.exec();

                results?.forEach((result) => {
                    if (result && result[1] && Array.isArray(result[1])) {
                        const [uploadedBy, status] = result[1] as string[];
                        if (uploadedBy === userId &&
                            ['pending', 'uploading', 'assembling'].includes(status)) {
                            activeCount++;
                        }
                    }
                });
            }

            return activeCount;
        } catch (error) {
            console.error(`Error getting active sessions count for user ${userId}:`, error);
            return 0;
        }
    }

    /**
     * Batch update multiple chunks at once (for performance)
     */
    async batchUpdateChunks(
        uploadId: string,
        completedChunks: number[],
        failedChunks: number[] = []
    ): Promise<boolean> {
        try {
            const pipeline = this.redis.pipeline();

            // Add completed chunks
            if (completedChunks.length > 0) {
                pipeline.sadd(`chunk_uploaded:${uploadId}`, ...completedChunks.map(String));
                // Remove from failed if they were there
                for (const chunk of completedChunks) {
                    pipeline.srem(`chunk_failed:${uploadId}`, chunk.toString());
                }
            }

            // Add failed chunks
            if (failedChunks.length > 0) {
                pipeline.sadd(`chunk_failed:${uploadId}`, ...failedChunks.map(String));
                // Remove from uploaded if they were there
                for (const chunk of failedChunks) {
                    pipeline.srem(`chunk_uploaded:${uploadId}`, chunk.toString());
                }
            }

            // Update session timestamp
            pipeline.hset(`chunk_session:${uploadId}`, 'updatedAt', new Date().toISOString());

            const results = await pipeline.exec();
            return results?.every(result => result && result[0] === null) || false;
        } catch (error) {
            console.error(`Error batch updating chunks for ${uploadId}:`, error);
            return false;
        }
    }
}
