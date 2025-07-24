/**
 * Message Repository Interface
 * 
 * 🎯 Purpose: Define contract for message data operations
 * 📱 Mobile-First: Optimized for real-time messaging performance
 * 🚀 Clean Architecture: Repository pattern with dependency inversion
 * 
 * Design Principles:
 * - Single Responsibility: Only message data operations
 * - Interface Segregation: Focused on message domain
 * - Dependency Inversion: Services depend on abstraction, not implementation
 * - DRY: Reuse types from message.types.ts (Single Source of Truth)
 */

import { Types } from 'mongoose';
import { Message, MessageStatus } from '../schemas';
import {
  // Core interfaces from message.types.ts
  CreateMessageData,
  UpdateMessageData,
  MessageQuery,
  MessagePaginationOptions,
  MessageListResponse,
  MessageWithDetails,
  MessageSearchOptions,
  MessageDeliveryStatus,
  MessageStatus as MessageStatusEnum,
  MessageDeliverySummary,
  MessageStatusUpdate,
  MessageListItem
} from '../types/message.types';

// =============== REPOSITORY-SPECIFIC TYPES ===============
// Only define types that are specific to repository layer and not in message.types.ts

/**
 * Repository pagination params (extends base MessagePaginationOptions)
 */
export interface RepositoryPaginationParams extends MessagePaginationOptions {
  cursor?: string; // Add cursor support
  sortDirection?: 'asc' | 'desc'; // Add sort direction
  includeDeleted?: boolean;
  includeSystemMessages?: boolean;
}

/**
 * Repository search query (extends MessageSearchOptions)
 */
export interface RepositorySearchQuery extends MessageSearchOptions {
  conversationId?: string; // Add conversation context
  includeDeleted?: boolean;
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  cursor?: string; // Add cursor for pagination
  fromDate?: Date; // Add date filters
  toDate?: Date;
  hasAttachments?: boolean; // Add attachment filter
  sortDirection?: 'asc' | 'desc'; // Add sort direction
}

/**
 * Bulk operation result (Repository specific)
 */
export interface BulkOperationResult {
  success: boolean;
  modifiedCount: number;
  errors?: string[];
}

/**
 * Message with attachments (for future Files integration)
 * Uses MessageWithDetails as base but with repository-specific extensions
 */
export interface MessageWithAttachments extends MessageWithDetails {
  // Will be extended when Files module is integrated
}

// =============== REPOSITORY INTERFACE ===============

/**
 * Message Repository Interface
 * 
 * Core Responsibilities:
 * 1. CRUD Operations - Basic message management
 * 2. Conversation Queries - Get messages by conversation
 * 3. Search & Filter - Advanced query operations
 * 4. Status Management - Delivery and read status
 * 5. Bulk Operations - Performance optimizations
 * 
 * Uses types from message.types.ts (Single Source of Truth)
 */
export interface IMessageRepository {
  // =============== CRUD OPERATIONS ===============

  /**
   * Create new message
   * @param messageData Message creation data from message.types.ts
   * @returns Created message
   * @throws RepositoryError if creation fails
   */
  create(messageData: CreateMessageData): Promise<Message>;

  /**
   * Find message by ID
   * @param messageId Message identifier
   * @returns Message or null if not found
   */
  findById(messageId: string): Promise<Message | null>;

  /**
   * Update message by ID
   * @param messageId Message identifier
   * @param updateData Fields to update from message.types.ts
   * @returns Updated message
   * @throws RepositoryError if message not found or update fails
   */
  update(messageId: string, updateData: UpdateMessageData): Promise<Message>;

  /**
   * Soft delete message (mark as deleted)
   * @param messageId Message identifier
   * @returns Success status
   */
  softDelete(messageId: string): Promise<boolean>;

  /**
   * Hard delete message (permanent removal)
   * @param messageId Message identifier
   * @returns Success status
   */
  hardDelete(messageId: string): Promise<boolean>;

  // =============== CONVERSATION QUERIES ===============

  /**
   * Find messages by conversation with pagination
   * Uses MessageListResponse from message.types.ts
   * @param conversationId Conversation identifier
   * @param options Pagination options from message.types.ts
   * @returns Paginated messages
   */
  findByConversation(
    conversationId: string,
    options: RepositoryPaginationParams
  ): Promise<MessageListResponse>;

  /**
   * Get latest message in conversation
   * @param conversationId Conversation identifier
   * @returns Latest message or null
   */
  getLatestMessage(conversationId: string): Promise<Message | null>;

  /**
   * Count messages in conversation
   * @param conversationId Conversation identifier
   * @param includeDeleted Include soft-deleted messages
   * @returns Message count
   */
  countByConversation(conversationId: string, includeDeleted?: boolean): Promise<number>;

  // =============== ADVANCED QUERIES ===============

  /**
   * Find message with attachments (for future Files integration)
   * Uses MessageWithDetails from message.types.ts
   * @param messageId Message identifier
   * @returns Message with populated attachments
   */
  findWithAttachments(messageId: string): Promise<MessageWithAttachments | null>;

  /**
   * Find replies to a message
   * @param parentMessageId Parent message identifier
   * @returns Array of reply messages
   */
  findReplies(parentMessageId: string): Promise<Message[]>;

  /**
   * Search messages with filters
   * Uses RepositorySearchQuery (extends MessageSearchOptions)
   * @param query Search parameters
   * @returns Paginated search results
   */
  searchMessages(query: RepositorySearchQuery): Promise<MessageListResponse>;

  /**
   * Find messages by sender
   * @param senderId Sender identifier
   * @param options Pagination parameters
   * @returns Paginated messages using MessageListResponse
   */
  findBySender(senderId: string, options: RepositoryPaginationParams): Promise<MessageListResponse>;

  // =============== STATUS OPERATIONS ===============

  /**
   * Update message delivery status
   * Uses MessageDeliveryStatus from message.types.ts
   * @param messageId Message identifier
   * @param userId User identifier
   * @param status Delivery status from message.types.ts
   * @param deviceId Optional device identifier
   * @returns Success status
   */
  updateDeliveryStatus(
    messageId: string,
    userId: string,
    status: MessageDeliveryStatus,
    deviceId?: string
  ): Promise<boolean>;

  /**
   * Get message status for user
   * @param messageId Message identifier
   * @param userId User identifier
   * @returns Message status or null
   */
  getMessageStatus(messageId: string, userId: string): Promise<MessageStatus | null>;

  /**
   * Get all statuses for a message
   * @param messageId Message identifier
   * @returns Array of message statuses
   */
  getAllMessageStatuses(messageId: string): Promise<MessageStatus[]>;

  /**
   * Mark multiple messages as read for user
   * Uses MessageStatusUpdate from message.types.ts
   * @param messageIds Array of message identifiers
   * @param userId User identifier
   * @returns Bulk operation result
   */
  markMultipleAsRead(messageIds: string[], userId: string): Promise<BulkOperationResult>;

  // =============== BULK OPERATIONS ===============

  /**
   * Create multiple messages (for system messages, imports)
   * @param messagesData Array of message creation data
   * @returns Array of created messages
   */
  createMultiple(messagesData: CreateMessageData[]): Promise<Message[]>;

  /**
   * Soft delete multiple messages
   * @param messageIds Array of message identifiers
   * @returns Bulk operation result
   */
  softDeleteMultiple(messageIds: string[]): Promise<BulkOperationResult>;

  /**
   * Update multiple messages
   * @param updates Array of {messageId, updateData}
   * @returns Bulk operation result
   */
  updateMultiple(updates: Array<{ messageId: string; updateData: UpdateMessageData }>): Promise<BulkOperationResult>;

  // =============== ANALYTICS & REPORTING ===============

  /**
   * Get message statistics for conversation
   * @param conversationId Conversation identifier
   * @param dateFrom Optional start date
   * @param dateTo Optional end date
   * @returns Message statistics
   */
  getConversationStats(
    conversationId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{
    totalMessages: number;
    messagesByType: Record<string, number>;
    messagesBySender: Record<string, number>;
    deletedMessages: number;
  }>;

  /**
   * Get user messaging activity
   * Uses patterns from MessageDeliverySummary type structure
   * @param userId User identifier
   * @param dateFrom Optional start date
   * @param dateTo Optional end date
   * @returns User activity statistics
   */
  getUserActivity(
    userId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{
    messagesSent: number;
    conversationsActive: number;
    averageMessagesPerDay: number;
  }>;
}
