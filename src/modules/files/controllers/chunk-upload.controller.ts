import {
    Controller,
    Post,
    Get,
    Delete,
    Param,
    Body,
    UseInterceptors,
    UploadedFile,
    HttpStatus,
    HttpCode,
    UseGuards,
    Request,
    Logger,
    BadRequestException,
    Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { Express } from 'express';
import { ChunkUploadService } from '../services/chunk-upload.service';
import { FilesService } from '../services/files.service';
import {
    InitiateUploadDto,
    CompleteUploadDto,
} from '../dto/file.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FILE_CONSTANTS } from '../constants/file.constants';
import * as crypto from 'crypto';

interface AuthenticatedRequest extends Request {
    user: {
        id: string;
        email: string;
    };
}

/**
 * Chunk upload controller for large file uploads (Zalo-style)
 * Handles chunked uploads with resume capability and integrity verification
 */
@ApiTags('Chunk Upload')
@Controller('files/chunk-upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChunkUploadController {
    private readonly logger = new Logger(ChunkUploadController.name);

    constructor(
        private readonly chunkUploadService: ChunkUploadService,
        private readonly filesService: FilesService,
    ) { }

    /**
     * Initiate a chunked upload session
     * For files larger than 10MB
     */
    @Post('initiate')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Initiate chunk upload',
        description: 'Start a chunked upload session for large files (>10MB like Zalo)',
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Chunk upload session initiated successfully',
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'File too small for chunk upload or validation failed',
    })
    async initiateUpload(
        @Body() uploadData: InitiateUploadDto,
        @Request() req: AuthenticatedRequest,
    ): Promise<{
        success: boolean;
        data: {
            uploadId: string;
            fileName: string;
            totalSize: number;
            mimeType: string;
            totalChunks: number;
            chunkSize: number;
            expiresAt: string;
        };
    }> {
        this.logger.log(`Initiating chunk upload: ${uploadData.fileName} by user ${req.user.id}`);

        const uploadInfo = await this.chunkUploadService.initiateChunkUpload(
            uploadData.fileName,
            uploadData.fileSize,
            uploadData.mimeType,
            req.user.id,
        );

        const expiresAt = new Date(Date.now() + FILE_CONSTANTS.UPLOAD_SESSION_TTL * 1000).toISOString();

        return {
            success: true,
            data: {
                ...uploadInfo,
                expiresAt,
            },
        };
    }

    /**
     * Upload a single chunk
     */
    @Post(':uploadId/chunk/:chunkNumber')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Upload chunk',
        description: 'Upload a single chunk of a file with integrity verification',
    })
    @ApiConsumes('multipart/form-data')
    @ApiParam({
        name: 'uploadId',
        description: 'Upload session ID',
    })
    @ApiParam({
        name: 'chunkNumber',
        description: 'Chunk number (0-based)',
        type: 'number',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Chunk uploaded successfully',
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid chunk or checksum mismatch',
    })
    @UseInterceptors(
        FileInterceptor('chunk', {
            limits: {
                fileSize: FILE_CONSTANTS.CHUNK_SIZE + 1024, // Allow small buffer for chunk size
            },
        }),
    )
    async uploadChunk(
        @Param('uploadId') uploadId: string,
        @Param('chunkNumber') chunkNumber: string,
        @UploadedFile() chunkFile: Express.Multer.File,
        @Body('checksum') checksum: string,
        @Request() req: AuthenticatedRequest,
    ): Promise<{
        success: boolean;
        data: {
            uploadId: string;
            chunkNumber: number;
            totalChunks: number;
            completedChunks: number;
            percentage: number;
            isComplete: boolean;
            failedChunks: number[];
        };
    }> {
        if (!chunkFile) {
            throw new BadRequestException('No chunk file provided');
        }

        if (!checksum) {
            throw new BadRequestException('Chunk checksum is required');
        }

        const chunkNum = parseInt(chunkNumber, 10);
        if (isNaN(chunkNum) || chunkNum < 0) {
            throw new BadRequestException('Invalid chunk number');
        }

        // Verify client-provided checksum
        const actualChecksum = crypto.createHash('sha256').update(chunkFile.buffer).digest('hex');
        if (actualChecksum !== checksum) {
            throw new BadRequestException('Chunk checksum verification failed');
        }

        this.logger.log(`Uploading chunk ${chunkNum} for session ${uploadId}`);

        const progress = await this.chunkUploadService.uploadChunk(
            uploadId,
            chunkNum,
            chunkFile.buffer,
            checksum,
            req.user.id,
        );

        return {
            success: true,
            data: {
                uploadId: progress.uploadId,
                chunkNumber: chunkNum,
                totalChunks: progress.totalChunks,
                completedChunks: progress.completedChunks,
                percentage: progress.percentage,
                isComplete: progress.isComplete,
                failedChunks: progress.failedChunks,
            },
        };
    }

    /**
     * Complete chunked upload
     */
    @Post(':uploadId/complete')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Complete chunk upload',
        description: 'Finalize chunked upload by assembling all chunks into final file',
    })
    @ApiParam({
        name: 'uploadId',
        description: 'Upload session ID',
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Chunked upload completed successfully',
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Missing chunks or assembly failed',
    })
    async completeUpload(
        @Param('uploadId') uploadId: string,
        @Body() completeData: CompleteUploadDto,
        @Request() req: AuthenticatedRequest,
    ): Promise<{
        success: boolean;
        message: string;
        data: {
            fileId: string;
            fileName: string;
            fileSize: number;
            mimeType: string;
            downloadUrl: string;
            uploadedAt: string;
        };
    }> {
        this.logger.log(`Completing chunk upload for session ${uploadId}`);

        // Complete chunk upload (assemble chunks)
        const assemblyResult = await this.chunkUploadService.completeChunkUpload(
            uploadId,
            completeData.checksum,
            req.user.id,
        );

        // Create file record in database
        const fileInfo = {
            originalName: assemblyResult.fileName,
            mimeType: assemblyResult.mimeType,
            size: assemblyResult.fileSize,
            buffer: undefined, // File already uploaded to storage
        };

        // Note: We'll need to modify FilesService to handle pre-uploaded files
        // For now, return the assembly result
        return {
            success: true,
            message: 'Chunked upload completed successfully',
            data: {
                fileId: assemblyResult.fileId,
                fileName: assemblyResult.fileName,
                fileSize: assemblyResult.fileSize,
                mimeType: assemblyResult.mimeType,
                downloadUrl: assemblyResult.downloadUrl,
                uploadedAt: new Date().toISOString(),
            },
        };
    }

    /**
     * Get upload progress
     */
    @Get(':uploadId/progress')
    @ApiOperation({
        summary: 'Get upload progress',
        description: 'Check the progress of a chunked upload session',
    })
    @ApiParam({
        name: 'uploadId',
        description: 'Upload session ID',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Upload progress retrieved successfully',
    })
    async getUploadProgress(
        @Param('uploadId') uploadId: string,
        @Request() req: AuthenticatedRequest,
    ): Promise<{
        success: boolean;
        data: {
            uploadId: string;
            totalChunks: number;
            completedChunks: number;
            percentage: number;
            isComplete: boolean;
            failedChunks: number[];
        };
    }> {
        const progress = await this.chunkUploadService.getUploadProgress(uploadId, req.user.id);

        return {
            success: true,
            data: progress,
        };
    }

    /**
     * Get failed chunks for retry
     */
    @Get(':uploadId/failed-chunks')
    @ApiOperation({
        summary: 'Get failed chunks',
        description: 'Get list of chunks that failed to upload for retry',
    })
    @ApiParam({
        name: 'uploadId',
        description: 'Upload session ID',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Failed chunks list retrieved successfully',
    })
    async getFailedChunks(
        @Param('uploadId') uploadId: string,
        @Request() req: AuthenticatedRequest,
    ): Promise<{
        success: boolean;
        data: {
            uploadId: string;
            failedChunks: number[];
            totalChunks: number;
        };
    }> {
        const progress = await this.chunkUploadService.getUploadProgress(uploadId, req.user.id);

        return {
            success: true,
            data: {
                uploadId: progress.uploadId,
                failedChunks: progress.failedChunks,
                totalChunks: progress.totalChunks,
            },
        };
    }

    /**
     * Cancel upload session
     */
    @Delete(':uploadId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Cancel upload',
        description: 'Cancel a chunked upload session and cleanup uploaded chunks',
    })
    @ApiParam({
        name: 'uploadId',
        description: 'Upload session ID',
    })
    @ApiResponse({
        status: HttpStatus.NO_CONTENT,
        description: 'Upload cancelled successfully',
    })
    async cancelUpload(
        @Param('uploadId') uploadId: string,
        @Request() req: AuthenticatedRequest,
    ): Promise<void> {
        this.logger.log(`Cancelling upload session ${uploadId} by user ${req.user.id}`);
        await this.chunkUploadService.cancelUpload(uploadId, req.user.id);
    }

    /**
     * Get user's active upload sessions
     */
    @Get('sessions')
    @ApiOperation({
        summary: 'Get upload sessions',
        description: 'Get user\'s active upload sessions for resume capability',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Upload sessions retrieved successfully',
    })
    async getUploadSessions(
        @Request() req: AuthenticatedRequest,
        @Query('status') status?: string,
    ): Promise<{
        success: boolean;
        data: Array<{
            uploadId: string;
            fileName: string;
            totalSize: number;
            mimeType: string;
            status: string;
            progress: number;
            createdAt: string;
            expiresAt: string;
        }>;
    }> {
        // This would require a method in ChunkUploadService to get user sessions
        // For now, return empty array
        return {
            success: true,
            data: [],
        };
    }

    /**
     * Health check for chunk upload service
     */
    @Get('health')
    @ApiOperation({
        summary: 'Chunk upload health check',
        description: 'Check if chunk upload service is available',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Chunk upload service is healthy',
    })
    async healthCheck(): Promise<{
        status: string;
        maxFileSize: number;
        chunkSize: number;
        maxChunks: number;
        timestamp: string;
    }> {
        return {
            status: 'healthy',
            maxFileSize: FILE_CONSTANTS.GLOBAL_MAX_FILE_SIZE,
            chunkSize: FILE_CONSTANTS.CHUNK_SIZE,
            maxChunks: 1000,
            timestamp: new Date().toISOString(),
        };
    }
}
