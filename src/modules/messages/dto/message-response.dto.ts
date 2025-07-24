/**
 * Message Response DTOs
 * 
 * 🎯 Purpose: Standardized response formats for message operations
 * 📱 Mobile-First: Optimized response structure for mobile clients
 * 🚀 Clean Architecture: Consistent API responses
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType, MessageStatus, SystemMessageType } from '../types/message.types';

/**
 * Message Content Response (varies by message type)
 */
export class MessageContentResponse {
  @ApiPropertyOptional({
    description: 'Text content for text messages',
    example: 'Hello, how are you?'
  })
  text?: string;

  @ApiPropertyOptional({
    description: 'Location data for location messages'
  })
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };

  @ApiPropertyOptional({
    description: 'Media data for image/video/audio messages'
  })
  media?: {
    url: string;
    filename?: string;
    size?: number;
    duration?: number;
    thumbnailUrl?: string;
  };

  @ApiPropertyOptional({
    description: 'File data for file messages'
  })
  file?: {
    url: string;
    filename: string;
    size: number;
    mimeType?: string;
    thumbnailUrl?: string;
  };

  @ApiPropertyOptional({
    description: 'System message data'
  })
  system?: {
    type: SystemMessageType;
    data: Record<string, any>;
  };
}

/**
 * Message Sender Response
 */
export class MessageSenderResponse {
  @ApiProperty({
    description: 'Sender user ID',
    example: '507f1f77bcf86cd799439013'
  })
  id: string;

  @ApiPropertyOptional({
    description: 'Sender display name',
    example: 'John Doe'
  })
  name?: string;

  @ApiPropertyOptional({
    description: 'Sender avatar URL',
    example: 'https://storage.example.com/avatars/john.jpg'
  })
  avatar?: string;
}

/**
 * Message Reply Response
 */
export class MessageReplyResponse {
  @ApiProperty({
    description: 'Original message ID',
    example: '507f1f77bcf86cd799439012'
  })
  id: string;

  @ApiProperty({
    description: 'Original message content (truncated)',
    example: 'This is the original message...'
  })
  content: string;

  @ApiProperty({
    description: 'Original message type',
    enum: MessageType,
    example: MessageType.TEXT
  })
  messageType: MessageType;

  @ApiProperty({
    description: 'Original message sender'
  })
  sender: MessageSenderResponse;

  @ApiProperty({
    description: 'Original message timestamp',
    example: '2024-01-15T10:30:00.000Z'
  })
  createdAt: string;
}

/**
 * Message Reaction Response
 */
export class MessageReactionResponse {
  @ApiProperty({
    description: 'Reaction emoji',
    example: '👍'
  })
  emoji: string;

  @ApiProperty({
    description: 'Number of users who reacted',
    example: 5
  })
  count: number;

  @ApiProperty({
    description: 'Users who reacted (limited list)',
    isArray: true
  })
  users: MessageSenderResponse[];

  @ApiProperty({
    description: 'Whether current user has this reaction',
    example: true
  })
  hasReacted: boolean;
}

/**
 * Complete Message Response
 */
export class MessageResponse {
  @ApiProperty({
    description: 'Message ID',
    example: '507f1f77bcf86cd799439011'
  })
  id: string;

  @ApiProperty({
    description: 'Conversation ID',
    example: '507f1f77bcf86cd799439010'
  })
  conversationId: string;

  @ApiProperty({
    description: 'Message sender information'
  })
  sender: MessageSenderResponse;

  @ApiProperty({
    description: 'Message type',
    enum: MessageType,
    example: MessageType.TEXT
  })
  messageType: MessageType;

  @ApiProperty({
    description: 'Message content based on type'
  })
  content: MessageContentResponse;

  @ApiPropertyOptional({
    description: 'Reply information if this is a reply message'
  })
  replyTo?: MessageReplyResponse;

  @ApiPropertyOptional({
    description: 'Users mentioned in this message',
    isArray: true
  })
  mentions?: MessageSenderResponse[];

  @ApiPropertyOptional({
    description: 'Message reactions',
    isArray: true
  })
  reactions?: MessageReactionResponse[];

  @ApiProperty({
    description: 'Message creation timestamp',
    example: '2024-01-15T10:30:00.000Z'
  })
  createdAt: string;

  @ApiPropertyOptional({
    description: 'Message last edit timestamp',
    example: '2024-01-15T10:35:00.000Z'
  })
  updatedAt?: string;

  @ApiProperty({
    description: 'Whether message has been edited',
    example: false
  })
  isEdited: boolean;

  @ApiProperty({
    description: 'Whether message has been deleted',
    example: false
  })
  isDeleted: boolean;

  @ApiProperty({
    description: 'Current user message status',
    enum: MessageStatus,
    example: MessageStatus.READ
  })
  status: MessageStatus;

  @ApiPropertyOptional({
    description: 'Client-side message ID for deduplication',
    example: 'client_msg_12345'
  })
  clientMessageId?: string;
}

/**
 * Paginated Messages Response
 */
export class PaginatedMessagesResponse {
  @ApiProperty({
    description: 'Array of messages',
    isArray: true,
    type: MessageResponse
  })
  messages: MessageResponse[];

  @ApiProperty({
    description: 'Pagination information'
  })
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
    totalCount?: number;
  };

  @ApiProperty({
    description: 'Response metadata'
  })
  meta: {
    conversationId: string;
    requestedAt: string;
    responseTime: number;
  };
}

/**
 * Bulk Operation Response
 */
export class BulkOperationResponse {
  @ApiProperty({
    description: 'Number of messages successfully processed',
    example: 5
  })
  successCount: number;

  @ApiProperty({
    description: 'Number of messages that failed to process',
    example: 0
  })
  failureCount: number;

  @ApiProperty({
    description: 'Array of successful message IDs',
    isArray: true,
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
  })
  successful: string[];

  @ApiProperty({
    description: 'Array of failed operations with reasons',
    isArray: true
  })
  failed: Array<{
    messageId: string;
    reason: string;
  }>;

  @ApiProperty({
    description: 'Operation execution timestamp',
    example: '2024-01-15T10:30:00.000Z'
  })
  executedAt: string;
}
