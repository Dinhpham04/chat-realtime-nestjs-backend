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
  SendMessageDto,
  EditMessageDto,
  MessagePaginationDto,
  MessageSearchDto,
  UpdateMessageStatusDto,
  BulkMessageOperationDto,
  MessageResponse,
  PaginatedMessagesResponse,
  BulkOperationResponse
} from '../dto';

/**
 * Core Message Service Interface
 */

export interface UserContext {
  userId: string;
  deviceId?: string;
  conversationMemberships: string[]; // Conversation IDs user is member of
  roles?: string[];
}
export interface IMessageService {
  /**
   * Send a new message
   */
  sendMessage(
    dto: SendMessageDto,
    userContext: UserContext
  ): Promise<MessageResponse>;

  /**
   * Edit an existing message
   */
  editMessage(
    messageId: string,
    dto: EditMessageDto,
    userContext: UserContext
  ): Promise<MessageResponse>;

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
  ): Promise<PaginatedMessagesResponse>;

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
  ): Promise<PaginatedMessagesResponse>;

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
  ): Promise<BulkOperationResponse>;

  /**
   * Forward message to other conversations
   */
  forwardMessage(
    messageId: string,
    conversationIds: string[],
    userContext: UserContext
  ): Promise<MessageResponse[]>;

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
  validateSendMessage(dto: SendMessageDto): Promise<void>;

  /**
   * Validate edit message DTO
   */
  validateEditMessage(
    messageType: string,
    dto: EditMessageDto
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
