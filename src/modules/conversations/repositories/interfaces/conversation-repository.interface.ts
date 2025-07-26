/**
 * Minimal ConversationRepository Interface - Only Used Methods
 * 
 * 🎯 Purpose: Essential conversation data access operations
 * 📱 Mobile-First: Optimized for current API implementation
 * 🚀 Clean Architecture: Repository pattern with minimal interface
 */

import {
  ConversationType,
  ParticipantRole,
  CreateConversationData,
  UpdateConversationData,
  ConversationQuery,
  ConversationWithParticipants,
  ConversationListItem,
  ParticipantData,
  AddParticipantData,
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
   * Find conversation by ID (basic info only - alias for findByIdWithParticipants)
   */
  findById(conversationId: string): Promise<ConversationWithParticipants | null>;

  /**
   * Update conversation metadata
   */
  updateById(conversationId: string, updateData: UpdateConversationData): Promise<ConversationWithParticipants | null>;

  /**
   * Soft delete conversation (set isActive = false)
   */
  softDeleteById(conversationId: string): Promise<boolean>;

  // =============== CONVERSATION QUERIES ===============

  /**
   * Get user's conversations with pagination and filtering
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
   * Find direct conversation between two users
   */
  findDirectConversationByParticipants(
    userId1: string,
    userId2: string
  ): Promise<ConversationWithParticipants | null>;

  // =============== PARTICIPANT MANAGEMENT ===============

  /**
   * Add participants to conversation
   */
  addParticipants(
    conversationId: string,
    participants: AddParticipantData[]
  ): Promise<{
    added: ParticipantData[];
    failed: { userId: string; reason: string }[];
  }>;

  /**
   * Check if user is participant of conversation
   */
  isUserParticipant(conversationId: string, userId: string): Promise<boolean>;

  /**
   * Get user's role in conversation
   */
  getUserRole(conversationId: string, userId: string): Promise<ParticipantRole | null>;

  /**
   * Update participant role
   */
  updateParticipantRole(
    conversationId: string,
    userId: string,
    newRole: ParticipantRole
  ): Promise<boolean>;

  /**
   * Remove participant from conversation
   */
  removeParticipant(conversationId: string, userId: string): Promise<boolean>;

  /**
   * Get participants count
   */
  getParticipantsCount(conversationId: string): Promise<number>;

  /**
   * Count admins in conversation
   */
  countAdmins(conversationId: string): Promise<number>;

  // =============== CONVERSATION UPDATES ===============

  /**
   * Update last message info when new message is sent
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
   * Update last activity timestamp
   */
  updateLastActivity(conversationId: string): Promise<boolean>;
}
