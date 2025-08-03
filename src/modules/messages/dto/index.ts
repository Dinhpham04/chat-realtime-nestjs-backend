import { IsString, IsNotEmpty, IsEnum, IsOptional, IsArray, ValidateNested, IsUUID, IsDateString, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Message DTOs - Clean Architecture Compliant
 * 
 * 🎯 Purpose: Data validation và transfer objects cho messaging
 * 📱 Mobile-First: Optimized for real-time messaging apps
 * 🔒 Security: Strong validation với class-validator
 */

// =============== ENUMS ===============

export enum MessageType {
    TEXT = 'text',
    IMAGE = 'image',
    VIDEO = 'video',
    AUDIO = 'audio',
    FILE = 'file',
    LOCATION = 'location',
    CONTACT = 'contact',
    STICKER = 'sticker',
    SYSTEM = 'system',
    // DOCUMENT = 'document',
}

export enum MessageStatus {
    SENDING = 'sending',     // Client is sending
    SENT = 'sent',          // Server received  
    DELIVERED = 'delivered', // Delivered to device
    READ = 'read',          // User has seen it
    FAILED = 'failed'       // Send failed
}

// =============== CORE DTOS ===============

/**
 * Create Message DTO - For Socket.IO and REST API
 */
export class CreateMessageDto {
    @ApiProperty({ description: 'Client-generated local ID for optimistic UI' })
    @IsOptional()
    @IsString()
    localId?: string;

    @ApiProperty({ description: 'Conversation ID where message belongs' })
    @IsNotEmpty()
    @IsString()
    conversationId: string;

    @ApiProperty({ description: 'Message content (can be null for file-only messages)' })
    @IsOptional()
    @IsString()
    content?: string;

    @ApiProperty({
        enum: MessageType,
        description: 'Type of message',
        default: MessageType.TEXT
    })
    @IsEnum(MessageType)
    @IsOptional()
    type?: MessageType = MessageType.TEXT;

    @ApiPropertyOptional({ description: 'File attachments', type: [Object] })
    @IsOptional()
    @IsArray()
    attachments?: MessageAttachmentDto[];

    @ApiPropertyOptional({ description: 'Reply to message ID' })
    @IsOptional()
    @IsString()
    replyToMessageId?: string;

    @ApiPropertyOptional({ description: 'Mentioned user IDs' })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    mentions?: string[];
}

/**
 * Message Attachment DTO
 */
export class MessageAttachmentDto {
    @ApiProperty({ description: 'File ID from upload service' })
    @IsNotEmpty()
    @IsString()
    fileId: string;

    @ApiProperty({ description: 'Original filename' })
    @IsNotEmpty()
    @IsString()
    fileName: string;

    @ApiProperty({ description: 'File MIME type' })
    @IsNotEmpty()
    @IsString()
    mimeType: string;

    @ApiProperty({ description: 'File size in bytes' })
    @IsNotEmpty()
    fileSize: number;

    @ApiPropertyOptional({ description: 'Thumbnail URL for images/videos' })
    @IsOptional()
    @IsString()
    thumbnailUrl?: string;

    @ApiPropertyOptional({ description: 'Download URL' })
    @IsOptional()
    @IsString()
    downloadUrl?: string;
}

/**
 * Send Message Response DTO
 */
export class SendMessageResponseDto {
    @ApiProperty({ description: 'Client local ID echoed back' })
    localId?: string;

    @ApiProperty({ description: 'Server-generated message ID' })
    serverId: string;

    @ApiProperty({ description: 'Server timestamp' })
    timestamp: number;

    @ApiProperty({ enum: ['received', 'failed'] })
    status: 'received' | 'failed';

    @ApiPropertyOptional({ description: 'Error message if failed' })
    error?: string;

    @ApiPropertyOptional({ description: 'Processing time in ms' })
    processingTime?: number;
}

/**
 * Update Message DTO
 */
export class UpdateMessageDto {
    @ApiPropertyOptional({ description: 'Updated content' })
    @IsOptional()
    @IsString()
    content?: string;

    @ApiPropertyOptional({ description: 'Updated attachments' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MessageAttachmentDto)
    attachments?: MessageAttachmentDto[];
}

/**
 * Message Response DTO - For API responses
 */
export class MessageResponseDto {
    @ApiProperty({ description: 'Message ID' })
    id: string;

    @ApiProperty({ description: 'Conversation ID' })
    conversationId: string;

    @ApiProperty({ description: 'Sender ID' })
    senderId: string;

    @ApiProperty({ description: 'Sender info' })
    sender?: {
        id: string;
        username: string;
        fullName: string;
        avatarUrl?: string;
        isOnline?: boolean;
        lastSeen?: Date;
    } | null;;

    @ApiProperty({ description: 'Message content' })
    content?: string;

    @ApiProperty({ enum: MessageType })
    type: MessageType;

    @ApiProperty({ description: 'File attachments', type: [MessageAttachmentDto] })
    attachments?: MessageAttachmentDto[];

    @ApiPropertyOptional({ description: 'Reply to message' })
    replyTo?: {
        messageId: string;
        content: string;
        senderId: string;
        senderName: string;
    };

    @ApiPropertyOptional({ description: 'Mentioned users' })
    mentions?: string[];

    @ApiProperty({ description: 'Creation timestamp' })
    createdAt: Date;

    @ApiProperty({ description: 'Last update timestamp' })
    updatedAt: Date;

    @ApiPropertyOptional({ description: 'Message status for current user' })
    status?: MessageStatus;

    @ApiPropertyOptional({ description: 'Delivery info' })
    delivery?: {
        delivered: number;
        read: number;
        total: number;
    };
}

// =============== SOCKET.IO SPECIFIC DTOS ===============

/**
 * Socket.IO Send Message DTO
 */
export class SocketSendMessageDto {
    @IsNotEmpty()
    @IsString()
    localId: string;

    @IsNotEmpty()
    @IsString()
    conversationId: string;

    @IsOptional()
    @IsString()
    content?: string;

    @IsEnum(MessageType)
    @IsOptional()
    type?: MessageType = MessageType.TEXT;

    @IsOptional()
    @IsArray()
    attachments?: MessageAttachmentDto[];

    @IsNotEmpty()
    timestamp: number;
}

/**
 * Message Delivery DTO
 */
export class MessageDeliveryDto {
    @IsNotEmpty()
    @IsString()
    messageId: string;

    @IsNotEmpty()
    @IsString()
    conversationId: string;

    @IsNotEmpty()
    @IsString()
    userId: string;

    @IsNotEmpty()
    deliveredAt: number;
}

/**
 * Read Receipt DTO
 */
export class ReadReceiptDto {
    @IsNotEmpty()
    @IsString()
    conversationId: string;

    @IsNotEmpty()
    @IsArray()
    @IsString({ each: true })
    messageIds: string[];

    @IsNotEmpty()
    @IsString()
    userId: string;

    @IsNotEmpty()
    readAt: number;
}

// =============== QUERY DTOS ===============

/**
 * Message Pagination DTO
 */
export class MessagePaginationDto {
    @ApiPropertyOptional({ description: 'Page number', default: 1 })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    page?: number = 1;

    @ApiPropertyOptional({ description: 'Items per page', default: 20, maximum: 100 })
    @IsOptional()
    @Transform(({ value }) => Math.min(parseInt(value), 100))
    limit?: number = 20;

    @ApiPropertyOptional({ description: 'Cursor for pagination (message ID)' })
    @IsOptional()
    @IsString()
    cursor?: string;

    @ApiPropertyOptional({ description: 'Message ID to load around' })
    @IsOptional()
    @IsString()
    around?: string;
}

/**
 * Message Search DTO
 */
export class MessageSearchDto {
    @ApiProperty({ description: 'Search query' })
    @IsNotEmpty()
    @IsString()
    query: string;

    @ApiPropertyOptional({ description: 'Search in specific conversation' })
    @IsOptional()
    @IsString()
    conversationId?: string;

    @ApiPropertyOptional({ description: 'Filter by message type' })
    @IsOptional()
    @IsEnum(MessageType)
    type?: MessageType;

    @ApiPropertyOptional({ description: 'Filter by sender ID' })
    @IsOptional()
    @IsString()
    senderId?: string;

    @ApiPropertyOptional({ description: 'Search from date' })
    @IsOptional()
    @IsDateString()
    fromDate?: string;

    @ApiPropertyOptional({ description: 'Search to date' })
    @IsOptional()
    @IsDateString()
    toDate?: string;
}

// =============== BULK OPERATIONS ===============

/**
 * Bulk Message Operation DTO
 */
export class BulkMessageOperationDto {
    @ApiProperty({ description: 'Message IDs to operate on' })
    @IsNotEmpty()
    @IsArray()
    @IsString({ each: true })
    messageIds: string[];

    @ApiProperty({ enum: ['delete', 'mark_read', 'mark_unread'] })
    @IsEnum(['delete', 'mark_read', 'mark_unread'])
    operation: 'delete' | 'mark_read' | 'mark_unread';
}

/**
 * Update Message Status DTO
 */
export class UpdateMessageStatusDto {
    @ApiProperty({ description: 'Message IDs' })
    @IsNotEmpty()
    @IsArray()
    @IsString({ each: true })
    messageIds: string[];

    @ApiProperty({ enum: MessageStatus })
    @IsEnum(MessageStatus)
    status: MessageStatus;

    @ApiPropertyOptional({ description: 'User ID (for delivery/read status)' })
    @IsOptional()
    @IsString()
    userId?: string;

    @ApiPropertyOptional({ description: 'Device ID' })
    @IsOptional()
    @IsString()
    deviceId?: string;
}

// =============== RESPONSE DTOS ===============

/**
 * Paginated Messages Response DTO
 */
export class PaginatedMessagesResponseDto {
    @ApiProperty({ type: [MessageResponseDto] })
    messages: MessageResponseDto[];

    @ApiProperty({ description: 'Pagination info' })
    pagination: {
        page: number;
        limit: number;
        total: number;
        hasNext: boolean;
        hasPrev: boolean;
        nextCursor?: string;
        prevCursor?: string;
    };
}

/**
 * Bulk Operation Response DTO
 */
export class BulkOperationResponseDto {
    @ApiProperty({ description: 'Number of successfully processed messages' })
    successCount: number;

    @ApiProperty({ description: 'Number of failed operations' })
    failureCount: number;

    @ApiProperty({ description: 'List of failed message IDs' })
    failures: string[];

    @ApiProperty({ description: 'Operation type performed' })
    operation: string;
}
