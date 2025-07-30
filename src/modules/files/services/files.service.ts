import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException, Logger, InternalServerErrorException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { IFileRepository, IMessageAttachmentRepository } from '../interfaces/repository.interface';
import { FileValidationService, FileInfo } from './file-validation.service';
import { StorageService } from './storage.service';
import { ThumbnailGenerationService } from './thumbnail-generation.service';
import { File } from '../schemas/file.schema';
import { MessageAttachment } from '../schemas/message-attachment.schema';
import { InitiateUploadDto, GenerateDownloadUrlDto, GetUserFilesDto } from '../dto/file.dto';
import { FILE_CONSTANTS, VIRUS_SCAN_STATUS } from '../constants/file.constants';

export interface UploadFileResult {
    fileId: string;
    fileName: string;
    originalName: string;
    fileSize: number;
    mimeType: string;
    downloadUrl: string;
    thumbnailUrl?: string;
    isNew: boolean;
}

export interface FileWithAttachments extends File {
    attachments?: MessageAttachment[];
}

/**
 * Core files service implementing business logic
 * Handles file operations with validation, deduplication, and security
 */
@Injectable()
export class FilesService {
    private readonly logger = new Logger(FilesService.name);

    constructor(
        @Inject('IFileRepository')
        private readonly fileRepository: IFileRepository,
        @Inject('IMessageAttachmentRepository')
        private readonly attachmentRepository: IMessageAttachmentRepository,
        private readonly validationService: FileValidationService,
        private readonly storageService: StorageService,
        private readonly thumbnailService: ThumbnailGenerationService,
    ) { }

    /**
     * Uploads a file with validation and deduplication
     * @param fileInfo File information including buffer
     * @param userId User performing the upload
     * @returns Upload result with file metadata
     */
    async uploadFile(fileInfo: FileInfo, userId: string): Promise<UploadFileResult> {
        this.logger.log(`Starting file upload for user ${userId}: ${fileInfo.originalName}`);

        // 1. Validate file
        const validation = this.validationService.validateFile(fileInfo);
        if (!validation.isValid) {
            throw new BadRequestException(`File validation failed: ${validation.errors?.join(', ')}`);
        }

        // 2. Generate checksum for deduplication
        const checksum = this.generateChecksum(fileInfo.buffer!);

        // 3. Check for existing file (deduplication)
        const existingFile = await this.fileRepository.findByChecksum(checksum, fileInfo.mimeType);
        if (existingFile) {
            this.logger.log(`File already exists, returning existing: ${existingFile.fileId}`);
            return {
                fileId: existingFile.fileId,
                fileName: existingFile.fileName,
                originalName: existingFile.originalFilename,
                fileSize: existingFile.fileSize,
                mimeType: existingFile.mimeType,
                downloadUrl: await this.storageService.getSignedUrl(existingFile.fileId, userId),
                thumbnailUrl: existingFile.thumbnailPath ?
                    await this.storageService.getSignedUrl(existingFile.fileId + '_thumb', userId) : undefined,
                isNew: false
            };
        }

        // 4. Generate unique file ID
        const fileId = this.generateFileId();

        // 5. Upload to storage
        const storageResult = await this.storageService.uploadFile(
            fileId,
            fileInfo.buffer!,
            fileInfo.mimeType
        );

        // 6. Save file metadata to database
        const fileData: Partial<File> = {
            fileId,
            originalFilename: fileInfo.originalName,
            fileName: this.generateFileName(fileInfo.originalName, fileId),
            mimeType: fileInfo.mimeType,
            fileSize: fileInfo.size,
            checksum,
            storagePath: storageResult.path,
            uploadedBy: userId,
            isProcessed: !validation.requiresProcessing, // Will be updated by processing service
            virusScanStatus: VIRUS_SCAN_STATUS.PENDING,
            isActive: true,
            downloadCount: 0,
            lastAccessedAt: new Date()
        };

        const savedFile = await this.fileRepository.create(fileData);

        this.logger.log(`File uploaded successfully: ${fileId}`);

        // Generate thumbnail if supported
        let thumbnailUrl: string | undefined = undefined;
        if (this.thumbnailService.isThumbnailSupported(fileInfo.mimeType)) {
            try {
                const thumbnailResult = await this.thumbnailService.generateThumbnail(
                    fileInfo.buffer!,
                    fileInfo.mimeType,
                    fileId,
                    userId
                );

                if (thumbnailResult) {
                    thumbnailUrl = thumbnailResult.thumbnailUrl;

                    // Update file record with thumbnail path
                    await this.fileRepository.updateById(fileId, {
                        thumbnailPath: thumbnailResult.thumbnailPath
                    });

                    this.logger.log(`Thumbnail generated for file: ${fileId}`);
                }
            } catch (error) {
                this.logger.warn(`Failed to generate thumbnail for ${fileId}:`, error);
                // Continue without thumbnail - don't fail the upload
            }
        }

        return {
            fileId: savedFile.fileId,
            fileName: savedFile.fileName,
            originalName: savedFile.originalFilename,
            fileSize: savedFile.fileSize,
            mimeType: savedFile.mimeType,
            downloadUrl: await this.storageService.getSignedUrl(savedFile.fileId, userId),
            thumbnailUrl,
            isNew: true
        };
    }

    /**
     * Gets file by ID with access control
     * @param fileId File identifier
     * @param userId User requesting the file
     * @returns File metadata
     */
    async getFile(fileId: string, userId?: string): Promise<File> {
        try {
            // Input validation
            if (!fileId) {
                throw new BadRequestException('File ID is required');
            }

            const file = await this.fileRepository.findById(fileId);
            if (!file) {
                throw new NotFoundException(`File not found: ${fileId}`);
            }

            // Check if file is active (not soft deleted)
            if (!file.isActive) {
                throw new NotFoundException(`File has been deleted: ${fileId}`);
            }

            // Check access permissions if userId provided
            if (userId && !await this.checkFileAccess(fileId, userId)) {
                throw new ForbiddenException('Access denied to this file');
            }

            // Update access time
            await this.fileRepository.updateAccessTime(fileId);

            return file;
        } catch (error) {
            if (error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof ForbiddenException) {
                throw error;
            }

            this.logger.error(`Failed to get file ${fileId}:`, error);
            throw new InternalServerErrorException('Failed to retrieve file');
        }
    }

    /**
     * Gets user's uploaded files with pagination
     * @param userId User ID
     * @param options Query options
     * @returns List of user files
     */
    async getUserFiles(userId: string, options: GetUserFilesDto): Promise<{
        files: File[];
        total: number;
        hasMore: boolean;
    }> {
        try {
            // Validate pagination parameters
            const limit = Math.min(Math.max(options.limit || 20, 1), 100); // Min 1, Max 100
            const skip = Math.max(options.skip || 0, 0); // Min 0

            const files = await this.fileRepository.findByUserId(userId, {
                limit,
                skip,
                sortBy: options.sortBy || 'createdAt',
                sortOrder: options.sortOrder || 'desc'
            });

            // Get total count efficiently - only do a separate query if needed for pagination
            let total = files.length;
            let hasMore = false;

            if (files.length === limit) {
                // Might have more files, need to get actual count
                const nextBatch = await this.fileRepository.findByUserId(userId, {
                    limit: 1,
                    skip: skip + limit
                });
                hasMore = nextBatch.length > 0;

                // For exact total, we'd need another query, but for pagination UX, 
                // knowing hasMore is often sufficient
                total = skip + files.length + (hasMore ? 1 : 0);
            }

            return {
                files,
                total,
                hasMore
            };
        } catch (error) {
            this.logger.error(`Failed to get files for user ${userId}:`, error);
            throw new InternalServerErrorException('Failed to retrieve user files');
        }
    }

    /**
     * Generates download URL with access control
     * @param fileId File identifier
     * @param userId User requesting download
     * @param options Download options
     * @returns Signed download URL
     */
    async generateDownloadUrl(
        fileId: string,
        userId: string,
        options: GenerateDownloadUrlDto = {}
    ): Promise<string> {
        // Verify file exists and user has access
        await this.getFile(fileId, userId);

        // Rate limiting check (simplified)
        // await this.checkDownloadRateLimit(userId);

        // Generate signed URL using Redis token service
        const downloadUrl = await this.storageService.getSignedUrl(
            fileId,
            userId,
            options.expiresIn || 3600,
            ['read', 'download'],
            options.maxDownloads
        );

        // Increment download count
        await this.fileRepository.incrementDownloadCount(fileId);

        this.logger.log(`Generated download URL for file ${fileId} by user ${userId}`);

        return downloadUrl;
    }

    /**
     * Links file to message
     * @param fileId File identifier
     * @param messageId Message identifier
     * @param userId User performing the action
     * @param caption Optional caption
     * @returns Message attachment
     */
    async linkFileToMessage(
        fileId: string,
        messageId: string,
        userId: string,
        caption?: string
    ): Promise<MessageAttachment> {
        // Verify file exists and user has access
        const file = await this.getFile(fileId, userId);

        // Check if user owns the file or has permission
        if (file.uploadedBy !== userId) {
            // In the future, check conversation membership
            throw new ForbiddenException('Cannot link file you do not own');
        }

        return this.attachmentRepository.linkFileToMessage(fileId, messageId, caption);
    }

    /**
     * Gets files attached to a message
     * @param messageId Message identifier
     * @param userId User requesting the files
     * @returns Array of files with attachment info
     */
    async getMessageFiles(messageId: string, userId?: string): Promise<FileWithAttachments[]> {
        const attachments = await this.attachmentRepository.findByMessageId(messageId);

        const filesWithAttachments: FileWithAttachments[] = [];

        for (const attachment of attachments) {
            try {
                const file = await this.getFile(attachment.fileId, userId);
                filesWithAttachments.push({
                    ...file,
                    attachments: [attachment]
                });
            } catch (error) {
                // Skip files user doesn't have access to
                this.logger.warn(`User ${userId} cannot access file ${attachment.fileId}`);
                continue;
            }
        }

        return filesWithAttachments;
    }

    /**
     * Soft deletes a file
     * @param fileId File identifier
     * @param userId User performing the deletion
     */
    async deleteFile(fileId: string, userId: string): Promise<void> {
        const file = await this.getFile(fileId, userId);

        // Only file owner can delete
        if (file.uploadedBy !== userId) {
            throw new ForbiddenException('Cannot delete file you do not own');
        }

        // Soft delete the file
        await this.fileRepository.softDeleteById(fileId);

        // Note: Physical file cleanup will be handled by scheduled job
        this.logger.log(`File soft deleted: ${fileId} by user ${userId}`);
    }

    /**
     * Checks if user has access to a file
     * @param fileId File identifier
     * @param userId User ID
     * @returns Whether user has access
     */
    async checkFileAccess(fileId: string, userId: string): Promise<boolean> {
        try {
            // Input validation
            if (!fileId || !userId) {
                return false;
            }

            const file = await this.fileRepository.findById(fileId);
            if (!file || !file.isActive) {
                return false;
            }

            // Owner always has access
            if (file.uploadedBy === userId) {
                return true;
            }

            // Check if file is attached to any message in conversations user participates in
            const attachments = await this.attachmentRepository.findByFileId(fileId);

            // For now, if file is attached to any message, allow access
            // TODO: In production, implement proper conversation membership check:
            // 1. Get conversations where file is attached
            // 2. Check if user is member of those conversations
            // 3. Check conversation permissions (read, download, etc.)

            const hasAttachments = attachments.length > 0;

            if (hasAttachments) {
                this.logger.log(`File ${fileId} access granted to user ${userId} via message attachments`);
            }

            return hasAttachments;
        } catch (error) {
            this.logger.error(`Failed to check file access for ${fileId} by user ${userId}:`, error);
            return false; // Fail-safe: deny access on error
        }
    }

    /**
     * Gets file statistics for admin/monitoring
     * @returns File statistics
     */
    async getFileStatistics(): Promise<{
        totalFiles: number;
        totalSize: number;
        filesByType: Record<string, number>;
        avgFileSize: number;
    }> {
        try {
            // Use pagination to avoid memory issues with large datasets
            const batchSize = 1000;
            let totalFiles = 0;
            let totalSize = 0;
            const filesByType: Record<string, number> = {};
            let skip = 0;
            let hasMore = true;

            while (hasMore) {
                const filesBatch = await this.fileRepository.findByUserId('', {
                    limit: batchSize,
                    skip
                });

                if (filesBatch.length === 0) {
                    hasMore = false;
                    break;
                }

                totalFiles += filesBatch.length;
                totalSize += filesBatch.reduce((sum, file) => sum + file.fileSize, 0);

                filesBatch.forEach(file => {
                    const category = file.mimeType.split('/')[0];
                    filesByType[category] = (filesByType[category] || 0) + 1;
                });

                skip += batchSize;
                hasMore = filesBatch.length === batchSize;
            }

            return {
                totalFiles,
                totalSize,
                filesByType,
                avgFileSize: totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0
            };
        } catch (error) {
            this.logger.error('Failed to get file statistics:', error);
            throw new InternalServerErrorException('Failed to retrieve file statistics');
        }
    }

    /**
     * Creates file record after successful chunk upload assembly
     * Used by ChunkUploadService for WebSocket integration
     * @param fileInfo Assembled file information
     * @param userId User performing the upload
     * @param storagePath File storage path
     * @returns Upload result
     */
    async createFileFromChunks(
        fileInfo: {
            fileId: string;
            originalName: string;
            mimeType: string;
            size: number;
            checksum: string;
        },
        userId: string,
        storagePath: string
    ): Promise<UploadFileResult> {
        this.logger.log(`Creating file record from chunks: ${fileInfo.fileId} for user ${userId}`);

        try {
            // Check for existing file by checksum (deduplication)
            const existingFile = await this.fileRepository.findByChecksum(fileInfo.checksum, fileInfo.mimeType);
            if (existingFile) {
                this.logger.log(`File already exists, returning existing: ${existingFile.fileId}`);
                return {
                    fileId: existingFile.fileId,
                    fileName: existingFile.fileName,
                    originalName: existingFile.originalFilename,
                    fileSize: existingFile.fileSize,
                    mimeType: existingFile.mimeType,
                    downloadUrl: await this.storageService.getSignedUrl(existingFile.fileId, userId),
                    thumbnailUrl: existingFile.thumbnailPath ?
                        await this.storageService.getSignedUrl(existingFile.fileId + '_thumb', userId) : undefined,
                    isNew: false
                };
            }

            // Create file metadata
            const fileData: Partial<File> = {
                fileId: fileInfo.fileId,
                originalFilename: fileInfo.originalName,
                fileName: this.generateFileName(fileInfo.originalName, fileInfo.fileId),
                mimeType: fileInfo.mimeType,
                fileSize: fileInfo.size,
                checksum: fileInfo.checksum,
                storagePath,
                uploadedBy: userId,
                isProcessed: true, // Chunks are already processed
                virusScanStatus: VIRUS_SCAN_STATUS.PENDING,
                isActive: true,
                downloadCount: 0,
                lastAccessedAt: new Date()
            };

            const savedFile = await this.fileRepository.create(fileData);

            this.logger.log(`File record created from chunks: ${fileInfo.fileId}`);

            // Generate thumbnail if supported (for chunk uploads, we need to read the file from storage)
            let thumbnailUrl: string | undefined = undefined;
            if (this.thumbnailService.isThumbnailSupported(fileInfo.mimeType)) {
                try {
                    // Read the assembled file from storage to generate thumbnail
                    const fileBuffer = await this.storageService.downloadFile(fileInfo.fileId);

                    const thumbnailResult = await this.thumbnailService.generateThumbnail(
                        fileBuffer,
                        fileInfo.mimeType,
                        fileInfo.fileId,
                        userId
                    );

                    if (thumbnailResult) {
                        thumbnailUrl = thumbnailResult.thumbnailUrl;

                        // Update file record with thumbnail path
                        await this.fileRepository.updateById(fileInfo.fileId, {
                            thumbnailPath: thumbnailResult.thumbnailPath
                        });

                        this.logger.log(`Thumbnail generated for chunked file: ${fileInfo.fileId}`);
                    }
                } catch (error) {
                    this.logger.warn(`Failed to generate thumbnail for chunked file ${fileInfo.fileId}:`, error);
                    // Continue without thumbnail - don't fail the upload
                }
            }

            return {
                fileId: savedFile.fileId,
                fileName: savedFile.fileName,
                originalName: savedFile.originalFilename,
                fileSize: savedFile.fileSize,
                mimeType: savedFile.mimeType,
                downloadUrl: await this.storageService.getSignedUrl(savedFile.fileId, userId),
                thumbnailUrl,
                isNew: true
            };
        } catch (error) {
            this.logger.error(`Failed to create file record from chunks ${fileInfo.fileId}:`, error);
            throw new InternalServerErrorException('Failed to create file record');
        }
    }

    /**
     * Validates if file already exists by checksum (for deduplication)
     * @param checksum File checksum
     * @param mimeType File MIME type
     * @param userId User requesting validation
     * @returns Existing file info or null
     */
    async validateFileExists(checksum: string, mimeType: string, userId: string): Promise<UploadFileResult | null> {
        try {
            const existingFile = await this.fileRepository.findByChecksum(checksum, mimeType);
            if (!existingFile || !existingFile.isActive) {
                return null;
            }

            // Check if user has access to existing file
            const hasAccess = await this.checkFileAccess(existingFile.fileId, userId);
            if (!hasAccess) {
                // User doesn't have access to existing file, treat as new upload
                return null;
            }

            this.logger.log(`Duplicate file detected: ${existingFile.fileId} for user ${userId}`);

            return {
                fileId: existingFile.fileId,
                fileName: existingFile.fileName,
                originalName: existingFile.originalFilename,
                fileSize: existingFile.fileSize,
                mimeType: existingFile.mimeType,
                downloadUrl: await this.storageService.getSignedUrl(existingFile.fileId, userId),
                thumbnailUrl: existingFile.thumbnailPath ?
                    await this.storageService.getSignedUrl(existingFile.fileId + '_thumb', userId) : undefined,
                isNew: false
            };
        } catch (error) {
            this.logger.error(`Failed to validate file existence for checksum ${checksum}:`, error);
            return null; // On error, allow new upload
        }
    }

    // Private helper methods
    private generateFileId(): string {
        return uuidv4();
    }

    private generateChecksum(buffer: Buffer): string {
        return crypto.createHash('sha256').update(buffer).digest('hex');
    }

    private generateFileName(originalName: string, fileId: string): string {
        const extension = originalName.substring(originalName.lastIndexOf('.'));
        const safeName = originalName
            .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace unsafe characters
            .substring(0, 100); // Limit length

        return `${fileId}_${safeName}${extension}`;
    }

    private async checkDownloadRateLimit(userId: string): Promise<void> {
        try {
            // TODO: Implement proper Redis-based rate limiting
            // For now, just log and basic validation
            if (!userId) {
                throw new BadRequestException('User ID required for download');
            }

            this.logger.log(`Download requested by user: ${userId}`);

            // Basic rate limiting simulation - in production:
            // 1. Use Redis to store download count per user per time window
            // 2. Check if user exceeds MAX_DOWNLOADS_PER_HOUR
            // 3. Track download bandwidth per user
            // 4. Implement exponential backoff for repeated violations

            // Example implementation:
            // const downloadKey = `downloads:${userId}:${Math.floor(Date.now() / 3600000)}`;
            // const currentCount = await redis.incr(downloadKey);
            // await redis.expire(downloadKey, 3600);
            // if (currentCount > MAX_DOWNLOADS_PER_HOUR) {
            //     throw new TooManyRequestsException('Download rate limit exceeded');
            // }

        } catch (error) {
            this.logger.error(`Rate limit check failed for user ${userId}:`, error);
            throw error;
        }
    }
}
