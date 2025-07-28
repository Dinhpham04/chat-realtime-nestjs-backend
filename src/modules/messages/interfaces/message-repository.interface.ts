/**
 * Message Repository Interface
 *
 * 🎯 Purpose: Define contract for message persistence operations
 * 📱 Mobile-First: Repository interface for real-time messaging
 * 🚀 Clean Architecture: Repository pattern abstraction layer
 *
 * Design Principles:
 * - Interface Segregation: Focused on message persistence only
 * - Dependency Inversion: Abstract repository interface  
 * - Single Responsibility: Data access operations for messages
 * - Performance: Optimized operations for mobile messaging
 */

import { MessageDocument } from '../schemas/message.schema';
import { Message } from '../schemas/message.schema';
import { PaginatedResponse, MessageFilter } from '../types';
import { MessageSearchDto } from '../dto';

export interface IMessageRepository {
  // =============== BASIC CRUD OPERATIONS ===============

  /**
   * Create a new message
   */
  create(data: Partial<Message>): Promise<MessageDocument>;

  /**
   * Find message by ID
   */
  findById(id: string): Promise<MessageDocument | null>;

  /**
   * Update message by ID
   */
  updateById(id: string, data: Partial<Message>): Promise<MessageDocument | null>;

  /**
   * Soft delete message
   */
  softDelete(id: string): Promise<boolean>;

  // =============== CONVERSATION OPERATIONS ===============

  /**
   * Find messages by conversation with pagination
   */
  findByConversationId(
    conversationId: string,
    pagination: {
      page?: number;
      limit?: number;
      cursor?: string;
    }
  ): Promise<PaginatedResponse<MessageDocument>>;

  /**
   * Count messages in conversation
   */
  countByConversationId(conversationId: string): Promise<number>;

  /**
   * Find latest message in conversation
   */
  findLatestInConversation(conversationId: string): Promise<MessageDocument | null>;

  // =============== STATUS OPERATIONS ===============

  /**
   * Mark message as read
   */
  markAsRead(messageId: string, userId: string): Promise<boolean>;

  /**
   * Update message status
   */
  updateStatus(messageId: string, status: string, timestamp?: Date): Promise<boolean>;

  // =============== SEARCH OPERATIONS ===============

  /**
   * Search messages in conversation
   */
  searchInConversation(
    conversationId: string,
    searchDto: MessageSearchDto
  ): Promise<PaginatedResponse<MessageDocument>>;

  /**
   * Find messages with filter
   */
  findWithFilter(filter: MessageFilter): Promise<MessageDocument[]>;

  // =============== BULK OPERATIONS ===============

  /**
   * Bulk mark messages as read
   */
  bulkMarkAsRead(messageIds: string[], userId: string): Promise<number>;

  /**
   * Bulk delete messages
   */
  bulkDelete(messageIds: string[]): Promise<number>;

  // =============== USER OPERATIONS ===============

  /**
   * Find unread messages for user
   */
  findUnreadByUser(userId: string): Promise<MessageDocument[]>;

  /**
   * Find messages by sender
   */
  findBySenderId(senderId: string, limit?: number): Promise<MessageDocument[]>;

  // =============== ANALYTICS OPERATIONS ===============

  /**
   * Get message analytics for conversation
   */
  getConversationAnalytics(conversationId: string): Promise<{
    totalMessages: number;
    messagesPerDay: number;
    mostActiveUsers: Array<{ userId: string; messageCount: number }>;
    messageTypeDistribution: Record<string, number>;
  }>;
}