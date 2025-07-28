import { Injectable, BadRequestException, Logger, NotFoundException, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { StorageService } from './storage.service';
import { FileValidationService } from './file-validation.service';
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

        // Validate file size and type
        const fileInfo = {
            originalName: fileName,
            mimeType,
            size: totalSize,
        };

        const validation = this.validationService.validateFile(fileInfo);
        if (!validation.isValid) {
            throw new BadRequestException(`File validation failed: ${validation.errors?.join(', ')}`);
        }

        // Check if file size requires chunking
        if (totalSize < FILE_CONSTANTS.CHUNK_UPLOAD_THRESHOLD) {
            throw new BadRequestException(
                `File size (${totalSize}) is below chunk upload threshold (${FILE_CONSTANTS.CHUNK_UPLOAD_THRESHOLD}). Use regular upload.`,
            );
        }

        // Calculate chunk parameters
        const chunkSize = FILE_CONSTANTS.CHUNK_SIZE;
        const totalChunks = Math.ceil(totalSize / chunkSize);

        if (totalChunks > 1000) {
            throw new BadRequestException('File too large for chunk upload (max 1000 chunks)');
        }

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

        this.logger.log(`Chunk upload session created: ${uploadId} with ${totalChunks} chunks`);

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

        // Get upload session from Redis
        const session = await this.redisSessionService.getSession(uploadId);
        if (!session) {
            throw new NotFoundException(`Upload session not found: ${uploadId}`);
        }

        // Validate session
        this.validateUploadSession(session, userId);

        // Verify chunk number
        if (chunkNumber < 0 || chunkNumber >= session.totalChunks) {
            throw new BadRequestException(`Invalid chunk number: ${chunkNumber}. Expected 0-${session.totalChunks - 1}`);
        }

        // Check if chunk already uploaded
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

        // Verify chunk integrity
        const actualChecksum = crypto.createHash('sha256').update(chunkData).digest('hex');
        if (actualChecksum !== chunkChecksum) {
            throw new BadRequestException(`Chunk checksum mismatch. Expected: ${chunkChecksum}, Got: ${actualChecksum}`);
        }

        try {
            // Store chunk
            const chunkPath = `${uploadId}/chunk_${chunkNumber.toString().padStart(4, '0')}`;
            await this.storageService.uploadChunk(chunkPath, chunkData);

            // Update session in Redis
            await this.redisSessionService.markChunkCompleted(uploadId, chunkNumber);

            const progress = await this.redisSessionService.getProgress(uploadId);

            this.logger.log(`Chunk ${chunkNumber} uploaded successfully. Progress: ${progress.percentage}%`);

            return {
                uploadId: progress.uploadId,
                totalChunks: progress.totalChunks,
                completedChunks: progress.completedChunks,
                percentage: progress.percentage,
                isComplete: progress.isComplete,
                failedChunks: progress.failedChunks, // This already matches the interface
            };
        } catch (error) {
            this.logger.error(`Failed to upload chunk ${chunkNumber}: ${error.message}`);

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
    }> {
        this.logger.log(`Completing chunk upload for session ${uploadId}`);

        const session = await this.redisSessionService.getSession(uploadId);
        if (!session) {
            throw new NotFoundException(`Upload session not found: ${uploadId}`);
        }

        this.validateUploadSession(session, userId);

        // Check if all chunks are uploaded
        if (session.uploadedChunks.length !== session.totalChunks) {
            const missingChunks: number[] = [];
            for (let i = 0; i < session.totalChunks; i++) {
                if (!session.uploadedChunks.includes(i)) {
                    missingChunks.push(i);
                }
            }
            throw new BadRequestException(`Missing chunks: ${missingChunks.join(', ')}`);
        }

        try {
            // Update status to assembling
            await this.redisSessionService.updateStatus(uploadId, 'assembling');

            // Assemble chunks into final file
            const fileId = uuidv4();
            const assembledBuffer = await this.assembleChunks(uploadId, session.totalChunks);

            // Verify final file integrity if checksum provided
            if (finalChecksum) {
                const actualChecksum = crypto.createHash('sha256').update(assembledBuffer).digest('hex');
                if (actualChecksum !== finalChecksum) {
                    throw new BadRequestException(`Final file checksum mismatch. Expected: ${finalChecksum}, Got: ${actualChecksum}`);
                }
            }

            // Upload final file
            const uploadResult = await this.storageService.uploadFile(
                fileId,
                assembledBuffer,
                session.mimeType,
            );

            // Mark session as completed
            await this.redisSessionService.updateStatus(uploadId, 'completed');

            // Clean up chunk files
            await this.cleanupChunkFiles(uploadId, session.totalChunks);

            this.logger.log(`Chunk upload completed successfully: ${fileId}`);

            return {
                fileId,
                fileName: session.fileName,
                fileSize: session.totalSize,
                mimeType: session.mimeType,
                downloadUrl: uploadResult.url,
            };
        } catch (error) {
            this.logger.error(`Failed to complete chunk upload: ${error.message}`);
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

        this.validateUploadSession(session, userId);

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

        this.validateUploadSession(session, userId);

        // Mark session as cancelled
        await this.redisSessionService.updateStatus(uploadId, 'cancelled');

        // Clean up uploaded chunks
        await this.cleanupChunkFiles(uploadId, session.totalChunks);

        this.logger.log(`Upload session cancelled: ${uploadId}`);
    }

    // Private helper methods
    private validateUploadSession(session: RedisChunkSession, userId: string): void {
        if (session.uploadedBy !== userId) {
            throw new BadRequestException('Unauthorized: You can only access your own upload sessions');
        }

        if (session.expiresAt < new Date()) {
            throw new BadRequestException('Upload session has expired');
        }

        if (['completed', 'failed', 'cancelled'].includes(session.status)) {
            throw new BadRequestException(`Upload session is already ${session.status}`);
        }
    }

    private async assembleChunks(uploadId: string, totalChunks: number): Promise<Buffer> {
        const chunks: Buffer[] = [];

        for (let i = 0; i < totalChunks; i++) {
            const chunkPath = `${uploadId}/chunk_${i.toString().padStart(4, '0')}`;
            const chunkBuffer = await this.storageService.downloadChunk(chunkPath);
            chunks.push(chunkBuffer);
        }

        return Buffer.concat(chunks);
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
