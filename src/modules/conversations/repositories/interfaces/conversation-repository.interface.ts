/**
 * ConversationRepository Interface
 * 
 * 🎯 Purpose: Define contract for conversation data access layer
 * 📱 Mobile-First: Optimized for real-time chat operations
 * 🚀 Clean Architecture: Repository pattern with interface segregation
 * 
 * Features:
 * - CRUD operations for conversations
 * - Participant management
 * - Search and filtering
 * - Performance optimizations
 */

import { Types } from 'mongoose';
import {
  ConversationType,
  UserConversationStatus,
  ParticipantRole,
  CreateConversationData,
  UpdateConversationData,
  ConversationQuery,
  ConversationWithParticipants,
  ConversationListItem,
  ParticipantData,
  ConversationSearchOptions,
} from '../../types/conversation.types';

export interface IConversationRepository {
  // =============== CORE CRUD OPERATIONS ===============

  /**
   * Create new conversation
   */
  create(data: CreateConversationData): Promise<ConversationWithParticipants>;

  /**
   * Find conversation by ID with participants populated
   */
  findByIdWithParticipants(conversationId: string): Promise<ConversationWithParticipants | null>;

  /**
   * Find conversation by ID (basic info only)
   */
  findById(conversationId: string): Promise<ConversationWithParticipants | null>;

  /**
   * Update conversation metadata
   */
  updateById(conversationId: string, updateData: UpdateConversationData): Promise<ConversationWithParticipants | null>;

  /**
   * Soft delete conversation (archive)
   */
  softDeleteById(conversationId: string): Promise<boolean>;

  /**
   * Permanently delete conversation (admin only)
   */
  deleteById(conversationId: string): Promise<boolean>;

  // =============== CONVERSATION QUERIES ===============

  /**
   * Find user's conversations with pagination and filtering
   */
  findUserConversations(
    userId: string,
    query: ConversationQuery
  ): Promise<{
    conversations: ConversationListItem[];
    total: number;
    hasMore: boolean;
  }>;

  /**
   * Check if direct conversation exists between users
   */
  findDirectConversationByParticipants(
    userId1: string,
    userId2: string
  ): Promise<ConversationWithParticipants | null>;

  /**
   * Find conversations by participant IDs (for group check)
   */
  findByParticipants(participantIds: string[]): Promise<ConversationWithParticipants[]>;

  /**
   * Search conversations by name or content
   */
  searchConversations(
    userId: string,
    searchOptions: ConversationSearchOptions
  ): Promise<{
    conversations: ConversationListItem[];
    total: number;
  }>;

  /**
   * Get conversation statistics for user
   */
  getUserConversationStats(userId: string): Promise<{
    totalConversations: number;
    activeConversations: number;
    archivedConversations: number;
    groupConversations: number;
    directConversations: number;
  }>;

  // =============== PARTICIPANT MANAGEMENT ===============

  /**
   * Add participants to conversation
   */
  addParticipants(
    conversationId: string,
    participants: ParticipantData[]
  ): Promise<{
    added: ParticipantData[];
    failed: { userId: string; reason: string }[];
  }>;

  /**
   * Remove participant from conversation
   */
  removeParticipant(conversationId: string, userId: string): Promise<boolean>;

  /**
   * Update participant role
   */
  updateParticipantRole(
    conversationId: string,
    userId: string,
    role: ParticipantRole
  ): Promise<boolean>;

  /**
   * Check if user is participant in conversation
   */
  isUserParticipant(conversationId: string, userId: string): Promise<boolean>;

  /**
   * Get user's role in conversation
   */
  getUserRole(conversationId: string, userId: string): Promise<ParticipantRole | null>;

  /**
   * Get conversation participants with pagination
   */
  getParticipants(
    conversationId: string,
    options: {
      limit?: number;
      offset?: number;
      role?: ParticipantRole;
    }
  ): Promise<{
    participants: ParticipantData[];
    total: number;
  }>;

  // =============== CONVERSATION UPDATES ===============

  /**
   * Update last message in conversation
   */
  updateLastMessage(
    conversationId: string,
    messageData: {
      messageId: string;
      content: string;
      senderId: string;
      messageType: string;
      timestamp: Date;
    }
  ): Promise<boolean>;

  /**
   * Update conversation status (archive, pin, mute)
   */
  updateConversationStatus(
    conversationId: string,
    userId: string,
    status: Partial<UserConversationStatus>
  ): Promise<boolean>;

  /**
   * Increment unread count for participants (except sender)
   */
  incrementUnreadCount(conversationId: string, excludeUserId: string): Promise<boolean>;

  /**
   * Reset unread count for user
   */
  resetUnreadCount(conversationId: string, userId: string): Promise<boolean>;

  /**
   * Update conversation activity timestamp
   */
  updateLastActivity(conversationId: string): Promise<boolean>;

  // =============== BULK OPERATIONS ===============

  /**
   * Mark multiple conversations as read for user
   */
  markMultipleAsRead(conversationIds: string[], userId: string): Promise<number>;

  /**
   * Archive multiple conversations for user
   */
  archiveMultiple(conversationIds: string[], userId: string): Promise<number>;

  /**
   * Get multiple conversations by IDs
   */
  findByIds(conversationIds: string[]): Promise<ConversationWithParticipants[]>;

  // =============== AGGREGATION QUERIES ===============

  /**
   * Get conversation metrics for analytics
   */
  getConversationMetrics(
    conversationId: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<{
    messageCount: number;
    participantCount: number;
    averageResponseTime: number;
    activeParticipants: number;
  }>;

  /**
   * Get user's conversation activity summary
   */
  getUserActivitySummary(
    userId: string,
    period: 'day' | 'week' | 'month'
  ): Promise<{
    totalMessages: number;
    activeConversations: number;
    newConversations: number;
    averageResponseTime: number;
  }>;

  // =============== TRANSACTION SUPPORT ===============

  /**
   * Execute operations within a database transaction
   */
  withTransaction<T>(operation: () => Promise<T>): Promise<T>;
}
