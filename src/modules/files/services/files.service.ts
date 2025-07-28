import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { IFileRepository, IMessageAttachmentRepository } from '../interfaces/repository.interface';
import { FileValidationService, FileInfo } from './file-validation.service';
import { StorageService } from './storage.service';
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

        return {
            fileId: savedFile.fileId,
            fileName: savedFile.fileName,
            originalName: savedFile.originalFilename,
            fileSize: savedFile.fileSize,
            mimeType: savedFile.mimeType,
            downloadUrl: storageResult.url,
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
        const file = await this.fileRepository.findById(fileId);
        if (!file) {
            throw new NotFoundException(`File not found: ${fileId}`);
        }

        // Check access permissions if userId provided
        if (userId && !await this.checkFileAccess(fileId, userId)) {
            throw new ForbiddenException('Access denied to this file');
        }

        // Update access time
        await this.fileRepository.updateAccessTime(fileId);

        return file;
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
        const files = await this.fileRepository.findByUserId(userId, {
            limit: options.limit,
            skip: options.skip,
            sortBy: options.sortBy,
            sortOrder: options.sortOrder
        });

        // Get total count for pagination
        const allUserFiles = await this.fileRepository.findByUserId(userId);
        const total = allUserFiles.length;
        const hasMore = (options.skip || 0) + files.length < total;

        return {
            files,
            total,
            hasMore
        };
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
        await this.checkDownloadRateLimit(userId);

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
        const file = await this.fileRepository.findById(fileId);
        if (!file) {
            return false;
        }

        // Owner always has access
        if (file.uploadedBy === userId) {
            return true;
        }

        // Check if file is attached to any message in conversations user participates in
        const attachments = await this.attachmentRepository.findByFileId(fileId);

        // For now, if file is attached to any message, allow access
        // In production, check conversation membership
        return attachments.length > 0;
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
        // This would be more efficient with aggregation pipeline in production
        const allFiles = await this.fileRepository.findByUserId('', { limit: 10000 });

        const totalFiles = allFiles.length;
        const totalSize = allFiles.reduce((sum, file) => sum + file.fileSize, 0);
        const filesByType: Record<string, number> = {};

        allFiles.forEach(file => {
            const category = file.mimeType.split('/')[0];
            filesByType[category] = (filesByType[category] || 0) + 1;
        });

        return {
            totalFiles,
            totalSize,
            filesByType,
            avgFileSize: totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0
        };
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
        // Simplified rate limiting - in production use Redis
        // For now, just log the access
        this.logger.log(`Download requested by user: ${userId}`);

        // TODO: Implement proper rate limiting
        // Example: Check Redis for user download count in last hour
        // If > MAX_DOWNLOADS_PER_HOUR, throw TooManyRequestsException
    }
}
