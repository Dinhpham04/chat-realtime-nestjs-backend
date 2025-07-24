/**
 * Send Message DTO
 * 
 * 🎯 Purpose: Validation for sending new messages
 * 📱 Mobile-First: Support for various message types
 * 🚀 Clean Architecture: Input validation with class-validator
 * 
 * Design Principles:
 * - Single Responsibility: Only message sending validation
 * - DRY: Reuse types from message.types.ts
 * - Security: Input sanitization and validation
 * - User Experience: Clear validation error messages
 */

import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
  IsObject,
  IsNumber,
  Min,
  Max,
  Matches
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '../types/message.types';

/**
 * Text Content DTO for text messages
 */
export class TextContentDto {
  @ApiProperty({
    description: 'Text content of the message',
    example: 'Hello, how are you?',
    maxLength: 10000
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000, { message: 'Text content cannot exceed 10,000 characters' })
  @Transform(({ value }) => value?.trim())
  text: string;
}

/**
 * Location Content DTO for location messages
 */
export class LocationContentDto {
  @ApiProperty({
    description: 'Latitude coordinate',
    example: 21.0285,
    minimum: -90,
    maximum: 90
  })
  @IsNumber()
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  latitude: number;

  @ApiProperty({
    description: 'Longitude coordinate',
    example: 105.8542,
    minimum: -180,
    maximum: 180
  })
  @IsNumber()
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  longitude: number;

  @ApiPropertyOptional({
    description: 'Address or place name',
    example: 'Hanoi, Vietnam'
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  address?: string;
}

/**
 * Media Content DTO for image/video/audio messages
 */
export class MediaContentDto {
  @ApiProperty({
    description: 'Media file URL or identifier',
    example: 'https://storage.example.com/images/abc123.jpg'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  url: string;

  @ApiPropertyOptional({
    description: 'Original filename',
    example: 'vacation_photo.jpg'
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  filename?: string;

  @ApiPropertyOptional({
    description: 'File size in bytes',
    example: 1024000
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100 * 1024 * 1024) // 100MB limit
  size?: number;

  @ApiPropertyOptional({
    description: 'Media duration in seconds (for video/audio)',
    example: 30
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(3600) // 1 hour limit
  duration?: number;
}

/**
 * File Content DTO for file messages
 */
export class FileContentDto {
  @ApiProperty({
    description: 'File URL or identifier',
    example: 'https://storage.example.com/files/document.pdf'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  url: string;

  @ApiProperty({
    description: 'Original filename',
    example: 'important_document.pdf'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 2048000
  })
  @IsNumber()
  @Min(1)
  @Max(100 * 1024 * 1024) // 100MB limit
  size: number;

  @ApiPropertyOptional({
    description: 'MIME type',
    example: 'application/pdf'
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  mimeType?: string;
}

/**
 * Main Send Message DTO
 */
export class SendMessageDto {
  @ApiProperty({
    description: 'Conversation ID where the message will be sent',
    example: '507f1f77bcf86cd799439011'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'Invalid conversation ID format' })
  conversationId: string;

  @ApiProperty({
    description: 'Type of message being sent',
    enum: MessageType,
    example: MessageType.TEXT
  })
  @IsEnum(MessageType, { message: 'Invalid message type' })
  messageType: MessageType;

  @ApiPropertyOptional({
    description: 'Message content based on message type',
    oneOf: [
      { $ref: '#/components/schemas/TextContentDto' },
      { $ref: '#/components/schemas/LocationContentDto' },
      { $ref: '#/components/schemas/MediaContentDto' },
      { $ref: '#/components/schemas/FileContentDto' }
    ]
  })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => Object) // Will be validated in service layer based on messageType
  content?: TextContentDto | LocationContentDto | MediaContentDto | FileContentDto;

  @ApiPropertyOptional({
    description: 'ID of message being replied to',
    example: '507f1f77bcf86cd799439012'
  })
  @IsString()
  @IsOptional()
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'Invalid reply message ID format' })
  replyTo?: string;

  @ApiPropertyOptional({
    description: 'Array of user IDs being mentioned',
    example: ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014']
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @Matches(/^[0-9a-fA-F]{24}$/, { each: true, message: 'Invalid user ID format in mentions' })
  mentions?: string[];

  @ApiPropertyOptional({
    description: 'Temporary client-side message ID for deduplication',
    example: 'client_msg_12345'
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  clientMessageId?: string;
}
