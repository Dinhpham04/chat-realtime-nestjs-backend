import { Injectable, BadRequestException, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { StorageService } from './storage.service';
import { FileValidationService } from './file-validation.service';
import { FilesService } from './files.service';
import { FILE_CONSTANTS } from '../constants/file.constants';
import {
    RedisChunkSessionService
} from '../../../redis/services/redis-chunk-session.service';
import {
    RedisChunkSession,
    ChunkUploadProgress
} from '../../../shared/interfaces/redis-services.interface';

export interface ChunkUploadInfo {
    uploadId: string;
    fileName: string;
    totalSize: number;
    mimeType: string;
    totalChunks: number;
    chunkSize: number;
}

export interface ChunkData {
    chunkNumber: number;
    chunkData: Buffer;
    chunkChecksum: string;
}

export interface UploadProgress {
    uploadId: string;
    totalChunks: number;
    completedChunks: number;
    percentage: number;
    isComplete: boolean;
    failedChunks: number[]; // Change back to array to match controller expectations
}

/**
 * Chunk upload service handling large file uploads like Zalo
 * Supports resume, parallel chunks, and integrity verification
 * Now uses Redis instead of MongoDB for better performance
 */
@Injectable()
export class ChunkUploadService {
    private readonly logger = new Logger(ChunkUploadService.name);

    constructor(
        private readonly redisSessionService: RedisChunkSessionService,
        private readonly storageService: StorageService,
        private readonly validationService: FileValidationService,
        @Inject(forwardRef(() => FilesService))
        private readonly filesService: FilesService,
    ) { }

    /**
     * Initiates a chunked upload session
     * @param fileName Original file name
     * @param totalSize Total file size
     * @param mimeType File MIME type
     * @param userId User performing upload
     * @returns Upload session info
     */
    async initiateChunkUpload(
        fileName: string,
        totalSize: number,
        mimeType: string,
        userId: string,
    ): Promise<ChunkUploadInfo> {
        this.logger.log(`Initiating chunk upload for ${fileName} (${totalSize} bytes) by user ${userId}`);

        // Input validation
        if (!fileName || !mimeType || !userId) {
            throw new BadRequestException('Missing required parameters: fileName, mimeType, and userId are required');
        }

        if (typeof totalSize !== 'number' || totalSize <= 0) {
            throw new BadRequestException('Invalid file size: must be a positive number');
        }

        // Use optimized validation for chunk upload initiation
        const quickValidation = this.validationService.validateChunkUploadInfo(fileName, mimeType, totalSize);
        if (!quickValidation.isValid) {
            throw new BadRequestException(`File validation failed: ${quickValidation.errors?.join(', ')}`);
        }

        // Check if file size requires chunking
        if (totalSize < FILE_CONSTANTS.CHUNK_UPLOAD_THRESHOLD) {
            throw new BadRequestException(
                `File size (${totalSize} bytes) is below chunk upload threshold (${FILE_CONSTANTS.CHUNK_UPLOAD_THRESHOLD} bytes). Use regular upload.`,
            );
        }

        // Get recommended chunk size based on file type
        const recommendedChunkSize = this.validationService.getRecommendedChunkSize(totalSize, mimeType);
        const chunkSize = Math.min(recommendedChunkSize, FILE_CONSTANTS.CHUNK_SIZE);

        // Calculate chunk parameters
        const totalChunks = Math.ceil(totalSize / chunkSize);

        // Validate chunk count limits
        const maxChunks = 1000;
        if (totalChunks > maxChunks) {
            throw new BadRequestException(`File too large for chunk upload. Maximum ${maxChunks} chunks allowed (current: ${totalChunks})`);
        }

        // Check for existing active sessions for this user (prevent spam)
        // TODO: Implement getUserActiveSessions in RedisChunkSessionService for production
        // For now, just log the session creation
        this.logger.log(`Creating new upload session for user ${userId}`);

        // Generate upload session
        const uploadId = uuidv4();
        const sessionData: Partial<RedisChunkSession> = {
            uploadId,
            fileName,
            totalSize,
            mimeType,
            chunkSize,
            totalChunks,
            uploadedBy: userId,
            status: 'pending',
            uploadedChunks: [],
            failedChunks: [],
        };

        await this.redisSessionService.createSession(sessionData);

        this.logger.log(`Chunk upload session created: ${uploadId} with ${totalChunks} chunks (${chunkSize} bytes each)`);

        return {
            uploadId,
            fileName,
            totalSize,
            mimeType,
            totalChunks,
            chunkSize,
        };
    }

    /**
     * Uploads a single chunk
     * @param uploadId Upload session ID
     * @param chunkNumber Chunk number (0-based)
     * @param chunkData Chunk binary data
     * @param chunkChecksum SHA256 checksum of chunk
     * @param userId User performing upload
     * @returns Upload progress
     */
    async uploadChunk(
        uploadId: string,
        chunkNumber: number,
        chunkData: Buffer,
        chunkChecksum: string,
        userId: string,
    ): Promise<UploadProgress> {
        this.logger.log(`Uploading chunk ${chunkNumber} for session ${uploadId}`);

        // Input validation
        if (!uploadId || !chunkData || typeof chunkNumber !== 'number' || !userId) {
            throw new BadRequestException('Invalid chunk upload parameters');
        }

        if (!Buffer.isBuffer(chunkData)) {
            throw new BadRequestException('Chunk data must be a valid Buffer');
        }

        if (!chunkChecksum || typeof chunkChecksum !== 'string') {
            throw new BadRequestException('Chunk checksum is required');
        }

        // Get upload session from Redis
        const session = await this.redisSessionService.getSession(uploadId);
        if (!session) {
            throw new NotFoundException(`Upload session not found: ${uploadId}`);
        }

        // Validate session
        const validation = this.validateUploadSession(session, userId);

        // Resume session if needed
        if (validation.needsResume) {
            await this.redisSessionService.updateStatus(uploadId, 'uploading');
            this.logger.log(`Resumed cancelled session ${uploadId} for chunk upload`);
        }

        // Verify chunk number
        if (chunkNumber < 0 || chunkNumber >= session.totalChunks) {
            throw new BadRequestException(`Invalid chunk number: ${chunkNumber}. Expected 0-${session.totalChunks - 1}`);
        }

        // Check if chunk already uploaded (idempotency)
        if (session.uploadedChunks.includes(chunkNumber)) {
            this.logger.warn(`Chunk ${chunkNumber} already uploaded for session ${uploadId}`);
            return this.redisSessionService.getProgress(uploadId);
        }

        // Verify chunk size (except last chunk)
        const expectedSize = chunkNumber === session.totalChunks - 1
            ? session.totalSize - (chunkNumber * session.chunkSize)
            : session.chunkSize;

        if (chunkData.length !== expectedSize) {
            throw new BadRequestException(
                `Invalid chunk size: ${chunkData.length}. Expected: ${expectedSize}`,
            );
        }

        // Additional chunk validation using FileValidationService
        const chunkValidation = this.validationService.validateChunkData(chunkData, expectedSize, chunkNumber);
        if (!chunkValidation.isValid) {
            throw new BadRequestException(chunkValidation.error);
        }

        // Verify chunk integrity
        const actualChecksum = crypto.createHash('sha256').update(chunkData).digest('hex');
        if (actualChecksum !== chunkChecksum) {
            throw new BadRequestException(`Chunk checksum mismatch. Expected: ${chunkChecksum}, Got: ${actualChecksum}`);
        }

        try {
            // Store chunk
            const chunkPath = `${uploadId}/chunk_${chunkNumber.toString().padStart(4, '0')}`;
            this.logger.log(`Storing chunk ${chunkNumber} to path: ${chunkPath}, size: ${chunkData.length} bytes`);
            await this.storageService.uploadChunk(chunkPath, chunkData);

            // Update session in Redis (atomic operation)
            await this.redisSessionService.markChunkCompleted(uploadId, chunkNumber);

            const progress = await this.redisSessionService.getProgress(uploadId);

            this.logger.log(`Chunk ${chunkNumber} uploaded successfully. Progress: ${progress.percentage}% (${progress.completedChunks}/${progress.totalChunks})`);

            return {
                uploadId: progress.uploadId,
                totalChunks: progress.totalChunks,
                completedChunks: progress.completedChunks,
                percentage: progress.percentage,
                isComplete: progress.isComplete,
                failedChunks: progress.failedChunks,
            };
        } catch (error) {
            this.logger.error(`Failed to upload chunk ${chunkNumber} for session ${uploadId}: ${error.message}`);
            this.logger.error(`Error stack: ${error.stack}`);

            // Mark chunk as failed in Redis
            await this.redisSessionService.markChunkFailed(uploadId, chunkNumber);

            throw new BadRequestException(`Failed to upload chunk ${chunkNumber}: ${error.message}`);
        }
    }

    /**
     * Completes the chunked upload by assembling chunks
     * @param uploadId Upload session ID
     * @param finalChecksum Optional SHA256 checksum of complete file
     * @param userId User performing upload
     * @returns Complete file info
     */
    async completeChunkUpload(
        uploadId: string,
        finalChecksum: string | undefined,
        userId: string,
    ): Promise<{
        fileId: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
        downloadUrl: string;
        thumbnailUrl?: string;
    }> {
        this.logger.log(`Completing chunk upload for session ${uploadId}`);

        // Input validation
        if (!uploadId || !userId) {
            throw new BadRequestException('Upload ID and User ID are required');
        }

        const session = await this.redisSessionService.getSession(uploadId);
        if (!session) {
            throw new NotFoundException(`Upload session not found: ${uploadId}`);
        }

        const validation = this.validateUploadSession(session, userId);

        // Resume session if needed
        if (validation.needsResume) {
            await this.redisSessionService.updateStatus(uploadId, 'uploading');
            this.logger.log(`Resumed cancelled session ${uploadId} for completion`);
        }

        // Check if all chunks are uploaded
        if (session.uploadedChunks.length !== session.totalChunks) {
            const missingChunks: number[] = [];
            for (let i = 0; i < session.totalChunks; i++) {
                if (!session.uploadedChunks.includes(i)) {
                    missingChunks.push(i);
                }
            }
            this.logger.error(`Missing chunks for session ${uploadId}: ${missingChunks.join(', ')}`);
            throw new BadRequestException(`Missing chunks: ${missingChunks.join(', ')}`);
        }

        try {
            // Update status to assembling
            await this.redisSessionService.updateStatus(uploadId, 'assembling');

            // Assemble chunks into final file
            const fileId = uuidv4();
            this.logger.log(`Assembling ${session.totalChunks} chunks for session ${uploadId}`);
            const assembledBuffer = await this.assembleChunks(uploadId, session.totalChunks);

            this.logger.log(`Assembled file size: ${assembledBuffer.length} bytes, expected: ${session.totalSize}`);

            // Verify file size matches expected
            if (assembledBuffer.length !== session.totalSize) {
                throw new BadRequestException(`Assembled file size mismatch. Expected: ${session.totalSize}, Got: ${assembledBuffer.length}`);
            }

            // Verify final file integrity if checksum provided
            if (finalChecksum) {
                const actualChecksum = crypto.createHash('sha256').update(assembledBuffer).digest('hex');
                if (actualChecksum !== finalChecksum) {
                    throw new BadRequestException(`Final file checksum mismatch. Expected: ${finalChecksum}, Got: ${actualChecksum}`);
                }
                this.logger.log(`Final file checksum verified: ${finalChecksum}`);
            }

            // Calculate final checksum for the assembled file (for FilesService)
            const computedChecksum = crypto.createHash('sha256').update(assembledBuffer).digest('hex');

            // Validate assembled file using FileValidationService
            const assembledValidation = this.validationService.validateAssembledFile(assembledBuffer, {
                fileName: session.fileName,
                mimeType: session.mimeType,
                expectedSize: session.totalSize
            });

            if (!assembledValidation.isValid) {
                throw new BadRequestException(`Assembled file validation failed: ${assembledValidation.errors?.join(', ')}`);
            }

            // Upload final file to storage
            const uploadResult = await this.storageService.uploadFile(
                fileId,
                assembledBuffer,
                session.mimeType,
            );

            // Use FilesService to create file record with thumbnail generation
            const fileResult = await this.filesService.createFileFromChunks(
                {
                    fileId,
                    originalName: session.fileName,
                    mimeType: session.mimeType,
                    size: session.totalSize,
                    checksum: computedChecksum
                },
                userId,
                uploadResult.path
            );

            // Mark session as completed
            await this.redisSessionService.updateStatus(uploadId, 'completed');

            // Clean up chunk files asynchronously (don't wait)
            this.cleanupChunkFiles(uploadId, session.totalChunks).catch(error => {
                this.logger.warn(`Failed to cleanup chunks for session ${uploadId}: ${error.message}`);
            });

            this.logger.log(`Chunk upload completed successfully: ${fileId}`);

            return {
                fileId: fileResult.fileId,
                fileName: fileResult.fileName,
                fileSize: fileResult.fileSize,
                mimeType: fileResult.mimeType,
                downloadUrl: fileResult.downloadUrl,
                thumbnailUrl: fileResult.thumbnailUrl,
            };
        } catch (error) {
            this.logger.error(`Failed to complete chunk upload for session ${uploadId}: ${error.message}`);
            this.logger.error(`Error stack: ${error.stack}`);
            await this.redisSessionService.updateStatus(uploadId, 'failed');
            throw new BadRequestException(`Failed to complete upload: ${error.message}`);
        }
    }

    /**
     * Gets upload progress for a session
     * @param uploadId Upload session ID
     * @param userId User requesting progress
     * @returns Upload progress
     */
    async getUploadProgress(uploadId: string, userId: string): Promise<UploadProgress> {
        const session = await this.redisSessionService.getSession(uploadId);
        if (!session) {
            throw new NotFoundException(`Upload session not found: ${uploadId}`);
        }

        const validation = this.validateUploadSession(session, userId);

        // Resume session if needed
        if (validation.needsResume) {
            await this.redisSessionService.updateStatus(uploadId, 'uploading');
            this.logger.log(`Resumed cancelled session ${uploadId} for progress check`);
        }

        const progress = await this.redisSessionService.getProgress(uploadId);

        return {
            uploadId: progress.uploadId,
            totalChunks: progress.totalChunks,
            completedChunks: progress.completedChunks,
            percentage: progress.percentage,
            isComplete: progress.isComplete,
            failedChunks: progress.failedChunks,
        };
    }

    /**
     * Cancels an upload session
     * @param uploadId Upload session ID
     * @param userId User canceling upload
     */
    async cancelUpload(uploadId: string, userId: string): Promise<void> {
        const session = await this.redisSessionService.getSession(uploadId);
        if (!session) {
            throw new NotFoundException(`Upload session not found: ${uploadId}`);
        }

        const validation = this.validateUploadSession(session, userId);

        // For cancel operation, we don't need to resume - we can cancel any non-completed session
        // Just log if it was already cancelled
        if (validation.needsResume) {
            this.logger.log(`Cancelling session ${uploadId} that was already cancelled but within grace period`);
        }

        // Mark session as cancelled
        await this.redisSessionService.updateStatus(uploadId, 'cancelled');

        // Clean up uploaded chunks
        await this.cleanupChunkFiles(uploadId, session.totalChunks);

        this.logger.log(`Upload session cancelled: ${uploadId}`);
    }

    /**
     * Gets chunk upload statistics for monitoring
     * @param userId Optional user ID to filter by
     * @returns Upload statistics
     */
    async getUploadStatistics(userId?: string): Promise<{
        totalSessions: number;
        activeSessions: number;
        completedSessions: number;
        failedSessions: number;
    }> {
        try {
            // TODO: Implement proper statistics collection from Redis
            // For now, return placeholder data
            this.logger.log(`Getting upload statistics for user: ${userId || 'all'}`);

            return {
                totalSessions: 0,
                activeSessions: 0,
                completedSessions: 0,
                failedSessions: 0
            };
        } catch (error) {
            this.logger.error(`Failed to get upload statistics: ${error.message}`);
            throw new BadRequestException('Failed to retrieve upload statistics');
        }
    }

    /**
     * Retries failed chunks for a session
     * @param uploadId Upload session ID
     * @param userId User requesting retry
     * @returns Updated progress
     */
    async retryFailedChunks(uploadId: string, userId: string): Promise<UploadProgress> {
        const session = await this.redisSessionService.getSession(uploadId);
        if (!session) {
            throw new NotFoundException(`Upload session not found: ${uploadId}`);
        }

        const validation = this.validateUploadSession(session, userId);

        if (session.failedChunks.length === 0) {
            this.logger.log(`No failed chunks to retry for session ${uploadId}`);
            return this.getUploadProgress(uploadId, userId);
        }

        this.logger.log(`Retrying ${session.failedChunks.length} failed chunks for session ${uploadId}`);

        // Reset failed chunks by updating session status to allow retry
        // Individual failed chunks will be cleared when they are successfully re-uploaded
        await this.redisSessionService.updateStatus(uploadId, 'uploading');

        return this.getUploadProgress(uploadId, userId);
    }

    // Private helper methods
    private validateUploadSession(session: RedisChunkSession, userId: string): { needsResume: boolean } {
        // Enhanced validation with detailed error messages
        if (!session) {
            throw new BadRequestException('Upload session not found or has been expired');
        }

        if (!session.uploadedBy || session.uploadedBy !== userId) {
            this.logger.warn(`Unauthorized access attempt to session ${session.uploadId} by user ${userId}. Owner: ${session.uploadedBy}`);
            throw new BadRequestException('Unauthorized: You can only access your own upload sessions');
        }

        // Handle date comparison with proper error handling
        try {
            const expiresAt = session.expiresAt instanceof Date ? session.expiresAt : new Date(session.expiresAt);
            const now = new Date();

            if (isNaN(expiresAt.getTime())) {
                this.logger.error(`Invalid expiration date for session ${session.uploadId}: ${session.expiresAt}`);
                throw new BadRequestException('Upload session has invalid expiration date');
            }

            if (expiresAt < now) {
                this.logger.warn(`Upload session ${session.uploadId} has expired. Expires: ${expiresAt.toISOString()}, Now: ${now.toISOString()}`);
                throw new BadRequestException('Upload session has expired. Please start a new upload.');
            }
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            this.logger.error(`Error validating session dates for ${session.uploadId}: ${error.message}`);
            throw new BadRequestException('Upload session validation failed');
        }

        // Check session status
        if (['completed', 'failed'].includes(session.status)) {
            throw new BadRequestException(`Upload session is already ${session.status}`);
        }

        // Enhanced cancelled session handling
        if (session.status === 'cancelled') {
            try {
                const cancelledAt = session.updatedAt instanceof Date ? session.updatedAt : new Date(session.updatedAt);
                const gracePeriodMs = 5 * 60 * 1000; // 5 minutes
                const now = new Date();

                if (isNaN(cancelledAt.getTime())) {
                    this.logger.error(`Invalid update date for cancelled session ${session.uploadId}: ${session.updatedAt}`);
                    throw new BadRequestException('Cancelled session has invalid timestamp');
                }

                if (now.getTime() - cancelledAt.getTime() > gracePeriodMs) {
                    throw new BadRequestException('Upload session was cancelled and grace period has expired. Please start a new upload.');
                }

                // Mark that this session needs to be resumed
                this.logger.log(`Session ${session.uploadId} is cancelled but within grace period, will resume`);
                return { needsResume: true };
            } catch (error) {
                if (error instanceof BadRequestException) {
                    throw error;
                }
                this.logger.error(`Error validating cancelled session ${session.uploadId}: ${error.message}`);
                throw new BadRequestException('Failed to validate cancelled session');
            }
        }

        this.logger.log(`Session ${session.uploadId} validation passed. Status: ${session.status}, User: ${userId}`);
        return { needsResume: false };
    }

    private async assembleChunks(uploadId: string, totalChunks: number): Promise<Buffer> {
        this.logger.log(`Starting assembly of ${totalChunks} chunks for session ${uploadId}`);

        // Pre-allocate buffer for better memory management
        let totalSize = 0;
        const chunks: Buffer[] = [];

        // Read all chunks first to calculate total size
        for (let i = 0; i < totalChunks; i++) {
            try {
                const chunkPath = `${uploadId}/chunk_${i.toString().padStart(4, '0')}`;
                const chunkBuffer = await this.storageService.downloadChunk(chunkPath);
                chunks.push(chunkBuffer);
                totalSize += chunkBuffer.length;

                this.logger.log(`Chunk ${i} read successfully: ${chunkBuffer.length} bytes`);

                // Memory protection - prevent massive files from crashing server
                if (totalSize > FILE_CONSTANTS.GLOBAL_MAX_FILE_SIZE) {
                    throw new BadRequestException(`Assembled file size (${totalSize}) exceeds maximum allowed size (${FILE_CONSTANTS.GLOBAL_MAX_FILE_SIZE})`);
                }
            } catch (error) {
                this.logger.error(`Failed to read chunk ${i} for session ${uploadId}: ${error.message}`);
                throw new BadRequestException(`Failed to read chunk ${i}: ${error.message}`);
            }
        }

        this.logger.log(`All ${totalChunks} chunks read successfully. Total size: ${totalSize} bytes. Assembling...`);

        try {
            // Use Buffer.concat for efficient assembly
            const assembledBuffer = Buffer.concat(chunks, totalSize);

            // Clear chunks array to free memory
            chunks.length = 0;

            this.logger.log(`Assembly completed successfully. Final size: ${assembledBuffer.length} bytes`);
            return assembledBuffer;
        } catch (error) {
            this.logger.error(`Failed to assemble chunks for session ${uploadId}: ${error.message}`);
            throw new BadRequestException(`Failed to assemble file: ${error.message}`);
        }
    }

    private async cleanupChunkFiles(uploadId: string, totalChunks: number): Promise<void> {
        try {
            const cleanupPromises: Promise<void>[] = [];
            for (let i = 0; i < totalChunks; i++) {
                const chunkPath = `${uploadId}/chunk_${i.toString().padStart(4, '0')}`;
                cleanupPromises.push(this.storageService.deleteChunk(chunkPath));
            }
            await Promise.all(cleanupPromises);
            this.logger.log(`Cleaned up ${totalChunks} chunk files for session ${uploadId}`);
        } catch (error) {
            this.logger.warn(`Failed to cleanup chunk files for session ${uploadId}: ${error.message}`);
        }
    }
}
