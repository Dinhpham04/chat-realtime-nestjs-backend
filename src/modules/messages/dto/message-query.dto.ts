/**
 * Message Query & Pagination DTOs
 * 
 * 🎯 Purpose: Validation for message queries and search
 * 📱 Mobile-First: Optimized pagination for mobile clients
 * 🚀 Clean Architecture: Consistent query patterns
 */

import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  IsArray,
  Min,
  Max,
  Matches
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType, MessageStatus } from '../types/message.types';

/**
 * Pagination DTO for message lists
 */
export class MessagePaginationDto {
  @ApiPropertyOptional({
    description: 'Cursor for pagination (message ID)',
    example: '507f1f77bcf86cd799439011'
  })
  @IsString()
  @IsOptional()
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'Invalid cursor format' })
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of messages to return',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Sort direction (desc for newest first, asc for oldest first)',
    example: 'desc',
    enum: ['asc', 'desc'],
    default: 'desc'
  })
  @IsString()
  @IsOptional()
  @IsEnum(['asc', 'desc'], { message: 'Sort direction must be asc or desc' })
  sortDirection?: 'asc' | 'desc' = 'desc';
}

/**
 * Message Search DTO
 */
export class MessageSearchDto extends MessagePaginationDto {
  @ApiPropertyOptional({
    description: 'Search query text',
    example: 'hello world'
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  query?: string;

  @ApiPropertyOptional({
    description: 'Filter by message types',
    example: [MessageType.TEXT, MessageType.IMAGE],
    isArray: true,
    enum: MessageType
  })
  @IsArray()
  @IsOptional()
  @IsEnum(MessageType, { each: true, message: 'Invalid message type in filter' })
  messageTypes?: MessageType[];

  @ApiPropertyOptional({
    description: 'Filter by sender ID',
    example: '507f1f77bcf86cd799439013'
  })
  @IsString()
  @IsOptional()
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'Invalid sender ID format' })
  senderId?: string;

  @ApiPropertyOptional({
    description: 'Filter messages from this date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z'
  })
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter messages to this date (ISO 8601)',
    example: '2024-12-31T23:59:59.999Z'
  })
  @IsDateString()
  @IsOptional()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Include deleted messages in search',
    example: false,
    default: false
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  includeDeleted?: boolean = false;

  @ApiPropertyOptional({
    description: 'Search only in messages with attachments',
    example: false,
    default: false
  })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  hasAttachments?: boolean = false;
}

/**
 * Message Status Update DTO
 */
export class UpdateMessageStatusDto {
  @ApiPropertyOptional({
    description: 'New message status',
    enum: MessageStatus,
    example: MessageStatus.READ
  })
  @IsEnum(MessageStatus, { message: 'Invalid message status' })
  status: MessageStatus;

  @ApiPropertyOptional({
    description: 'Device ID for status tracking',
    example: 'device_12345'
  })
  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'Invalid device ID format' })
  deviceId?: string;
}

/**
 * Bulk Message Operation DTO
 */
export class BulkMessageOperationDto {
  @ApiPropertyOptional({
    description: 'Array of message IDs to operate on',
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
  })
  @IsArray()
  @IsString({ each: true })
  @Matches(/^[0-9a-fA-F]{24}$/, { each: true, message: 'Invalid message ID format' })
  messageIds: string[];

  @ApiPropertyOptional({
    description: 'Operation to perform',
    example: 'delete',
    enum: ['delete', 'mark_read', 'mark_unread']
  })
  @IsString()
  @IsEnum(['delete', 'mark_read', 'mark_unread'], {
    message: 'Invalid operation. Must be delete, mark_read, or mark_unread'
  })
  operation: 'delete' | 'mark_read' | 'mark_unread';
}
