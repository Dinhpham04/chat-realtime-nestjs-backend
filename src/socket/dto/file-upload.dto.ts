import { IsString, IsNumber, IsOptional, IsNotEmpty, MinLength, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for initiating file upload
 */
export class InitiateUploadDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  fileName: string;

  @IsNumber()
  @Min(1)
  fileSize: number;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsOptional()
  @IsNumber()
  @Min(1024) // Minimum 1KB chunk size
  chunkSize?: number;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsString()
  @IsNotEmpty()
  uploadId: string; // Client-generated ID for tracking
}

/**
 * DTO for uploading file chunk
 */
export class UploadChunkDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsNumber()
  @Min(0)
  chunkIndex: number;

  @IsString()
  @IsNotEmpty()
  chunkData: string; // Base64 encoded chunk data

  @IsString()
  @IsNotEmpty()
  uploadId: string;
}

/**
 * DTO for completing upload
 */
export class CompleteUploadDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  uploadId: string;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsOptional()
  @IsString()
  conversationId?: string;
}

/**
 * DTO for cancelling upload
 */
export class CancelUploadDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  uploadId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * DTO for small file upload
 */
export class UploadSmallFileDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  fileName: string;

  @IsNumber()
  @Min(1)
  fileSize: number;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsString()
  @IsNotEmpty()
  fileData: string; // Base64 encoded file data

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsString()
  @IsNotEmpty()
  uploadId: string;
}

/**
 * DTO for getting upload progress
 */
export class UploadProgressDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  uploadId: string;
}

/**
 * DTO for ping health check
 */
export class PingDto {
  @IsNumber()
  @Min(0)
  timestamp: number;
}
