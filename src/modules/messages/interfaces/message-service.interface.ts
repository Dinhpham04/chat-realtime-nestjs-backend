/**
 * Message Service Interface
 *
 * 🎯 Purpose: Define contract for message business logic operations
 * 📱 Mobile-First: Comprehensive message operations for real-time apps
 * 🚀 Clean Architecture: Service layer abstraction for dependency injection
 *
 * Design Principles:
 * - Single Responsibility: Only message business logic contract
 * - Interface Segregation: Focused service operations
 * - Dependency Inversion: Controllers depend on this abstraction
 * - DRY: Reuse DTOs and types for consistent interfaces
 */

import {
  CreateMessageDto,
  UpdateMessageDto,
  MessagePaginationDto,
  MessageSearchDto,
  UpdateMessageStatusDto,
  BulkMessageOperationDto,
  MessageResponseDto,
  PaginatedMessagesResponseDto,
  BulkOperationResponseDto
} from '../dto';

/**
 * Core Message Service Interface
 */

/**
 * User Context for Message Operations
 * Following Clean Architecture - minimal context for identity only
 * Authorization is handled by domain services, not pre-loaded here
 */
export interface UserContext {
  userId: string;
  deviceId?: string;
  roles?: string[];
}

export interface IMessageService {
  /**
   * Send a new message
   */
  sendMessage(
    dto: CreateMessageDto,
    userContext: UserContext
  ): Promise<MessageResponseDto>;

  /**
   * Edit an existing message
   */
  editMessage(
    messageId: string,
    dto: UpdateMessageDto,
    userContext: UserContext
  ): Promise<MessageResponseDto>;

  /**
   * Delete a message (soft delete)
   */
  deleteMessage(
    messageId: string,
    userContext: UserContext
  ): Promise<boolean>;

  /**
   * Get conversation messages with pagination
   */
  getConversationMessages(
    conversationId: string,
    pagination: MessagePaginationDto,
    userContext: UserContext
  ): Promise<PaginatedMessagesResponseDto>;

  /**
   * Mark message as read
   */
  markAsRead(
    messageId: string,
    userContext: UserContext
  ): Promise<boolean>;
}

/**
 * Extended Message Service Interface with advanced features
 */
export interface IExtendedMessageService extends IMessageService {
  /**
   * Search messages
   */
  searchMessages(
    conversationId: string,
    searchDto: MessageSearchDto,
    userContext: UserContext
  ): Promise<PaginatedMessagesResponseDto>;

  /**
   * Update message delivery status
   */
  updateMessageStatus(
    messageId: string,
    statusDto: UpdateMessageStatusDto,
    userContext: UserContext
  ): Promise<boolean>;

  /**
   * Bulk operations on messages
   */
  bulkOperation(
    dto: BulkMessageOperationDto,
    userContext: UserContext
  ): Promise<BulkOperationResponseDto>;

  /**
   * Forward message to other conversations
   */
  forwardMessage(
    messageId: string,
    conversationIds: string[],
    userContext: UserContext
  ): Promise<MessageResponseDto[]>;

  /**
   * Get message analytics for conversation
   */
  getMessageAnalytics(
    conversationId: string,
    userContext: UserContext
  ): Promise<{
    totalMessages: number;
    messagesPerDay: number;
    mostActiveUsers: Array<{ userId: string; messageCount: number }>;
    messageTypeDistribution: Record<string, number>;
  }>;
}

/**
 * Message Validation Service Interface
 */
export interface IMessageValidationService {
  /**
   * Validate send message DTO
   */
  validateSendMessage(dto: CreateMessageDto): Promise<void>;

  /**
   * Validate edit message DTO
   */
  validateEditMessage(
    messageType: string,
    dto: UpdateMessageDto
  ): Promise<void>;

  /**
   * Check if message type requires content
   */
  requiresContent(messageType: string): boolean;

  /**
   * Get maximum content size for message type
   */
  getMaxContentSize(messageType: string): number;
}
