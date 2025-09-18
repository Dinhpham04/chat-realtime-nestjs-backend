import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt, Min, Max, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * Conversation Files DTOs
 * 
 * 🎯 Purpose: DTOs for conversation files/media endpoints
 * 📱 Mobile-First: Optimized for mobile file galleries
 * 🚀 Clean Architecture: Proper validation and documentation
 */

/**
 * File type enum for filtering
 */
export enum ConversationFileType {
    ALL = 'all',
    IMAGE = 'image',
    VIDEO = 'video',
    AUDIO = 'audio',
    DOCUMENT = 'document',
    OTHER = 'other'
}

/**
 * Sort options for conversation files
 */
export enum ConversationFileSortBy {
    NEWEST = 'newest',
    OLDEST = 'oldest',
    SIZE_DESC = 'size_desc',
    SIZE_ASC = 'size_asc',
    NAME_ASC = 'name_asc',
    NAME_DESC = 'name_desc'
}

/**
 * Query DTO for getting conversation files
 */
export class ConversationFilesQueryDto {
    @ApiPropertyOptional({
        description: 'Page number (1-based)',
        minimum: 1,
        default: 1,
        example: 1
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({
        description: 'Number of files per page',
        minimum: 1,
        maximum: 100,
        default: 20,
        example: 20
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @ApiPropertyOptional({
        description: 'Filter by file type',
        enum: ConversationFileType,
        default: ConversationFileType.ALL,
        example: ConversationFileType.IMAGE
    })
    @IsOptional()
    @IsEnum(ConversationFileType)
    fileType?: ConversationFileType = ConversationFileType.ALL;

    @ApiPropertyOptional({
        description: 'Sort files by',
        enum: ConversationFileSortBy,
        default: ConversationFileSortBy.NEWEST,
        example: ConversationFileSortBy.NEWEST
    })
    @IsOptional()
    @IsEnum(ConversationFileSortBy)
    sortBy?: ConversationFileSortBy = ConversationFileSortBy.NEWEST;

    @ApiPropertyOptional({
        description: 'Search files by name',
        example: 'document.pdf'
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => value?.trim())
    search?: string;

    @ApiPropertyOptional({
        description: 'Minimum file size in bytes',
        minimum: 0,
        example: 1024
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    minSize?: number;

    @ApiPropertyOptional({
        description: 'Maximum file size in bytes',
        minimum: 1,
        example: 10485760
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    maxSize?: number;
}

/**
 * File information in conversation
 */
export class ConversationFileDto {
    @ApiProperty({
        description: 'File ID',
        example: '507f1f77bcf86cd799439011'
    })
    id: string;

    @ApiProperty({
        description: 'Message ID containing this file',
        example: '507f1f77bcf86cd799439012'
    })
    messageId: string;

    @ApiProperty({
        description: 'Original file name',
        example: 'vacation-photo.jpg'
    })
    originalName: string;

    @ApiProperty({
        description: 'File name on server',
        example: '2025-09-04_507f1f77bcf86cd799439011.jpg'
    })
    fileName: string;

    @ApiProperty({
        description: 'MIME type of the file',
        example: 'image/jpeg'
    })
    mimeType: string;

    @ApiProperty({
        description: 'File size in bytes',
        example: 2048576
    })
    fileSize: number;

    @ApiProperty({
        description: 'File type category',
        enum: ConversationFileType,
        example: ConversationFileType.IMAGE
    })
    fileType: ConversationFileType;

    @ApiProperty({
        description: 'URL to access the file',
        example: 'https://api.example.com/files/download/507f1f77bcf86cd799439011'
    })
    fileUrl: string;

    @ApiPropertyOptional({
        description: 'Thumbnail URL for images/videos',
        example: 'https://api.example.com/files/thumbnail/507f1f77bcf86cd799439011'
    })
    thumbnailUrl?: string;

    @ApiProperty({
        description: 'User who uploaded the file',
        type: Object,
        example: {
            id: '507f1f77bcf86cd799439013',
            fullName: 'Nguyen Van A',
            avatarUrl: 'https://example.com/avatar.jpg'
        }
    })
    uploadedBy: {
        id: string;
        fullName: string;
        avatarUrl?: string;
    };

    @ApiProperty({
        description: 'Upload timestamp',
        example: '2025-09-04T10:30:00.000Z'
    })
    uploadedAt: Date;

    @ApiProperty({
        description: 'Message timestamp (when file was shared)',
        example: '2025-09-04T10:30:00.000Z'
    })
    messageTimestamp: Date;

    @ApiPropertyOptional({
        description: 'Message content/caption with the file',
        example: 'Check out this amazing sunset!'
    })
    messageContent?: string;

    @ApiPropertyOptional({
        description: 'Download count',
        example: 5
    })
    downloadCount?: number;

    @ApiPropertyOptional({
        description: 'Additional metadata for media files',
        type: Object,
        example: {
            width: 1920,
            height: 1080,
            duration: 120
        }
    })
    metadata?: {
        width?: number;
        height?: number;
        duration?: number;
        [key: string]: any;
    };
}

/**
 * Response DTO for conversation files
 */
export class ConversationFilesResponseDto {
    @ApiProperty({
        description: 'List of files in the conversation',
        type: [ConversationFileDto]
    })
    files: ConversationFileDto[];

    @ApiProperty({
        description: 'Total number of files matching the filter',
        example: 150
    })
    total: number;

    @ApiProperty({
        description: 'Current page number',
        example: 1
    })
    page: number;

    @ApiProperty({
        description: 'Number of files per page',
        example: 20
    })
    limit: number;

    @ApiProperty({
        description: 'Total number of pages',
        example: 8
    })
    totalPages: number;

    @ApiProperty({
        description: 'Whether there are more files available',
        example: true
    })
    hasNextPage: boolean;

    @ApiProperty({
        description: 'Whether there are previous files available',
        example: false
    })
    hasPreviousPage: boolean;

    @ApiProperty({
        description: 'File type distribution in conversation',
        type: Object,
        example: {
            image: 45,
            video: 12,
            audio: 8,
            document: 25,
            other: 10
        }
    })
    fileTypeStats: Record<string, number>;

    @ApiProperty({
        description: 'Total storage used by files in bytes',
        example: 157286400
    })
    totalStorageUsed: number;
}

/**
 * File statistics for conversation
 */
export class ConversationFileStatsDto {
    @ApiProperty({
        description: 'Total number of files',
        example: 150
    })
    totalFiles: number;

    @ApiProperty({
        description: 'Total storage used in bytes',
        example: 157286400
    })
    totalStorageUsed: number;

    @ApiProperty({
        description: 'File count by type',
        type: Object,
        example: {
            image: 45,
            video: 12,
            audio: 8,
            document: 25,
            other: 10
        }
    })
    fileTypeDistribution: Record<string, number>;

    @ApiProperty({
        description: 'Storage used by file type in bytes',
        type: Object,
        example: {
            image: 89478485,
            video: 52428800,
            audio: 8388608,
            document: 5242880,
            other: 1048576
        }
    })
    storageByFileType: Record<string, number>;

    @ApiProperty({
        description: 'Most active uploaders',
        type: Array,
        example: [
            {
                userId: '507f1f77bcf86cd799439013',
                fullName: 'Nguyen Van A',
                fileCount: 25,
                storageUsed: 34567890
            }
        ]
    })
    topUploaders: Array<{
        userId: string;
        fullName: string;
        fileCount: number;
        storageUsed: number;
    }>;
}