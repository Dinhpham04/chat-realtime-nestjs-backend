import { Public } from 'src/shared';
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
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiConsumes,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
    ApiBody,
    ApiProperty
} from '@nestjs/swagger';
import { Express, Response as ExpressResponse, Request as ExpressRequest } from 'express';
import { FilesService, UploadFileResult } from '../services/files.service';
import { FileValidationService, FileInfo } from '../services/file-validation.service';
import { StorageService } from '../services/storage.service';
import {
    UploadSingleFileDto,
    FileMetadataDto,
    InitiateUploadDto,
    GenerateDownloadUrlDto,
    GetUserFilesDto,
    LinkFileToMessageDto,
    UploadResponseDto,
    FileDetailResponseDto,
    UserFilesResponseDto
} from '../dto/file.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtUser } from '../../auth/interfaces/jwt-payload.interface';
import { FILE_CONSTANTS } from '../constants/file.constants';
import { RedisDownloadTokenService } from '../../../redis/services/redis-download-token.service';

interface AuthenticatedRequest extends ExpressRequest {
    user: JwtUser; // userId, phoneNumber, deviceId, roles
}
/**
 * Files Controller - RESTful API for file operations
 * 
 * 🎯 Purpose: Handle HTTP requests for file upload, download, and management
 * 📱 Mobile-First: Optimized for mobile file sharing use cases
 * 🚀 Clean Architecture: Controller layer with proper separation of concerns
 * 
 * Features:
 * - Single & batch file upload with validation
 * - Secure file download with Redis tokens
 * - File metadata management
 * - Message attachment linking
 * - Comprehensive error handling
 * 
 * Security:
 * - JWT authentication required (except public download)
 * - File type validation
 * - Size limits enforcement
 * - Secure token-based downloads
 * 
 * Following Senior Developer Guidelines:
 * - Clean error handling with proper HTTP status codes
 * - Comprehensive logging for debugging
 * - Input validation at controller level
 * - Business logic delegated to services
 * - Swagger documentation for all endpoints
 */
@ApiTags('Files')
@Controller('files')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class FilesController {
    private readonly logger = new Logger(FilesController.name);

    constructor(
        private readonly filesService: FilesService,
        private readonly validationService: FileValidationService,
        private readonly storageService: StorageService,
        private readonly redisDownloadTokenService: RedisDownloadTokenService,
    ) { }

    /**
     * Upload a single file with validation
     * Supports images, videos, documents, audio files
     */
    @Post('upload')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Upload a single file',
        description: `
        Upload a single file with automatic validation, deduplication, and secure storage.
        
        **Supported File Types:**
        - Images: JPEG, PNG, GIF, WebP (max 50MB)
        - Videos: MP4, AVI, MOV, WMV (max 500MB)
        - Documents: PDF, DOC, DOCX, XLS, XLSX (max 100MB)
        - Audio: MP3, WAV, MPEG (max 50MB)
        - Archives: ZIP, RAR (max 100MB)
        
        **Features:**
        - Automatic file deduplication (same file won't be stored twice)
        - Virus scanning and validation
        - Secure download URL generation
        - Thumbnail generation for images
        
        **How to use:**
        1. Select file from your device
        2. Send as multipart/form-data with field name "file"
        3. Receive file metadata and download URL in response
        `,
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        description: 'Single file upload form data',
        type: UploadSingleFileDto,
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                    description: 'The file to upload (required)',
                    example: 'Select file from your device'
                }
            },
            required: ['file']
        }
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'File uploaded successfully',
        type: UploadResponseDto,
        schema: {
            example: {
                success: true,
                message: 'File uploaded successfully',
                data: {
                    fileId: '550e8400-e29b-41d4-a716-446655440000',
                    fileName: 'user_profile_image_abc123.jpg',
                    originalName: 'my-photo.jpg',
                    fileSize: 2048576,
                    mimeType: 'image/jpeg',
                    downloadUrl: '/files/download/550e8400-e29b-41d4-a716-446655440000?token=abc123...',
                    thumbnailUrl: '/files/preview/550e8400-e29b-41d4-a716-446655440000?token=def456...',
                    isNew: true,
                    uploadedAt: '2025-07-29T10:30:00.000Z'
                }
            }
        }
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid file or validation failed',
        schema: {
            example: {
                success: false,
                error: 'Unsupported file type: text/plain',
                code: 'VALIDATION_FAILED',
                message: 'Only images, videos, documents, audio and archives are allowed'
            }
        }
    })
    @ApiResponse({
        status: HttpStatus.PAYLOAD_TOO_LARGE,
        description: 'File size exceeds maximum limit',
        schema: {
            example: {
                success: false,
                error: 'File too large',
                message: 'Maximum file size is 500MB for videos, 100MB for documents'
            }
        }
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
        this.logger.log(`File upload request from user: ${req.user.userId}`);

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

        const result = await this.filesService.uploadFile(fileInfo, req.user.userId);

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
        summary: 'Upload multiple files at once',
        description: `
        Upload up to 10 files simultaneously with validation and deduplication.
        
        **Benefits:**
        - Process multiple files in parallel for better performance
        - Automatic error handling per file
        - Detailed success/failure report
        - Same validation rules as single upload
        
        **Usage Example:**
        1. Select multiple files (max 10)
        2. Send as multipart/form-data with field name "files"
        3. Each file is processed independently
        4. Receive detailed report with success/failure for each file
        
        **Best Practices:**
        - Keep total payload under 100MB for best performance
        - Mix different file types is supported
        - Failed files won't affect successful uploads
        `,
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        description: 'Multiple files upload form data',
        schema: {
            type: 'object',
            properties: {
                files: {
                    type: 'array',
                    items: {
                        type: 'string',
                        format: 'binary'
                    },
                    description: 'Array of files to upload (max 10 files)',
                    maxItems: 10,
                    example: 'Select multiple files from your device'
                }
            },
            required: ['files']
        }
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Batch upload completed (may include partial failures)',
        schema: {
            example: {
                success: true,
                message: 'Batch upload completed: 8/10 files uploaded successfully',
                data: {
                    uploadedFiles: [
                        {
                            fileId: '550e8400-e29b-41d4-a716-446655440001',
                            fileName: 'user_image_1.jpg',
                            originalName: 'photo1.jpg',
                            fileSize: 1024000,
                            mimeType: 'image/jpeg',
                            downloadUrl: '/api/v1/files/download/550e8400-e29b-41d4-a716-446655440001?token=eyJhbGciOiJIUzI1NiIs...',
                            thumbnailUrl: '/api/v1/files/preview/550e8400-e29b-41d4-a716-446655440001?token=def456...',
                            isNew: true
                        }
                    ],
                    totalFiles: 10,
                    successCount: 8,
                    failedCount: 2,
                    errors: [
                        {
                            fileName: 'invalid.txt',
                            error: 'Unsupported file type'
                        },
                        {
                            fileName: 'toolarge.mp4',
                            error: 'File size exceeds maximum limit'
                        }
                    ]
                }
            }
        }
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
                thumbnailUrl: string;
                isNew: boolean;
            }>;
            totalFiles: number;
            successCount: number;
            failedCount: number;
            errors: Array<{ fileName: string; error: string }>;
        };
    }> {
        this.logger.log(`Batch file upload request from user: ${req.user.userId} - ${files?.length || 0} files`);

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

                const result = await this.filesService.uploadFile(fileInfo, req.user.userId);

                uploadedFiles.push({
                    fileId: result.fileId,
                    fileName: result.fileName,
                    originalName: result.originalName,
                    fileSize: result.fileSize,
                    mimeType: result.mimeType,
                    downloadUrl: result.downloadUrl,
                    thumbnailUrl: result.thumbnailUrl,
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
     * Generate secure download URL
     */
    @Post(':fileId/download-url')
    @ApiOperation({
        summary: 'Generate secure download URL',
        description: `
        Generate a time-limited, secure download URL for a file.
        
        **Security Features:**
        - URLs expire after specified time (default 1 hour)
        - Download count limits available
        - Download tracking and analytics
        
        **Use Cases:**
        - Share files with external users
        - Generate download links for mobile apps
        - Create temporary access for file previews
        - Implement download analytics and tracking
        
        **Important:**
        - Generated URLs work without authentication
        - URLs are tied to the generating user's permissions
        - Expired URLs return 401 Unauthorized
        - Download count limits prevent abuse
        `,
    })
    @ApiParam({
        name: 'fileId',
        description: 'File identifier to generate download URL for',
        example: '550e8400-e29b-41d4-a716-446655440000',
        schema: {
            type: 'string',
            format: 'uuid'
        }
    })
    @ApiBody({
        description: 'Download URL generation options',
        type: GenerateDownloadUrlDto,
        schema: {
            type: 'object',
            properties: {
                expiresIn: {
                    type: 'number',
                    description: 'Expiration time in seconds (default: 3600 = 1 hour)',
                    example: 3600,
                    minimum: 300,
                    maximum: 86400
                },
                maxDownloads: {
                    type: 'number',
                    description: 'Maximum number of downloads allowed (optional)',
                    example: 5,
                    minimum: 1,
                    maximum: 100
                }
            }
        },
        examples: {
            'Standard 1-hour URL': {
                value: {
                    expiresIn: 3600
                }
            },
            'Limited downloads': {
                value: {
                    expiresIn: 86400,
                    maxDownloads: 1
                }
            },
            'Multiple downloads': {
                value: {
                    expiresIn: 7200,
                    maxDownloads: 10
                }
            }
        }
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Download URL generated successfully',
        schema: {
            example: {
                downloadUrl: 'https://api.example.com/files/download/550e8400-e29b-41d4-a716-446655440000?token=eyJhbGciOiJIUzI1NiIs...',
                expiresAt: '2025-07-29T11:30:00.000Z'
            }
        }
    })
    async generateDownloadUrl(
        @Param('fileId') fileId: string,
        @Body() options: GenerateDownloadUrlDto,
        @Request() req: AuthenticatedRequest,
    ): Promise<{ downloadUrl: string; expiresAt: string }> {
        const downloadUrl = await this.filesService.generateDownloadUrl(
            fileId,
            req.user.userId,
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
        summary: 'Get user\'s uploaded files',
        description: `
        Retrieve paginated list of files uploaded by the current user.
        
        **Features:**
        - Pagination support for large file lists
        - Filtering by file type, date range, size
        - Sorting by upload date, file size, name
        - Search by filename
        
        **Query Parameters:**
        - limit: Number of files per page (default: 20, max: 100)
        - skip: Number of files to skip for pagination
        - sortBy: Field to sort by (uploadDate, fileSize, fileName)
        - sortOrder: Sort direction (asc, desc)
        - fileType: Filter by MIME type category
        - searchQuery: Search in file names
        
        **Use Cases:**
        - Display user's file library
        - Implement file management interface
        - Show recent uploads
        - File search and filtering
        `,
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        description: 'Number of files to return (max 100)',
        example: 20,
        schema: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 20
        }
    })
    @ApiQuery({
        name: 'skip',
        required: false,
        description: 'Number of files to skip for pagination',
        example: 0,
        schema: {
            type: 'number',
            minimum: 0,
            default: 0
        }
    })
    @ApiQuery({
        name: 'sortBy',
        required: false,
        description: 'Field to sort by',
        example: 'uploadDate',
        schema: {
            type: 'string',
            enum: ['uploadDate', 'fileSize', 'fileName', 'downloadCount'],
            default: 'uploadDate'
        }
    })
    @ApiQuery({
        name: 'sortOrder',
        required: false,
        description: 'Sort direction',
        example: 'desc',
        schema: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc'
        }
    })
    @ApiQuery({
        name: 'fileType',
        required: false,
        description: 'Filter by file type category',
        example: 'images',
        schema: {
            type: 'string',
            enum: ['images', 'videos', 'documents', 'audio', 'archives']
        }
    })
    @ApiQuery({
        name: 'searchQuery',
        required: false,
        description: 'Search term for file names',
        example: 'report',
        schema: {
            type: 'string',
            maxLength: 100
        }
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'User files retrieved successfully',
        type: UserFilesResponseDto,
        schema: {
            example: {
                success: true,
                data: {
                    files: [
                        {
                            fileId: '550e8400-e29b-41d4-a716-446655440000',
                            fileName: 'user_report_2025.pdf',
                            originalName: 'Annual Report 2025.pdf',
                            mimeType: 'application/pdf',
                            fileSize: 2048576,
                            uploadedAt: '2025-07-29T10:30:00.000Z',
                            downloadCount: 12,
                            isProcessed: true
                        }
                    ],
                    pagination: {
                        total: 150,
                        limit: 20,
                        skip: 0,
                        hasMore: true
                    }
                }
            }
        }
    })
    async getUserFiles(
        @Query() options: GetUserFilesDto,
        @Request() req: AuthenticatedRequest,
    ): Promise<UserFilesResponseDto> {
        const result = await this.filesService.getUserFiles(req.user.userId, options);

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
        summary: 'Attach file to message',
        description: `
        Attach a file to a specific message in a conversation.
        
        **Features:**
        - Link files to chat messages
        - Add optional caption/description
        - Support multiple files per message
        - Maintain attachment order
        
        **Use Cases:**
        - Share files in chat conversations
        - Add context with captions
        - Create file galleries in messages
        - Reference files in discussions
        
        **Requirements:**
        - User must own the file or have share permission
        - Message must exist and user must have access
        - File must be processed and virus-free
        `,
    })
    @ApiParam({
        name: 'fileId',
        description: 'File identifier to attach to message',
        example: '550e8400-e29b-41d4-a716-446655440000',
        schema: {
            type: 'string',
            format: 'uuid'
        }
    })
    @ApiBody({
        description: 'Message linking data',
        type: LinkFileToMessageDto,
        schema: {
            type: 'object',
            properties: {
                messageId: {
                    type: 'string',
                    format: 'uuid',
                    description: 'Message to attach file to',
                    example: '123e4567-e89b-12d3-a456-426614174000'
                },
                caption: {
                    type: 'string',
                    description: 'Optional caption or description for the file',
                    example: 'Here\'s the document we discussed',
                    maxLength: 500
                },
                attachmentOrder: {
                    type: 'number',
                    description: 'Order of attachment in message (auto-assigned if not provided)',
                    example: 1,
                    minimum: 1
                }
            },
            required: ['messageId']
        },
        examples: {
            'Simple attachment': {
                value: {
                    messageId: '123e4567-e89b-12d3-a456-426614174000'
                }
            },
            'With caption': {
                value: {
                    messageId: '123e4567-e89b-12d3-a456-426614174000',
                    caption: 'Updated project proposal document'
                }
            },
            'Specific order': {
                value: {
                    messageId: '123e4567-e89b-12d3-a456-426614174000',
                    caption: 'Image 1 of 3',
                    attachmentOrder: 1
                }
            }
        }
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'File linked to message successfully',
        schema: {
            example: {
                success: true,
                attachmentId: '789e0123-e45f-67g8-h901-234567890123'
            }
        }
    })
    async linkFileToMessage(
        @Param('fileId') fileId: string,
        @Body() linkData: LinkFileToMessageDto,
        @Request() req: AuthenticatedRequest,
    ): Promise<{ success: boolean; attachmentId: string }> {
        const attachment = await this.filesService.linkFileToMessage(
            fileId,
            linkData.messageId,
            req.user.userId,
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
                    req.user.userId,
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
            req.user.userId,
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
        await this.filesService.deleteFile(fileId, req.user.userId);
    }

    /**
     * Secure file download with Redis token validation
     * No authentication required - token contains authorization
     */
    @Public()
    @Get('download/:fileId')
    @ApiOperation({
        summary: 'Download file with secure token',
        description: `
        Download file using secure Redis token. No authentication header required.
        
        **Security Features:**
        - Token-based access (no login required)
        - Time-limited URLs
        - IP-based restrictions (optional)
        - Download tracking and analytics
        - One-time use tokens supported
        
        **How to Use:**
        1. Generate download URL using POST /files/:fileId/download-url
        2. Use the returned URL directly in browser or HTTP client
        3. File will be downloaded with appropriate headers
        
        **Token Format:**
        URL includes token as query parameter: ?token=abc123...
        
        **Important Notes:**
        - Tokens expire based on generation settings
        - Invalid/expired tokens return 401 Unauthorized
        - Download attempts are logged for security
        - Large files may take time to transfer
        `,
    })
    @ApiParam({
        name: 'fileId',
        description: 'File identifier to download',
        example: '550e8400-e29b-41d4-a716-446655440000',
        schema: {
            type: 'string',
            format: 'uuid'
        }
    })
    @ApiQuery({
        name: 'token',
        required: true,
        description: 'Secure download token (generated via download-url endpoint)',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        schema: {
            type: 'string',
            minLength: 20
        }
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'File downloaded successfully',
        content: {
            'application/octet-stream': {
                schema: {
                    type: 'string',
                    format: 'binary'
                }
            },
            'image/jpeg': {
                schema: {
                    type: 'string',
                    format: 'binary'
                }
            },
            'application/pdf': {
                schema: {
                    type: 'string',
                    format: 'binary'
                }
            }
        },
        headers: {
            'Content-Type': {
                description: 'MIME type of the file',
                schema: { type: 'string' }
            },
            'Content-Length': {
                description: 'Size of the file in bytes',
                schema: { type: 'integer' }
            },
            'Content-Disposition': {
                description: 'Attachment header with filename',
                schema: { type: 'string' }
            }
        }
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Missing or invalid token',
        schema: {
            example: {
                success: false,
                error: 'Download token is required',
                message: 'Please provide a valid download token'
            }
        }
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Invalid or expired token',
        schema: {
            example: {
                success: false,
                error: 'Token expired',
                message: 'Download token has expired, please generate a new one'
            }
        }
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'File not found',
        schema: {
            example: {
                success: false,
                error: 'File not found',
                message: 'The requested file does not exist'
            }
        }
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
        summary: 'Preview file inline with secure token',
        description: `
        Preview file using secure Redis token for inline viewing without download.
        
        **Supported Preview Types:**
        - Images: JPEG, PNG, GIF, WebP (inline display)
        - PDFs: Rendered in browser PDF viewer
        - Text files: Plain text display
        - Audio: HTML5 audio player compatible
        - Videos: HTML5 video player compatible
        
        **Features:**
        - No download - view directly in browser
        - Optimized for web display
        - Caching headers for performance
        - Same security as download endpoints
        
        **Use Cases:**
        - Image galleries and previews
        - Document quick view
        - Media player integration
        - File thumbnails and previews
        
        **Response Headers:**
        - Content-Disposition: inline (not attachment)
        - Cache-Control: optimized for browser caching
        - Content-Type: original file MIME type
        `,
    })
    @ApiParam({
        name: 'fileId',
        description: 'File identifier to preview',
        example: '550e8400-e29b-41d4-a716-446655440000',
        schema: {
            type: 'string',
            format: 'uuid'
        }
    })
    @ApiQuery({
        name: 'token',
        required: true,
        description: 'Secure preview token (same as download token)',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        schema: {
            type: 'string',
            minLength: 20
        }
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'File preview loaded successfully',
        content: {
            'image/jpeg': {
                schema: {
                    type: 'string',
                    format: 'binary'
                },
                example: '[Image content displayed inline]'
            },
            'application/pdf': {
                schema: {
                    type: 'string',
                    format: 'binary'
                },
                example: '[PDF content displayed in browser]'
            },
            'text/plain': {
                schema: {
                    type: 'string'
                },
                example: 'File content as text...'
            }
        },
        headers: {
            'Content-Type': {
                description: 'Original file MIME type',
                schema: { type: 'string' }
            },
            'Content-Disposition': {
                description: 'Set to "inline" for browser display',
                schema: { type: 'string', example: 'inline' }
            },
            'Cache-Control': {
                description: 'Browser caching settings',
                schema: { type: 'string', example: 'private, max-age=3600' }
            }
        }
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
        summary: 'Get comprehensive file statistics',
        description: `
        Retrieve detailed file statistics for monitoring and administration.
        
        **Statistics Included:**
        - Total files count and storage usage
        - File type distribution
        - Average file sizes by category
        - Upload trends and patterns
        - Storage optimization opportunities
        
        **Admin Only:** This endpoint requires admin privileges.
        
        **Use Cases:**
        - System monitoring and reporting
        - Storage capacity planning
        - Usage analytics and insights
        - Performance optimization
        `,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'File statistics retrieved successfully',
        schema: {
            example: {
                totalFiles: 15420,
                totalSize: 8589934592, // bytes
                totalSizeFormatted: '8.0 GB',
                filesByType: {
                    'images': 8500,
                    'documents': 3200,
                    'videos': 2100,
                    'audio': 1200,
                    'archives': 420
                },
                avgFileSize: 557340, // bytes
                avgFileSizeFormatted: '544.3 KB',
                uploadTrends: {
                    today: 245,
                    thisWeek: 1680,
                    thisMonth: 6420
                },
                storageByType: {
                    'images': 2147483648,
                    'documents': 1073741824,
                    'videos': 4294967296,
                    'audio': 536870912,
                    'archives': 268435456
                }
            }
        }
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
     * Get file details by ID
     */
    @Get(':fileId')
    @ApiOperation({
        summary: 'Get file metadata and details',
        description: `
        Retrieve comprehensive file information by file ID.
        
        **Information Included:**
        - Basic metadata (name, size, type, upload date)
        - Upload statistics (download count, processing status)
        - Security information (virus scan status)
        - File relationships (linked messages, attachments)
        
        **Use Cases:**
        - Display file information in UI
        - Check file processing status
        - Verify file ownership and permissions
        - Get file statistics for analytics
        `,
    })
    @ApiParam({
        name: 'fileId',
        description: 'Unique file identifier (UUID format)',
        example: '550e8400-e29b-41d4-a716-446655440000',
        schema: {
            type: 'string',
            format: 'uuid',
            pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        }
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'File details retrieved successfully',
        type: FileDetailResponseDto,
        schema: {
            example: {
                success: true,
                data: {
                    fileId: '550e8400-e29b-41d4-a716-446655440000',
                    fileName: 'user_document_abc123.pdf',
                    originalName: 'my-document.pdf',
                    mimeType: 'application/pdf',
                    fileSize: 2048576,
                    uploadedBy: '123e4567-e89b-12d3-a456-426614174000',
                    uploadedAt: '2025-07-29T10:30:00.000Z',
                    downloadCount: 5,
                    isProcessed: true,
                    virusScanStatus: 'clean',
                    metadata: {
                        dimensions: null,
                        duration: null,
                        pages: 10,
                        author: 'John Doe'
                    }
                }
            }
        }
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'File not found',
        schema: {
            example: {
                success: false,
                error: 'File not found',
                message: 'The requested file does not exist or has been deleted'
            }
        }
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: 'Access denied to this file',
        schema: {
            example: {
                success: false,
                error: 'Access denied',
                message: 'You do not have permission to view this file'
            }
        }
    })
    async getFileDetails(
        @Param('fileId') fileId: string,
        @Request() req: AuthenticatedRequest,
    ): Promise<FileDetailResponseDto> {
        const file = await this.filesService.getFile(fileId, req.user.userId);

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
     * Health check endpoint for testing
     */
    @Get('admin/test')
    @ApiOperation({
        summary: 'Service health check',
        description: `
        Simple health check endpoint for testing service availability.
        
        **Purpose:**
        - Verify file service is running
        - Test API connectivity
        - Monitor service uptime
        - Basic smoke testing
        
        **Returns:**
        - Service status (healthy/unhealthy)
        - Current timestamp
        - Basic system information
        
        **Use Cases:**
        - Load balancer health checks
        - Monitoring system integration
        - CI/CD pipeline testing
        - Service discovery validation
        `,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'File service is healthy and operational',
        schema: {
            example: {
                status: 'healthy',
                timestamp: '2025-07-29T10:30:00.000Z',
                service: 'files-api',
                version: '1.0.0',
                uptime: 86400, // seconds
                environment: 'production'
            }
        }
    })
    async healthCheck(): Promise<{ status: string; timestamp: string }> {
        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
        };
    }
}
