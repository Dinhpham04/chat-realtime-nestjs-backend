import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, IsArray, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for single file upload (no additional metadata needed - handled by multer)
 * Following file.schema.ts requirements
 */
export class UploadSingleFileDto {
    @ApiProperty({
        description: 'File to upload',
        type: 'string',
        format: 'binary',
        required: true
    })
    file: any; // This is handled by multer, not validated here
}

/**
 * DTO for file metadata (auto-generated from uploaded file)
 * Based on file.schema.ts structure
 */
export class FileMetadataDto {
    @ApiProperty({ description: 'Original filename from user' })
    originalFilename: string;

    @ApiProperty({ description: 'System-generated filename' })
    fileName: string;

    @ApiProperty({ description: 'MIME type of the file' })
    mimeType: string;

    @ApiProperty({ description: 'File size in bytes' })
    fileSize: number;

    @ApiProperty({ description: 'SHA-256 checksum for deduplication' })
    checksum: string;

    @ApiProperty({ description: 'Storage path' })
    storagePath: string;

    @ApiProperty({ description: 'User ID who uploaded the file' })
    uploadedBy: string;

    @ApiProperty({ description: 'Processing status', default: false })
    isProcessed: boolean;

    @ApiProperty({ description: 'Virus scan status', default: 'pending' })
    virusScanStatus: string;

    @ApiProperty({ description: 'Soft delete status', default: true })
    isActive: boolean;

    @ApiProperty({ description: 'Download count', default: 0 })
    downloadCount: number;

    @ApiProperty({ description: 'Optional file metadata', required: false })
    metadata?: {
        width?: number;
        height?: number;
        duration?: number;
        compression?: string;
        encoding?: string;
    };
}

export class InitiateUploadDto {
    @IsNotEmpty()
    @IsString()
    fileName: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(1)
    @Max(100 * 1024 * 1024) // 100MB max
    fileSize: number;

    @IsNotEmpty()
    @IsString()
    mimeType: string;
}

export class CompleteUploadDto {
    @IsNotEmpty()
    @IsString()
    uploadId: string;

    @IsOptional()
    @IsString()
    checksum?: string;
}

export class LinkFileToMessageDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty({ description: 'Message ID to link the file to' })
    messageId: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'Optional caption for the file attachment' })
    caption?: string;
}

export class GetUserFilesDto {
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    @Min(0)
    skip?: number = 0;

    @IsOptional()
    @IsEnum(['createdAt', 'fileName', 'fileSize'])
    sortBy?: string = 'createdAt';

    @IsOptional()
    @IsEnum(['asc', 'desc'])
    sortOrder?: 'asc' | 'desc' = 'desc';

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    mimeTypes?: string[];
}

export class GenerateDownloadUrlDto {
    @IsOptional()
    @IsNumber()
    @Min(300) // 5 minutes min
    @Max(86400) // 24 hours max
    @ApiProperty({ description: 'Token expiration time in seconds', default: 3600 })
    expiresIn?: number = 3600; // 1 hour default

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(100)
    @ApiProperty({ description: 'Maximum number of downloads allowed', required: false })
    maxDownloads?: number;
}

// Response DTOs
export class UploadResponseDto {
    @ApiProperty()
    success: boolean;

    @ApiProperty()
    message: string;

    @ApiProperty()
    data: {
        fileId: string;
        fileName: string;
        originalName: string;
        fileSize: number;
        mimeType: string;
        downloadUrl: string;
        thumbnailUrl?: string;
        isNew: boolean;
        uploadedAt: string;
    };
}

export class FileDetailResponseDto {
    @ApiProperty()
    success: boolean;

    @ApiProperty()
    data: {
        fileId: string;
        fileName: string;
        originalName: string;
        mimeType: string;
        fileSize: number;
        uploadedBy: string;
        uploadedAt: string;
        downloadCount: number;
        isProcessed: boolean;
        virusScanStatus: string;
        metadata?: any;
    };
}

export class UserFilesResponseDto {
    @ApiProperty()
    success: boolean;

    @ApiProperty()
    data: {
        files: Array<{
            fileId: string;
            fileName: string;
            originalName: string;
            mimeType: string;
            fileSize: number;
            uploadedAt: string;
            downloadCount: number;
            isProcessed: boolean;
        }>;
        pagination: {
            total: number;
            limit: number;
            skip: number;
            hasMore: boolean;
        };
    };
}
