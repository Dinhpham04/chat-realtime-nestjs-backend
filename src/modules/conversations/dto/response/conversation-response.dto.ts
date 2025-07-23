/**
 * Response DTOs for Conversations API
 * 
 * 🎯 Purpose: Standardized response structures
 * 📱 Mobile-First: Optimized response format for mobile clients
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// User summary for participant info
export class UserSummaryDto {
  @ApiProperty({ description: 'User unique identifier' })
  id: string;

  @ApiProperty({ description: 'Username' })
  username: string;

  @ApiProperty({ description: 'Full display name' })
  fullName: string;

  @ApiPropertyOptional({ description: 'Profile avatar URL' })
  avatarUrl?: string;

  @ApiProperty({ description: 'Whether user is currently online' })
  isOnline: boolean;

  @ApiPropertyOptional({ description: 'Last seen timestamp (ISO string)' })
  lastSeen?: string;
}

// Conversation basic info
export class ConversationSummaryDto {
  @ApiProperty({ description: 'Conversation unique identifier' })
  id: string;

  @ApiProperty({
    description: 'Type of conversation',
    enum: ['direct', 'group']
  })
  type: 'direct' | 'group';

  @ApiProperty({ description: 'Creation timestamp (ISO string)' })
  createdAt: string;

  @ApiProperty({ description: 'Last activity timestamp (ISO string)' })
  lastActivity: string;
}

// Prepare conversation response
export class PrepareConversationResponseDto {
  @ApiProperty({ description: 'Created/found conversation ID' })
  conversationId: string;

  @ApiProperty({ description: 'Whether conversation already existed' })
  exists: boolean;

  @ApiProperty({ description: 'Whether conversation is active (has messages)' })
  isActive: boolean;

  @ApiProperty({
    description: 'Information about the other participant',
    type: UserSummaryDto
  })
  participant: UserSummaryDto;

  @ApiProperty({
    description: 'Basic conversation information',
    type: ConversationSummaryDto
  })
  conversation: ConversationSummaryDto;
}

// Participant with role info
export class ParticipantResponseDto {
  @ApiProperty({ description: 'User ID of the participant' })
  userId: string;

  @ApiProperty({
    description: 'Role in conversation',
    enum: ['admin', 'member']
  })
  role: 'admin' | 'member';

  @ApiProperty({ description: 'When user joined conversation (ISO string)' })
  joinedAt: string;

  @ApiProperty({
    description: 'User information',
    type: UserSummaryDto
  })
  user: UserSummaryDto;
}

// Message summary for last message
export class MessageSummaryDto {
  @ApiProperty({ description: 'Message unique identifier' })
  id: string;

  @ApiProperty({ description: 'Message text content' })
  content: string;

  @ApiProperty({
    description: 'Type of message',
    enum: ['text', 'image', 'file', 'video', 'audio']
  })
  messageType: string;

  @ApiProperty({ description: 'ID of user who sent the message' })
  senderId: string;

  @ApiProperty({ description: 'Message creation timestamp (ISO string)' })
  createdAt: string;
}

// Full conversation details
export class ConversationResponseDto {
  @ApiProperty({ description: 'Conversation unique identifier' })
  id: string;

  @ApiProperty({
    description: 'Type of conversation',
    enum: ['direct', 'group']
  })
  type: 'direct' | 'group';

  @ApiProperty({
    description: 'List of conversation participants',
    type: [ParticipantResponseDto]
  })
  participants: ParticipantResponseDto[];

  @ApiProperty({ description: 'ID of user who created the conversation' })
  createdBy: string;

  @ApiProperty({ description: 'Creation timestamp (ISO string)' })
  createdAt: string;

  @ApiProperty({ description: 'Last update timestamp (ISO string)' })
  updatedAt: string;

  @ApiPropertyOptional({
    description: 'Last message in conversation',
    type: MessageSummaryDto
  })
  lastMessage?: MessageSummaryDto;

  @ApiProperty({ description: 'Whether conversation is active (has messages)' })
  isActive: boolean;

  @ApiProperty({ description: 'Number of unread messages for current user' })
  unreadCount: number;
}

// Mention data in message content
export class MentionResponseDto {
  @ApiProperty({ description: 'ID of mentioned user' })
  userId: string;

  @ApiProperty({ description: 'Username of mentioned user' })
  username: string;

  @ApiProperty({ description: 'Character offset where mention starts' })
  offset: number;

  @ApiProperty({ description: 'Length of mention text' })
  length: number;
}

// Message content structure
export class MessageContentResponseDto {
  @ApiProperty({ description: 'Text content of message' })
  text: string;

  @ApiPropertyOptional({
    description: 'User mentions in the message',
    type: [MentionResponseDto]
  })
  mentions?: MentionResponseDto[];
}

// Attachment data in message
export class AttachmentResponseDto {
  @ApiProperty({ description: 'Attachment unique identifier' })
  id: string;

  @ApiProperty({ description: 'File name on server' })
  fileName: string;

  @ApiProperty({ description: 'Original file name from user' })
  originalName: string;

  @ApiProperty({ description: 'MIME type of file' })
  mimeType: string;

  @ApiProperty({ description: 'File size in bytes' })
  fileSize: number;

  @ApiProperty({ description: 'URL to access the file' })
  url: string;
}

// Full message response
export class MessageResponseDto {
  @ApiProperty({ description: 'Message unique identifier' })
  id: string;

  @ApiProperty({ description: 'ID of conversation containing this message' })
  conversationId: string;

  @ApiProperty({ description: 'ID of user who sent the message' })
  senderId: string;

  @ApiProperty({
    description: 'Type of message',
    enum: ['text', 'image', 'file', 'video', 'audio']
  })
  messageType: 'text' | 'image' | 'file' | 'video' | 'audio';

  @ApiProperty({
    description: 'Message content with text and mentions',
    type: MessageContentResponseDto
  })
  content: MessageContentResponseDto;

  @ApiPropertyOptional({
    description: 'File attachments in message',
    type: [AttachmentResponseDto]
  })
  attachments?: AttachmentResponseDto[];

  @ApiProperty({ description: 'Message creation timestamp (ISO string)' })
  createdAt: string;

  @ApiProperty({ description: 'Message last update timestamp (ISO string)' })
  updatedAt: string;
}

// Activate conversation response
export class ActivateConversationResponseDto {
  @ApiProperty({
    description: 'Full conversation details after activation',
    type: ConversationResponseDto
  })
  conversation: ConversationResponseDto;

  @ApiProperty({
    description: 'The initial message that activated the conversation',
    type: MessageResponseDto
  })
  message: MessageResponseDto;

  @ApiProperty({
    description: 'Whether this was the first message (conversation activation)'
  })
  created: boolean;
}
