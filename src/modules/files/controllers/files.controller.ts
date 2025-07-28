import {
    Controller,
    Post,
    Get,
    Delete,
    Param,
    Query,
    Body,
    UseInterceptors,
    UploadedFile,
    UploadedFiles,
    HttpStatus,
    HttpCode,
    UseGuards,
    Request,
    Response,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { Express, Response as ExpressResponse } from 'express';
import { FilesService } from '../services/files.service';
import { FileValidationService, FileInfo } from '../services/file-validation.service';
import { StorageService } from '../services/storage.service';
import {
    InitiateUploadDto,
    GenerateDownloadUrlDto,
    GetUserFilesDto,
    LinkFileToMessageDto,
    UploadResponseDto,
    FileDetailResponseDto,
    UserFilesResponseDto
} from '../dto/file.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Public } from '../../../shared/decorators/public.decorator';
import { FILE_CONSTANTS } from '../constants/file.constants';

interface AuthenticatedRequest extends Request {
    user: {
        id: string;
        email: string;
    };
}

/**
 * Files controller handling file upload, download, and management
 * RESTful API endpoints with comprehensive validation and security
 */
@ApiTags('Files')
@Controller('files')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FilesController {
    private readonly logger = new Logger(FilesController.name);

    constructor(
        private readonly filesService: FilesService,
        private readonly validationService: FileValidationService,
        private readonly storageService: StorageService,
    ) { }

    /**
     * Upload a single file with validation
     * Supports images, videos, documents, audio files
     */
    @Post('upload')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Upload a file',
        description: 'Upload a single file with automatic validation, deduplication, and secure storage',
    })
    @ApiConsumes('multipart/form-data')
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'File uploaded successfully',
        type: UploadResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid file or validation failed',
    })
    @ApiResponse({
        status: HttpStatus.PAYLOAD_TOO_LARGE,
        description: 'File size exceeds maximum limit',
    })
    @UseInterceptors(
        FileInterceptor('file', {
            limits: {
                fileSize: FILE_CONSTANTS.GLOBAL_MAX_FILE_SIZE,
            },
            fileFilter: (req, file, callback) => {
                // Basic MIME type check - detailed validation in service
                const allowedMimes = [
                    // Images
                    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
                    // Videos  
                    'video/mp4', 'video/avi', 'video/mov', 'video/wmv',
                    // Documents
                    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    // Audio
                    'audio/mpeg', 'audio/wav', 'audio/mp3',
                    // Archives
                    'application/zip', 'application/x-rar-compressed',
                ];

                if (allowedMimes.includes(file.mimetype)) {
                    callback(null, true);
                } else {
                    callback(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
                }
            },
        }),
    )
    async uploadFile(
        @UploadedFile() file: Express.Multer.File,
        @Request() req: AuthenticatedRequest,
    ): Promise<UploadResponseDto> {
        this.logger.log(`File upload request from user: ${req.user.id}`);

        if (!file) {
            throw new BadRequestException('No file provided');
        }

        // Convert multer file to FileInfo
        const fileInfo: FileInfo = {
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            buffer: file.buffer,
        };

        const result = await this.filesService.uploadFile(fileInfo, req.user.id);

        return {
            success: true,
            message: result.isNew ? 'File uploaded successfully' : 'File already exists, returning existing file',
            data: {
                fileId: result.fileId,
                fileName: result.fileName,
                originalName: result.originalName,
                fileSize: result.fileSize,
                mimeType: result.mimeType,
                downloadUrl: result.downloadUrl,
                thumbnailUrl: result.thumbnailUrl,
                isNew: result.isNew,
                uploadedAt: new Date().toISOString(),
            },
        };
    }

    /**
     * Upload multiple files simultaneously
     * Support batch upload for better UX
     */
    @Post('upload/batch')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Upload multiple files',
        description: 'Upload multiple files simultaneously with validation and deduplication',
    })
    @ApiConsumes('multipart/form-data')
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Files uploaded successfully',
    })
    @UseInterceptors(
        FilesInterceptor('files', 10, {
            limits: {
                fileSize: FILE_CONSTANTS.GLOBAL_MAX_FILE_SIZE,
            },
        }),
    )
    async uploadMultipleFiles(
        @UploadedFiles() files: Express.Multer.File[],
        @Request() req: AuthenticatedRequest,
    ): Promise<{
        success: boolean;
        message: string;
        data: {
            uploadedFiles: Array<{
                fileId: string;
                fileName: string;
                originalName: string;
                fileSize: number;
                mimeType: string;
                downloadUrl: string;
                isNew: boolean;
            }>;
            totalFiles: number;
            successCount: number;
            failedCount: number;
            errors: Array<{ fileName: string; error: string }>;
        };
    }> {
        this.logger.log(`Batch file upload request from user: ${req.user.id} - ${files?.length || 0} files`);

        if (!files || files.length === 0) {
            throw new BadRequestException('No files provided');
        }

        if (files.length > 10) {
            throw new BadRequestException('Too many files. Maximum 10 files per batch');
        }

        const uploadedFiles: any[] = [];
        const errors: Array<{ fileName: string; error: string }> = [];

        // Process files in parallel with concurrency limit
        const uploadPromises = files.map(async (file) => {
            try {
                const fileInfo: FileInfo = {
                    originalName: file.originalname,
                    mimeType: file.mimetype,
                    size: file.size,
                    buffer: file.buffer,
                };

                const result = await this.filesService.uploadFile(fileInfo, req.user.id);

                uploadedFiles.push({
                    fileId: result.fileId,
                    fileName: result.fileName,
                    originalName: result.originalName,
                    fileSize: result.fileSize,
                    mimeType: result.mimeType,
                    downloadUrl: result.downloadUrl,
                    isNew: result.isNew,
                });

                return { success: true, fileName: file.originalname };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                errors.push({
                    fileName: file.originalname,
                    error: errorMessage,
                });
                return { success: false, fileName: file.originalname, error: errorMessage };
            }
        });

        // Wait for all uploads to complete
        await Promise.allSettled(uploadPromises);

        const successCount = uploadedFiles.length;
        const failedCount = errors.length;
        const totalFiles = files.length;

        return {
            success: successCount > 0,
            message: `Batch upload completed: ${successCount}/${totalFiles} files uploaded successfully`,
            data: {
                uploadedFiles,
                totalFiles,
                successCount,
                failedCount,
                errors,
            },
        };
    }

    /**
     * Get file details by ID
     */
    @Get(':fileId')
    @ApiOperation({
        summary: 'Get file details',
        description: 'Retrieve file metadata and details by file ID',
    })
    @ApiParam({
        name: 'fileId',
        description: 'Unique file identifier',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'File details retrieved successfully',
        type: FileDetailResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'File not found',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: 'Access denied to this file',
    })
    async getFileDetails(
        @Param('fileId') fileId: string,
        @Request() req: AuthenticatedRequest,
    ): Promise<FileDetailResponseDto> {
        const file = await this.filesService.getFile(fileId, req.user.id);

        return {
            success: true,
            data: {
                fileId: file.fileId,
                fileName: file.fileName,
                originalName: file.originalFilename,
                mimeType: file.mimeType,
                fileSize: file.fileSize,
                uploadedBy: file.uploadedBy,
                uploadedAt: file.createdAt.toISOString(),
                downloadCount: file.downloadCount,
                isProcessed: file.isProcessed,
                virusScanStatus: file.virusScanStatus,
                metadata: file.metadata,
            },
        };
    }

    /**
     * Generate secure download URL
     */
    @Post(':fileId/download-url')
    @ApiOperation({
        summary: 'Generate download URL',
        description: 'Generate a secure, time-limited download URL for a file',
    })
    @ApiParam({
        name: 'fileId',
        description: 'Unique file identifier',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Download URL generated successfully',
    })
    async generateDownloadUrl(
        @Param('fileId') fileId: string,
        @Body() options: GenerateDownloadUrlDto,
        @Request() req: AuthenticatedRequest,
    ): Promise<{ downloadUrl: string; expiresAt: string }> {
        const downloadUrl = await this.filesService.generateDownloadUrl(
            fileId,
            req.user.id,
            options,
        );

        const expiresAt = new Date(Date.now() + (options.expiresIn || 3600) * 1000).toISOString();

        return {
            downloadUrl,
            expiresAt,
        };
    }

    /**
     * Get user's uploaded files with pagination
     */
    @Get()
    @ApiOperation({
        summary: 'Get user files',
        description: 'Retrieve paginated list of files uploaded by the current user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'User files retrieved successfully',
        type: UserFilesResponseDto,
    })
    async getUserFiles(
        @Query() options: GetUserFilesDto,
        @Request() req: AuthenticatedRequest,
    ): Promise<UserFilesResponseDto> {
        const result = await this.filesService.getUserFiles(req.user.id, options);

        return {
            success: true,
            data: {
                files: result.files.map(file => ({
                    fileId: file.fileId,
                    fileName: file.fileName,
                    originalName: file.originalFilename,
                    mimeType: file.mimeType,
                    fileSize: file.fileSize,
                    uploadedAt: file.createdAt.toISOString(),
                    downloadCount: file.downloadCount,
                    isProcessed: file.isProcessed,
                })),
                pagination: {
                    total: result.total,
                    limit: options.limit || 20,
                    skip: options.skip || 0,
                    hasMore: result.hasMore,
                },
            },
        };
    }

    /**
     * Link file to a message
     */
    @Post(':fileId/link-message')
    @ApiOperation({
        summary: 'Link file to message',
        description: 'Attach a file to a specific message in a conversation',
    })
    @ApiParam({
        name: 'fileId',
        description: 'Unique file identifier',
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'File linked to message successfully',
    })
    async linkFileToMessage(
        @Param('fileId') fileId: string,
        @Body() linkData: LinkFileToMessageDto,
        @Request() req: AuthenticatedRequest,
    ): Promise<{ success: boolean; attachmentId: string }> {
        const attachment = await this.filesService.linkFileToMessage(
            fileId,
            linkData.messageId,
            req.user.id,
            linkData.caption,
        );

        return {
            success: true,
            attachmentId: attachment.attachmentId,
        };
    }

    /**
     * Link multiple files to a message at once
     * For batch file sharing in conversations
     */
    @Post('batch/link-message')
    @ApiOperation({
        summary: 'Link multiple files to message',
        description: 'Attach multiple files to a specific message in a conversation',
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Files linked to message successfully',
    })
    async linkMultipleFilesToMessage(
        @Body() linkData: {
            fileIds: string[];
            messageId: string;
            captions?: Record<string, string>; // fileId -> caption mapping
        },
        @Request() req: AuthenticatedRequest,
    ): Promise<{
        success: boolean;
        data: {
            linkedFiles: Array<{
                fileId: string;
                attachmentId: string;
                caption?: string;
            }>;
            totalFiles: number;
            successCount: number;
            failedCount: number;
            errors: Array<{ fileId: string; error: string }>;
        };
    }> {
        this.logger.log(`Linking ${linkData.fileIds.length} files to message ${linkData.messageId}`);

        if (!linkData.fileIds || linkData.fileIds.length === 0) {
            throw new BadRequestException('No file IDs provided');
        }

        if (linkData.fileIds.length > 20) {
            throw new BadRequestException('Too many files. Maximum 20 files per message');
        }

        const linkedFiles: any[] = [];
        const errors: Array<{ fileId: string; error: string }> = [];

        // Process files in parallel
        const linkPromises = linkData.fileIds.map(async (fileId) => {
            try {
                const caption = linkData.captions?.[fileId];
                const attachment = await this.filesService.linkFileToMessage(
                    fileId,
                    linkData.messageId,
                    req.user.id,
                    caption,
                );

                linkedFiles.push({
                    fileId,
                    attachmentId: attachment.attachmentId,
                    caption,
                });

                return { success: true, fileId };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                errors.push({
                    fileId,
                    error: errorMessage,
                });
                return { success: false, fileId, error: errorMessage };
            }
        });

        // Wait for all links to complete
        await Promise.allSettled(linkPromises);

        const successCount = linkedFiles.length;
        const failedCount = errors.length;
        const totalFiles = linkData.fileIds.length;

        return {
            success: successCount > 0,
            data: {
                linkedFiles,
                totalFiles,
                successCount,
                failedCount,
                errors,
            },
        };
    }

    /**
     * Get files attached to a message
     */
    @Get('message/:messageId/attachments')
    @ApiOperation({
        summary: 'Get message attachments',
        description: 'Retrieve all files attached to a specific message',
    })
    @ApiParam({
        name: 'messageId',
        description: 'Message identifier',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Message attachments retrieved successfully',
    })
    async getMessageAttachments(
        @Param('messageId') messageId: string,
        @Request() req: AuthenticatedRequest,
    ): Promise<{
        success: boolean;
        data: Array<{
            fileId: string;
            fileName: string;
            mimeType: string;
            fileSize: number;
            caption?: string;
            attachmentOrder: number;
        }>;
    }> {
        const filesWithAttachments = await this.filesService.getMessageFiles(
            messageId,
            req.user.id,
        );

        return {
            success: true,
            data: filesWithAttachments.map(file => ({
                fileId: file.fileId,
                fileName: file.fileName,
                mimeType: file.mimeType,
                fileSize: file.fileSize,
                caption: file.attachments?.[0]?.caption,
                attachmentOrder: file.attachments?.[0]?.attachmentOrder || 0,
            })),
        };
    }

    /**
     * Soft delete a file
     */
    @Delete(':fileId')
    @ApiOperation({
        summary: 'Delete file',
        description: 'Soft delete a file (mark as inactive, actual file cleanup handled separately)',
    })
    @ApiParam({
        name: 'fileId',
        description: 'Unique file identifier',
    })
    @ApiResponse({
        status: HttpStatus.NO_CONTENT,
        description: 'File deleted successfully',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: 'Cannot delete file you do not own',
    })
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteFile(
        @Param('fileId') fileId: string,
        @Request() req: AuthenticatedRequest,
    ): Promise<void> {
        await this.filesService.deleteFile(fileId, req.user.id);
    }

    /**
     * Secure file download with Redis token validation
     * No authentication required - token contains authorization
     */
    @Public()
    @Get('download/:fileId')
    @ApiOperation({
        summary: 'Download file with token',
        description: 'Download file using secure Redis token. No authentication header required.',
    })
    @ApiParam({
        name: 'fileId',
        description: 'Unique file identifier',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'File downloaded successfully',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Invalid or expired token',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'File not found',
    })
    async downloadFile(
        @Param('fileId') fileId: string,
        @Query('token') token: string,
        @Request() req: any,
        @Response() res: ExpressResponse,
    ): Promise<void> {
        if (!token) {
            throw new BadRequestException('Download token is required');
        }

        try {
            // Validate token and get file info
            const tokenData = await this.storageService.validateAndTrackDownload(
                token,
                'download',
                req.ip
            );

            // Verify fileId matches token
            if (tokenData.fileId !== fileId) {
                throw new BadRequestException('File ID does not match token');
            }

            // Get file metadata
            const file = await this.filesService.getFile(fileId, tokenData.userId);

            // Get file content
            const fileBuffer = await this.storageService.downloadFile(fileId);

            // Set appropriate headers
            res.setHeader('Content-Type', file.mimeType);
            res.setHeader('Content-Length', fileBuffer.length);
            res.setHeader('Content-Disposition', `attachment; filename="${file.originalFilename}"`);
            res.setHeader('Cache-Control', 'private, no-cache');

            // Send file
            res.send(fileBuffer);

            this.logger.log(`File ${fileId} downloaded by user ${tokenData.userId}`);
        } catch (error) {
            this.logger.error(`Download failed for file ${fileId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Secure file preview with Redis token validation
     * For inline viewing (images, PDFs, etc.)
     */
    @Public()
    @Get('preview/:fileId')
    @ApiOperation({
        summary: 'Preview file with token',
        description: 'Preview file using secure Redis token. For inline viewing without download.',
    })
    @ApiParam({
        name: 'fileId',
        description: 'Unique file identifier',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'File preview loaded successfully',
    })
    async previewFile(
        @Param('fileId') fileId: string,
        @Query('token') token: string,
        @Request() req: any,
        @Response() res: ExpressResponse,
    ): Promise<void> {
        if (!token) {
            throw new BadRequestException('Preview token is required');
        }

        try {
            // Validate token with read permission
            const tokenData = await this.storageService.validateAndTrackDownload(
                token,
                'read',
                req.ip
            );

            // Verify fileId matches token
            if (tokenData.fileId !== fileId) {
                throw new BadRequestException('File ID does not match token');
            }

            // Get file metadata
            const file = await this.filesService.getFile(fileId, tokenData.userId);

            // Get file content
            const fileBuffer = await this.storageService.downloadFile(fileId);

            // Set appropriate headers for inline viewing
            res.setHeader('Content-Type', file.mimeType);
            res.setHeader('Content-Length', fileBuffer.length);
            res.setHeader('Content-Disposition', 'inline');
            res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour

            // Send file
            res.send(fileBuffer);

            this.logger.log(`File ${fileId} previewed by user ${tokenData.userId}`);
        } catch (error) {
            this.logger.error(`Preview failed for file ${fileId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Admin endpoint for file statistics
     */
    @Get('admin/statistics')
    @ApiOperation({
        summary: 'Get file statistics',
        description: 'Retrieve file statistics for monitoring and admin purposes',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'File statistics retrieved successfully',
    })
    async getFileStatistics(): Promise<{
        totalFiles: number;
        totalSize: number;
        filesByType: Record<string, number>;
        avgFileSize: number;
    }> {
        return this.filesService.getFileStatistics();
    }

    /**
     * Health check endpoint for testing
     */
    @Get('admin/test')
    @ApiOperation({
        summary: 'Health check',
        description: 'Simple health check endpoint for testing service availability',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Service is healthy',
    })
    async healthCheck(): Promise<{ status: string; timestamp: string }> {
        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
        };
    }
}
