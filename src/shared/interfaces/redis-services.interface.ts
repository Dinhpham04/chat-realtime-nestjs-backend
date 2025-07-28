/**
 * Shared interfaces for Redis-based services
 * Used across modules to avoid circular dependencies
 */

export interface RedisChunkSession {
    uploadId: string;
    fileName: string;
    totalSize: number;
    mimeType: string;
    chunkSize: number;
    totalChunks: number;
    uploadedChunks: number[];
    failedChunks: number[];
    status: 'pending' | 'uploading' | 'assembling' | 'completed' | 'failed' | 'cancelled';
    uploadedBy: string;
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date;
}

export interface ChunkUploadProgress {
    uploadId: string;
    totalChunks: number;
    completedChunks: number;
    failedChunks: number[]; // Change to array for consistency
    percentage: number;
    isComplete: boolean;
}

export interface DownloadToken {
    fileId: string;
    userId: string;
    permissions: ('read' | 'download')[];
    expiresAt: Date;
    downloadCount?: number;
    maxDownloads?: number;
    ipAddress?: string;
}

export interface FileDownloadStats {
    totalDownloads: number;
    uniqueUsers: number;
    recentDownloads: Array<{
        timestamp: Date;
        userId: string;
        tokenId: string;
    }>;
}

/**
 * Redis service interfaces for dependency injection
 */
export interface IRedisChunkSessionService {
    createSession(sessionData: Partial<RedisChunkSession>): Promise<RedisChunkSession>;
    getSession(uploadId: string): Promise<RedisChunkSession | null>;
    markChunkCompleted(uploadId: string, chunkNumber: number): Promise<void>;
    markChunkFailed(uploadId: string, chunkNumber: number): Promise<void>;
    getProgress(uploadId: string): Promise<ChunkUploadProgress>;
    updateStatus(uploadId: string, status: RedisChunkSession['status']): Promise<void>;
    deleteSession(uploadId: string): Promise<void>;
    getSessionsByUser(userId: string): Promise<RedisChunkSession[]>;
    cleanupExpiredSessions(): Promise<number>;
}

export interface IRedisDownloadTokenService {
    generateToken(fileId: string, userId: string, options?: {
        expiresIn?: number;
        permissions?: ('read' | 'download')[];
        maxDownloads?: number;
        ipAddress?: string;
    }): Promise<string>;
    validateToken(tokenId: string, requiredPermission?: 'read' | 'download', clientIp?: string): Promise<DownloadToken>;
    trackDownload(tokenId: string): Promise<void>;
    revokeToken(tokenId: string, userId?: string): Promise<void>;
    getUserTokens(userId: string): Promise<Array<{ tokenId: string; token: DownloadToken }>>;
    revokeAllUserTokens(userId: string): Promise<number>;
    generateOneTimeToken(fileId: string, userId: string, expiresIn?: number): Promise<string>;
    generatePreviewToken(fileId: string, userId: string, expiresIn?: number): Promise<string>;
    getFileDownloadStats(fileId: string): Promise<FileDownloadStats>;
}
