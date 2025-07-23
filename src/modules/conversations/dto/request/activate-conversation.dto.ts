/**
 * Activate Conversation DTO
 * 
 * 🎯 Purpose: Input validation for activate conversation endpoint
 * 📱 Mobile-First: Complex validation for first message with attachments
 */

import {
  IsNotEmpty,
  IsString,
  IsMongoId,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  MaxLength,
  IsNumber,
  Min,
  Max
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Mention data for @user mentions
export class MentionDto {
  @ApiProperty({ description: 'User ID being mentioned' })
  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  userId: string;

  @ApiProperty({ description: 'Username for display' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  username: string;

  @ApiProperty({ description: 'Character offset in text where mention starts' })
  @IsNumber()
  @Min(0)
  offset: number;

  @ApiProperty({ description: 'Length of the mention text' })
  @IsNumber()
  @Min(1)
  @Max(100)
  length: number;
}

// Message content structure
export class MessageContentDto {
  @ApiProperty({
    description: 'Text content of the message',
    example: 'Hello! How are you?',
    maxLength: 4000
  })
  @IsNotEmpty({ message: 'Message text is required' })
  @IsString({ message: 'Message text must be a string' })
  @MaxLength(4000, { message: 'Message text cannot exceed 4000 characters' })
  text: string;

  @ApiPropertyOptional({
    description: 'Array of user mentions in the message',
    type: [MentionDto]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MentionDto)
  mentions?: MentionDto[];
}

// Attachment data structure
export class AttachmentDto {
  @ApiProperty({ description: 'File name on server' })
  @IsNotEmpty()
  @IsString()
  fileName: string;

  @ApiProperty({ description: 'Original file name from user' })
  @IsNotEmpty()
  @IsString()
  originalName: string;

  @ApiProperty({ description: 'MIME type of the file' })
  @IsNotEmpty()
  @IsString()
  mimeType: string;

  @ApiProperty({ description: 'File size in bytes' })
  @IsNumber()
  @Min(1)
  @Max(100 * 1024 * 1024) // Max 100MB
  fileSize: number;

  @ApiProperty({ description: 'URL to access the file' })
  @IsNotEmpty()
  @IsString()
  url: string;
}

// Message metadata
export class MessageMetadataDto {
  @ApiPropertyOptional({
    description: 'Platform where message was sent from',
    enum: ['ios', 'android', 'web']
  })
  @IsOptional()
  @IsString()
  @IsEnum(['ios', 'android', 'web'])
  platform?: 'ios' | 'android' | 'web';

  @ApiPropertyOptional({ description: 'Device information' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  deviceInfo?: string;
}

// Initial message data structure
export class InitialMessageDto {
  @ApiProperty({
    description: 'Message content with text and mentions',
    type: MessageContentDto
  })
  @ValidateNested()
  @Type(() => MessageContentDto)
  content: MessageContentDto;

  @ApiPropertyOptional({
    description: 'File attachments (max 10 files)',
    type: [AttachmentDto],
    maxItems: 10
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  @ApiPropertyOptional({
    description: 'Type of message',
    enum: ['text', 'image', 'file', 'video', 'audio'],
    default: 'text'
  })
  @IsOptional()
  @IsString()
  @IsEnum(['text', 'image', 'file', 'video', 'audio'])
  messageType?: 'text' | 'image' | 'file' | 'video' | 'audio';

  @ApiPropertyOptional({
    description: 'Additional metadata about the message',
    type: MessageMetadataDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MessageMetadataDto)
  metadata?: MessageMetadataDto;
}

// Main DTO for activate conversation
export class ActivateConversationDto {
  @ApiProperty({
    description: 'ID of the conversation to activate',
    example: '64f1a2b3c4d5e6f7a8b9c0d1'
  })
  @IsNotEmpty({ message: 'Conversation ID is required' })
  @IsString({ message: 'Conversation ID must be a string' })
  @IsMongoId({ message: 'Conversation ID must be a valid MongoDB ObjectId' })
  conversationId: string;

  @ApiProperty({
    description: 'Initial message to send and activate the conversation',
    type: InitialMessageDto
  })
  @ValidateNested()
  @Type(() => InitialMessageDto)
  initialMessage: InitialMessageDto;
}
