/**
 * Conversations Service Interface
 * 
 * 🎯 Purpose: Define contract for conversation business logic
 * 📱 Mobile-First: Optimized for real-time chat operations
 * 🚀 Clean Architecture: Service layer interface
 */

import { Types } from 'mongoose';
import { ConversationType, ConversationWithParticipants, ParticipantRole } from '../../types/conversation.types';

export interface CreateDirectConversationResult {
  conversationId: string;
  exists: boolean;
  isActive: boolean;
  participant: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
    isOnline: boolean;
    lastSeen?: string;
  };
  conversation?: {
    id: string;
    type: 'direct' | 'group';
    createdAt: string;
    lastActivity: string;
  };
}

export interface ConversationInfo {
  id: string;
  type: ConversationType
  name: string;
  description?: string;
  createdBy?: string;
  memberNumbers?: number;
  avatarUrl?: string;
  memberAvatarUrls?: string[];
}

export interface IConversationsService {
  /**
   * Prepare conversation for direct messaging
   * Called when user clicks on contact in contact list
   */
  createDirectConversation(
    userId: string,
    participantId: string
  ): Promise<CreateDirectConversationResult>;

  /**
   * Get conversation by ID with all details
   */
  getConversationById(
    conversationId: string,
    userId: string
  ): Promise<ConversationWithParticipants | null>;

  /**
   * Create group conversation
   */
  createGroupConversation(
    creatorId: string,
    data: CreateGroupConversationData
  ): Promise<GroupConversationResult>;

  /**
   * Get user's conversations with pagination and filtering
   */
  getUserConversations(
    userId: string,
    filters: ConversationFilters
  ): Promise<ConversationListResult>;

  /**
   * Update conversation metadata (group name, description, settings)
   */
  updateConversationMetadata(
    conversationId: string,
    userId: string,
    updates: ConversationMetadataUpdates
  ): Promise<ConversationUpdateResult>;

  /**
   * Delete conversation (groups only)
   */
  deleteConversation(
    conversationId: string,
    userId: string
  ): Promise<ConversationDeletionResult>;

  // =============== PARTICIPANT MANAGEMENT ===============

  /**
   * Add participants to group conversation
   */
  addParticipants(
    conversationId: string,
    adminId: string,
    userIds: string[],
    role?: ParticipantRole
  ): Promise<AddParticipantsResult>;

  /**
   * Update participant role in conversation
   */
  updateParticipantRole(
    conversationId: string,
    adminId: string,
    targetUserId: string,
    newRole: ParticipantRole
  ): Promise<UpdateParticipantRoleResult>;

  /**
   * Remove participant from conversation
   */
  removeParticipant(
    conversationId: string,
    adminId: string,
    targetUserId: string
  ): Promise<RemoveParticipantResult>;

  /**
   * Leave conversation (self-removal)
   */
  leaveConversation(
    conversationId: string,
    userId: string
  ): Promise<LeaveConversationResult>;
}

// =============== GROUP CONVERSATION INTERFACES ===============

export interface CreateGroupConversationData {
  name: string;
  description?: string;
  participantIds: string[];
  avatarUrl?: string;
  settings?: {
    allowMembersToAdd?: boolean;
    allowAllToSend?: boolean;
    muteNotifications?: boolean;
    disappearingMessages?: number;
  };
  initialMessage?: string;
}

export interface GroupConversationResult {
  conversation: {
    id: string;
    type: 'group';
    name: string;
    description?: string;
    avatarUrl?: string;
    participants: Array<{
      userId: string;
      role: 'admin' | 'member';
      joinedAt: string;
      user: {
        id: string;
        username: string;
        fullName: string;
        avatarUrl?: string;
        isOnline: boolean;
      };
    }>;
    settings: {
      allowMembersToAdd: boolean;
      allowAllToSend: boolean;
      muteNotifications: boolean;
      disappearingMessages: number;
    };
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    isActive: boolean;
    unreadCount: number;
  };
  invitesSent: string[];
  initialMessage?: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
  };
}

export interface ConversationFilters {
  type?: 'direct' | 'group' | 'all';
  status?: 'active' | 'archived' | 'all';
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: 'updated' | 'created' | 'name';
  pinnedOnly?: boolean;
  unreadOnly?: boolean;
}

export interface ConversationListResult {
  conversations: Array<{
    id: string;
    type: 'direct' | 'group';
    name: string;
    avatarUrl?: string;
    participantCount: number;
    lastMessage?: {
      id: string;
      content: string;
      messageType: string;
      senderId: string;
      createdAt: string;
    };
    unreadCount: number;
    lastActivity: string;
    isArchived: boolean;
    isPinned: boolean;
    isMuted: boolean;
  }>;
  total: number;
  hasMore: boolean;
  nextOffset?: number;
}

export interface ConversationMetadataUpdates {
  name?: string;
  description?: string;
  avatarUrl?: string;
  settings?: {
    allowMembersToAdd?: boolean;
    allowAllToSend?: boolean;
    muteNotifications?: boolean;
    disappearingMessages?: number;
  };
}

export interface ConversationUpdateResult {
  conversation: {
    id: string;
    type: 'direct' | 'group';
    name?: string;
    description?: string;
    avatarUrl?: string;
    settings: {
      allowMembersToAdd: boolean;
      allowAllToSend: boolean;
      muteNotifications: boolean;
      disappearingMessages: number;
    };
    updatedAt: string;
    updatedBy: string;
  };
  changes: string[];
}

export interface ConversationDeletionResult {
  success: boolean;
  deletedAt: string;
  participantsNotified: number;
}

// =============== PARTICIPANT MANAGEMENT INTERFACES ===============

export interface AddParticipantsResult {
  added: Array<{
    userId: string;
    role: ParticipantRole;
    joinedAt: string;
    addedBy: string;
    user: {
      id: string;
      username: string;
      fullName: string;
      avatarUrl?: string;
      isOnline: boolean;
    };
  }>;
  failed: Array<{
    userId: string;
    reason: string;
  }>;
  totalParticipants: number;
}

export interface UpdateParticipantRoleResult {
  participant: {
    userId: string;
    role: ParticipantRole;
    joinedAt: string;
    addedBy: string;
    user: {
      id: string;
      username: string;
      fullName: string;
      avatarUrl?: string;
      isOnline: boolean;
    };
  };
  previousRole: ParticipantRole;
  updatedAt: string;
}

export interface RemoveParticipantResult {
  success: boolean;
  removedUserId: string;
  removedAt: string;
  remainingParticipants: number;
}

export interface LeaveConversationResult {
  success: boolean;
  leftAt: string;
  remainingParticipants: number;
}
