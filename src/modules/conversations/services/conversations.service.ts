/**
 * Conversations Service Implementation
 * 
 * 🎯 Purpose: Core business logic for conversation management
 * 📱 Mobile-First: Zalo/Messenger-style conversation handling
 * 🚀 Clean Architecture: Service layer implementation
 */

import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException, InternalServerErrorException, Inject, forwardRef } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  IConversationsService,
  CreateDirectConversationResult,
  CreateGroupConversationData,
  GroupConversationResult,
  ConversationFilters,
  ConversationListResult,
  ConversationMetadataUpdates,
  ConversationUpdateResult,
  ConversationDeletionResult,
  AddParticipantsResult,
  UpdateParticipantRoleResult,
  RemoveParticipantResult,
  LeaveConversationResult
} from './interfaces/conversations-service.interface';
import { IUsersService } from '../../users/services/interfaces/users-service.interface';
import { IConversationRepository } from '../repositories/interfaces/conversation-repository.interface';
import { ConversationType, ParticipantRole, CreateConversationData, UpdateConversationData, ConversationQuery, ConversationWithParticipants, AddParticipantData } from '../types/conversation.types';

@Injectable()
export class ConversationsService implements IConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    @Inject('IConversationRepository')
    private readonly conversationRepository: IConversationRepository,

    @Inject('IUsersService')
    private readonly usersService: IUsersService,
  ) { }

  /**
   * Prepare Direct Conversation
   * 
   * Business Logic:
   * 1. Validate both users exist
   * 2. Check if active conversation already exists
   * 3. If not exists, create dormant conversation
   * 4. Return conversation context for frontend
   */
  async createDirectConversation(
    userId: string,
    participantId: string
  ): Promise<CreateDirectConversationResult> {
    this.logger.log(`Create direct conversation between ${userId} and ${participantId}`);

    // Validation: Self-conversation check
    if (userId === participantId) {
      throw new BadRequestException('Cannot create conversation with yourself');
    }

    try {
      // Step 1: Validate both users exist
      const [currentUser, targetUser] = await Promise.all([
        this.usersService.findById(userId),
        this.usersService.findById(participantId)
      ]);

      if (!currentUser) {
        throw new NotFoundException('Current user not found');
      }

      if (!targetUser) {
        throw new NotFoundException('Target user not found');
      }

      // Step 2: Check if active conversation exists between users
      let existingConversation = await this.conversationRepository.findDirectConversationByParticipants(
        userId,
        participantId
      );


      let conversationResult: ConversationWithParticipants;
      let exists = false;
      let isActive = false;

      if (existingConversation) {
        // Conversation already exists
        exists = true;
        isActive = existingConversation.isActive;
        conversationResult = existingConversation;

        this.logger.log(`Found existing conversation: ${existingConversation.id}, active: ${isActive}`);
      } else {
        // Step 3: Create active conversation
        const conversationData: CreateConversationData = {
          type: ConversationType.DIRECT,
          name: targetUser.fullName || targetUser.username,
          createdBy: userId, // String as per interface
          avatarUrl: targetUser?.avatarUrl,
          initialParticipants: [participantId]
        };

        conversationResult = await this.conversationRepository.create(conversationData);
        exists = false;
        isActive = true;

        this.logger.log(`Created dormant conversation: ${conversationResult.id}`);
      }

      // Step 4: Build response with participant info
      const result: CreateDirectConversationResult = {
        conversationId: conversationResult.id.toString(),
        exists,
        isActive,
        participant: {
          id: targetUser.id.toString(),
          username: targetUser.username,
          fullName: targetUser.fullName,
          avatarUrl: targetUser.avatarUrl,
          isOnline: targetUser.isOnline || false,
          lastSeen: targetUser.lastSeen?.toISOString()
        },
        conversation: {
          id: conversationResult.id.toString(),
          type: conversationResult.type,
          createdAt: conversationResult?.createdAt.toISOString(),
          lastActivity: conversationResult?.lastActivity.toISOString()
        }
      };

      this.logger.log(`Prepared conversation successfully: ${result.conversationId}`);
      return result;

    } catch (error) {
      this.logger.error(`Error preparing conversation: ${error.message}`, error.stack);
      throw error;
    }
  }
  /**
   * Get conversation by ID with full details
   */
  async getConversationById(
    conversationId: string,
    userId: string
  ): Promise<ConversationWithParticipants | null> {
    this.logger.log(`Getting conversation ${conversationId} for user ${userId}`);

    try {
      const conversation = await this.conversationRepository.findByIdWithParticipants(conversationId, userId);

      if (!conversation) {
        return null;
      }

      // Check if user is participant
      const isParticipant = conversation.participants.some(
        p => p.userId.toString() === userId
      );

      if (!isParticipant) {
        throw new BadRequestException('Access denied to this conversation');
      }

      this.logger.debug(`Found conversation from service`, conversation);

      // Return the conversation directly as it's already ConversationWithParticipants
      return conversation;

    } catch (error) {
      this.logger.error(`Error getting conversation: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create Group Conversation
   * 
   * Business Logic:
   * 1. Validate all participants exist and are valid users
   * 2. Check creator permissions and limits
   * 3. Create conversation with initial participants
   * 4. Send initial message if provided
   * 5. Notify all participants
   */
  async createGroupConversation(
    creatorId: string,
    data: CreateGroupConversationData
  ): Promise<GroupConversationResult> {
    this.logger.debug(`Creating group conversation: ${data.name} by user: ${creatorId}`);

    try {
      // 1. Validate creator exists
      const creator = await this.usersService.findById(creatorId);
      if (!creator) {
        throw new NotFoundException('Creator user not found');
      }

      // 2. Validate all participants exist
      const participantIds = [...new Set([...data.participantIds, creatorId])]; // Include creator + dedupe
      const participants = await this.usersService.findByIds(participantIds);

      if (participants.length !== participantIds.length) {
        const foundIds = participants.map(p => p.id);
        const missingIds = participantIds.filter(id => !foundIds.includes(id));
        throw new BadRequestException(`Invalid participant IDs: ${missingIds.join(', ')}`);
      }

      // 3. Business rules validation
      if (participantIds.length < 3) {
        throw new BadRequestException('Group conversation must have at least 3 participants (including creator)');
      }
      if (participantIds.length > 1000) {
        throw new BadRequestException('Group conversation cannot have more than 1000 participants');
      }

      // 4. Create conversation entity
      const conversationData: CreateConversationData = {
        type: ConversationType.GROUP,
        createdBy: creatorId,
        name: data.name,
        description: data.description,
        avatarUrl: data.avatarUrl,
        initialParticipants: participantIds.filter(id => id !== creatorId), // Exclude creator from initial participants
      };

      const conversation = await this.conversationRepository.create(conversationData);

      // 5. Send initial message if provided (simplified for now)
      let initialMessage: { id: string; content: string; senderId: string; createdAt: string } | undefined = undefined;
      if (data.initialMessage) {
        // TODO: Implement when MessageService is properly integrated
        this.logger.debug(`Initial message will be sent later: ${data.initialMessage}`);
      }

      // 6. Format response (simplified)
      const result: GroupConversationResult = {
        conversation: {
          id: conversation.id.toString(),
          type: 'group',
          name: conversation.name || '',
          description: conversation.description,
          avatarUrl: conversation.avatarUrl,
          participants: participants.map(user => ({
            userId: user.id,
            role: user.id === creatorId ? 'admin' : 'member',
            joinedAt: new Date().toISOString(),
            user: {
              id: user.id,
              username: user.username,
              fullName: user.fullName,
              avatarUrl: user.avatarUrl,
              isOnline: user.isOnline ?? false
            }
          })),
          settings: {
            allowMembersToAdd: data.settings?.allowMembersToAdd ?? true,
            allowAllToSend: data.settings?.allowAllToSend ?? true,
            muteNotifications: data.settings?.muteNotifications ?? false,
            disappearingMessages: data.settings?.disappearingMessages ?? 0
          },
          createdBy: creatorId,
          createdAt: conversation.createdAt.toISOString(),
          updatedAt: conversation.updatedAt.toISOString(),
          isActive: true,
          unreadCount: 0
        },
        invitesSent: data.participantIds,
        initialMessage
      };

      this.logger.debug(`Group conversation created successfully: ${conversation.id}`);
      return result;

    } catch (error) {
      this.logger.error(`Failed to create group conversation: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get User's Conversations
   * 
   * Business Logic:
   * 1. Build query filters based on criteria
   * 2. Apply pagination and sorting
   * 3. Fetch conversations with user participation
   * 4. Calculate unread counts and metadata
   * 5. Format for mobile-optimized response
   */
  async getUserConversations(
    userId: string,
    filters: ConversationFilters
  ): Promise<ConversationListResult> {
    this.logger.debug(`Getting conversations for user: ${userId} with filters:`, filters);

    try {
      // 1. Validate user exists
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // 2. Build repository query filters
      const query: ConversationQuery = {
        type: filters.type !== 'all' ? (filters.type as ConversationType) : undefined,
        status: filters.status !== 'all' ? filters.status : undefined,
        limit: filters.limit || 20,
        offset: filters.offset || 0,
        search: filters.search,
        sortBy: filters.sortBy || 'updated',
        hasUnread: filters.unreadOnly ? true : undefined
      };

      // 3. Get conversations with pagination
      const result = await this.conversationRepository.findUserConversations(userId, query);
      // 4. Format conversations for response (using ConversationListItem structure)

      const conversations = result.conversations.map(conv => ({
        id: conv.id,
        type: conv.type,
        name: conv.name,
        avatarUrl: conv.avatarUrl,
        participantCount: conv.participantCount,
        lastMessage: conv.lastMessage ? {
          id: conv.lastMessage.messageId,
          content: conv.lastMessage.content,
          messageType: conv.lastMessage.messageType,
          senderId: conv.lastMessage.senderId,
          createdAt: conv.lastMessage.sentAt.toISOString()
        } : undefined,
        unreadCount: conv.unreadCount,
        lastActivity: conv.lastActivity.toISOString(),
        isArchived: conv.isArchived,
        isPinned: conv.isPinned,
        isMuted: conv.isMuted
      }));

      const response: ConversationListResult = {
        conversations,
        total: result.total,
        hasMore: result.hasMore,
        nextOffset: result.hasMore ? (filters.offset || 0) + conversations.length : undefined
      };

      this.logger.debug(`Retrieved ${conversations.length} conversations for user: ${userId}`);
      return response;

    } catch (error) {
      this.logger.error(`Failed to get user conversations: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update Conversation Metadata
   * 
   * Business Logic:
   * 1. Validate conversation exists and user has permission
   * 2. Validate update data
   * 3. Apply updates with change tracking
   * 4. Notify participants of changes
   */
  async updateConversationMetadata(
    conversationId: string,
    userId: string,
    updates: ConversationMetadataUpdates
  ): Promise<ConversationUpdateResult> {
    this.logger.debug(`Updating conversation metadata: ${conversationId} by user: ${userId}`);

    try {
      // 1. Get conversation and validate access
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      // 2. Check if user is participant
      const participant = conversation.participants.find(p => p.userId.toString() === userId);
      if (!participant) {
        throw new BadRequestException('Access denied: not a participant');
      }

      // 3. Check permissions for group conversations
      if (conversation.type === 'group') {
        if (participant.role !== ParticipantRole.ADMIN && participant.role !== ParticipantRole.OWNER) {
          throw new BadRequestException('Access denied: only admins can update group metadata');
        }
      } else {
        // Direct conversations can only update certain fields
        if (updates.name || updates.description) {
          throw new BadRequestException('Cannot update name/description for direct conversations');
        }
      }

      // 4. Track changes
      const changes: string[] = [];
      const updateData: any = {};

      if (updates.name && updates.name !== conversation.name) {
        updateData.name = updates.name;
        changes.push('name');
      }

      if (updates.description !== undefined && updates.description !== conversation.description) {
        updateData.description = updates.description;
        changes.push('description');
      }

      if (updates.avatarUrl !== undefined && updates.avatarUrl !== conversation.avatarUrl) {
        updateData.avatarUrl = updates.avatarUrl;
        changes.push('avatar');
      }

      if (updates.settings) {
        const currentSettings = conversation.settings || {};
        const newSettings = { ...currentSettings, ...updates.settings };

        if (JSON.stringify(currentSettings) !== JSON.stringify(newSettings)) {
          updateData.settings = newSettings;
          changes.push('settings');
        }
      }

      // 5. Apply updates if there are changes
      if (changes.length === 0) {
        throw new BadRequestException('No changes provided');
      }

      updateData.updatedAt = new Date();
      this.logger.debug(`Applying updates to conversation ${conversationId}:`, updateData);

      const updatedConversation = await this.conversationRepository.updateById(conversationId, updateData);

      if (!updatedConversation) {
        throw new NotFoundException('Failed to update conversation');
      }

      this.logger.debug(`Conversation updated successfully:`, {
        id: updatedConversation.id,
        name: updatedConversation.name,
        updatedAt: updatedConversation.updatedAt
      });

      // 6. Format response
      const result: ConversationUpdateResult = {
        conversation: {
          id: updatedConversation.id,
          type: updatedConversation.type,
          name: updatedConversation.name,
          description: updatedConversation.description,
          avatarUrl: updatedConversation.avatarUrl,
          settings: {
            allowMembersToAdd: true,
            allowAllToSend: true,
            muteNotifications: false,
            disappearingMessages: 0
          },
          updatedAt: updatedConversation.updatedAt.toISOString(),
          updatedBy: userId
        },
        changes
      };

      this.logger.debug(`Conversation metadata updated successfully: ${conversationId}, changes: ${changes.join(', ')}`);
      return result;

    } catch (error) {
      this.logger.error(`Failed to update conversation metadata: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete Conversation (Groups Only)
   * 
   * Business Logic:
   * 1. Validate conversation exists and is group type
   * 2. Check user is admin
   * 3. Perform soft delete
   * 4. Notify all participants
   */
  async deleteConversation(
    conversationId: string,
    userId: string
  ): Promise<ConversationDeletionResult> {
    this.logger.debug(`Deleting conversation: ${conversationId} by user: ${userId}`);

    try {
      // 1. Get conversation and validate
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      if (!conversation.isActive) {
        throw new BadRequestException('Conversation is already deleted or inactive');
      }

      // // 2. Only group conversations can be deleted
      // if (conversation.type !== 'group') {
      //   throw new BadRequestException('Only group conversations can be deleted');
      // }

      // 3. Check if user is admin
      const participant = conversation.participants.find(p => p.userId.toString() === userId);
      if (!participant || participant.role !== ParticipantRole.ADMIN && participant.role !== ParticipantRole.OWNER) {
        throw new BadRequestException('Access denied: only group admins can delete conversations');
      }

      // 4. Perform soft delete
      const deletionTime = new Date();
      const success = await this.conversationRepository.softDeleteById(conversationId);

      // 5. Count participants for notification
      const participantsToNotify = conversation.participants.length - 1; // Exclude the deleter

      const result: ConversationDeletionResult = {
        success: true,
        deletedAt: deletionTime.toISOString(),
        participantsNotified: participantsToNotify
      };

      this.logger.debug(`Conversation deleted successfully: ${conversationId}`);
      return result;

    } catch (error) {
      this.logger.error(`Failed to delete conversation: ${error.message}`, error.stack);
      throw error;
    }
  }

  // =============== PRIVATE HELPER METHODS ===============

  /**
   * Generate conversation name for direct conversations
   */
  private generateConversationName(conversation: any, currentUserId: string): string {
    if (conversation.type === 'group') {
      return conversation.name || 'Group Chat';
    }

    // For direct conversations, return the other participant's name
    const otherParticipant = conversation.participants.find(
      (p: any) => p.userId.toString() !== currentUserId
    );

    return otherParticipant?.user?.fullName || otherParticipant?.user?.username || 'Direct Chat';
  }

  // =============== PARTICIPANT MANAGEMENT METHODS ===============

  /**
   * Add participants to group conversation
   * 
   * 🎯 Business Logic:
   * - Only admins can add participants
   * - Only group conversations allow adding participants
   * - Validate all users exist and not already in conversation
   * - Check group size limits (max 1000)
   */
  async addParticipants(
    conversationId: string,
    adminId: string,
    userIds: string[],
    role: ParticipantRole = ParticipantRole.MEMBER
  ): Promise<AddParticipantsResult> {
    try {
      this.logger.log(`Admin ${adminId} adding participants ${userIds.join(', ')} to conversation ${conversationId}`);

      // 1. Validate conversation exists and is group
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      if (conversation.type !== ConversationType.GROUP) {
        throw new BadRequestException('Can only add participants to group conversations');
      }

      // 2. Validate admin permissions
      const adminRole = await this.conversationRepository.getUserRole(conversationId, adminId);
      if (adminRole !== ParticipantRole.ADMIN && adminRole !== ParticipantRole.OWNER) {
        throw new ForbiddenException('Only admins can add participants');
      }

      // 3. Check current participant count
      const currentCount = await this.conversationRepository.getParticipantsCount(conversationId);
      if (currentCount + userIds.length > 1000) {
        throw new BadRequestException('Group participant limit (1000) would be exceeded');
      }

      // 4. Validate users exist and prepare participant data
      const participantData: AddParticipantData[] = [];
      const failed: { userId: string; reason: string }[] = [];

      for (const userId of userIds) {
        try {
          // Check if user exists
          const user = await this.usersService.findById(userId);
          if (!user) {
            failed.push({ userId, reason: 'User not found' });
            continue;
          }

          // Check if already participant
          const isParticipant = await this.conversationRepository.isUserParticipant(conversationId, userId);
          if (isParticipant) {
            failed.push({ userId, reason: 'Already in conversation' });
            continue;
          }

          participantData.push({
            conversationId,
            userId,
            addedBy: adminId,
            role
          });
        } catch (error) {
          failed.push({ userId, reason: 'Validation failed' });
        }
      }

      // 5. Add participants to conversation
      const addResult = await this.conversationRepository.addParticipants(conversationId, participantData);

      // 6. Get total participant count after addition
      const totalParticipants = await this.conversationRepository.getParticipantsCount(conversationId);

      // 7. Build response with user details
      const addedWithUserDetails = await Promise.all(
        addResult.added.map(async (participant) => {
          const user = await this.usersService.findById(participant.userId);
          if (!user) {
            throw new NotFoundException(`User ${participant.userId} not found after adding to conversation`);
          }
          return {
            userId: participant.userId,
            role: participant.role,
            joinedAt: participant.joinedAt?.toISOString(),
            addedBy: participant.addedBy,
            user: {
              id: user.id,
              username: user.username,
              fullName: user.fullName,
              avatarUrl: user.avatarUrl,
              isOnline: user.isOnline || false
            }
          };
        })
      );

      this.logger.log(`Successfully added ${addedWithUserDetails.length} participants to conversation ${conversationId}`);

      return {
        added: addedWithUserDetails,
        failed: [...failed, ...addResult.failed],
        totalParticipants
      };

    } catch (error) {
      this.logger.error(`Failed to add participants to conversation ${conversationId}:`, error.stack);
      throw error;
    }
  }

  /**
   * Update participant role in conversation
   * 
   * 🎯 Business Logic:
   * - Only admins can change roles
   * - Cannot demote yourself if you're the last admin
   * - Cannot change role in direct conversations
   */
  async updateParticipantRole(
    conversationId: string,
    adminId: string,
    targetUserId: string,
    newRole: ParticipantRole
  ): Promise<UpdateParticipantRoleResult> {
    try {
      this.logger.log(`Admin ${adminId} updating role of ${targetUserId} to ${newRole} in conversation ${conversationId}`);

      // 1. Validate conversation exists and is group
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      if (conversation.type !== ConversationType.GROUP) {
        throw new BadRequestException('Can only manage roles in group conversations');
      }

      // 2. Validate admin permissions
      const adminRole = await this.conversationRepository.getUserRole(conversationId, adminId);
      if (adminRole !== ParticipantRole.ADMIN && adminRole !== ParticipantRole.OWNER) {
        throw new ForbiddenException('Only admins can update participant roles');
      }

      // 3. Get current role of target user
      const currentRole = await this.conversationRepository.getUserRole(conversationId, targetUserId);
      if (!currentRole) {
        throw new NotFoundException('User is not a participant in this conversation');
      }

      if (currentRole === newRole) {
        throw new BadRequestException(`User already has ${newRole} role`);
      }

      // 4. Special validation: Cannot demote yourself if last admin
      if (adminId === targetUserId && newRole === ParticipantRole.MEMBER) {
        const adminCount = await this.conversationRepository.countAdmins(conversationId);
        if (adminCount <= 1) {
          throw new BadRequestException('Cannot demote yourself as the last admin. Promote another user first.');
        }
      }

      // check new role includes in ParticipantRole
      if (!Object.values(ParticipantRole).includes(newRole)) {
        throw new BadRequestException(`Invalid role: ${newRole}. Must be one of ${Object.values(ParticipantRole).join(', ')}`);
      }

      // 5. Update role in repository
      const updated = await this.conversationRepository.updateParticipantRole(conversationId, targetUserId, newRole);
      if (!updated) {
        throw new InternalServerErrorException('Failed to update participant role');
      }

      // 6. Get updated participant details
      const user = await this.usersService.findById(targetUserId);
      if (!user) {
        throw new NotFoundException('Target user not found');
      }


      const result: UpdateParticipantRoleResult = {
        participant: {
          userId: targetUserId,
          role: newRole,
          joinedAt: conversation.participants.find(p => p.userId === targetUserId)?.joinedAt?.toISOString() || new Date().toISOString(),
          addedBy: conversation.participants.find(p => p.userId === targetUserId)?.addedBy || 'system',
          user: {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            avatarUrl: user.avatarUrl,
            isOnline: user.isOnline || false
          }
        },
        previousRole: currentRole,
        updatedAt: new Date().toISOString()
      };

      this.logger.log(`Successfully updated ${targetUserId} role from ${currentRole} to ${newRole} in conversation ${conversationId}`);
      return result;

    } catch (error) {
      this.logger.error(`Failed to update participant role in conversation ${conversationId}:`, error.stack);
      throw error;
    }
  }

  /**
   * Remove participant from conversation
   * 
   * 🎯 Business Logic:
   * - Only admins can remove participants (except self-leave)
   * - Cannot remove yourself (use leave instead)
   * - Cannot remove last admin
   */
  async removeParticipant(
    conversationId: string,
    adminId: string,
    targetUserId: string
  ): Promise<RemoveParticipantResult> {
    try {
      this.logger.log(`Admin ${adminId} removing participant ${targetUserId} from conversation ${conversationId}`);

      // 1. Validate conversation exists and is group
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      if (conversation.type !== ConversationType.GROUP) {
        throw new BadRequestException('Can only remove participants from group conversations');
      }

      // 2. Cannot remove yourself (use leave instead)
      if (adminId === targetUserId) {
        throw new BadRequestException('Cannot remove yourself. Use leave conversation instead.');
      }

      // 3. Validate admin permissions
      const adminRole = await this.conversationRepository.getUserRole(conversationId, adminId);
      if (adminRole !== ParticipantRole.ADMIN && adminRole !== ParticipantRole.OWNER) {
        throw new ForbiddenException('Only admins or owner can remove participants');
      }

      // 4. Validate target user is participant
      const targetRole = await this.conversationRepository.getUserRole(conversationId, targetUserId);
      if (!targetRole) {
        throw new NotFoundException('User is not a participant in this conversation');
      }

      // 5. Cannot remove last admin
      if (targetRole === ParticipantRole.ADMIN) {
        const adminCount = await this.conversationRepository.countAdmins(conversationId);
        if (adminCount <= 1) {
          throw new BadRequestException('Cannot remove the last admin. Promote another user first.');
        }
      }

      // 6. Remove participant
      const removed = await this.conversationRepository.removeParticipant(conversationId, targetUserId);
      if (!removed) {
        throw new InternalServerErrorException('Failed to remove participant');
      }

      // 7. Get remaining participant count
      const remainingParticipants = await this.conversationRepository.getParticipantsCount(conversationId);

      this.logger.log(`Successfully removed ${targetUserId} from conversation ${conversationId}`);

      return {
        success: true,
        removedUserId: targetUserId,
        removedAt: new Date().toISOString(),
        remainingParticipants
      };

    } catch (error) {
      this.logger.error(`Failed to remove participant from conversation ${conversationId}:`, error.stack);
      throw error;
    }
  }

  /**
   * Leave conversation (self-removal)
   * 
   * 🎯 Business Logic:
   * - Any participant can leave
   * - If last admin leaves, promote another member (if any)
   * - If last participant leaves, conversation becomes inactive
   */
  async leaveConversation(
    conversationId: string,
    userId: string
  ): Promise<LeaveConversationResult> {
    try {
      this.logger.log(`User ${userId} leaving conversation ${conversationId}`);

      // 1. Validate conversation exists
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      // 2. Validate user is participant
      const userRole = await this.conversationRepository.getUserRole(conversationId, userId);
      if (!userRole) {
        throw new NotFoundException('You are not a participant in this conversation');
      }

      // 3. Special handling for admins in group conversations
      if (conversation.type === ConversationType.GROUP && userRole === ParticipantRole.ADMIN) {
        const adminCount = await this.conversationRepository.countAdmins(conversationId);
        const totalParticipants = await this.conversationRepository.getParticipantsCount(conversationId);

        // If last admin and there are other participants, promote someone
        if (adminCount === 1 && totalParticipants > 1) {
          // This would require additional logic to auto-promote a member
          // For now, we'll prevent the last admin from leaving
          throw new BadRequestException('As the last admin, you must promote another member before leaving');
        }
      }

      // 4. Remove user from conversation
      const removed = await this.conversationRepository.removeParticipant(conversationId, userId);
      if (!removed) {
        throw new InternalServerErrorException('Failed to leave conversation');
      }

      // 5. Get remaining participant count
      const remainingParticipants = await this.conversationRepository.getParticipantsCount(conversationId);

      this.logger.log(`User ${userId} successfully left conversation ${conversationId}`);

      return {
        success: true,
        leftAt: new Date().toISOString(),
        remainingParticipants
      };

    } catch (error) {
      this.logger.error(`Failed to leave conversation ${conversationId}:`, error.stack);
      throw error;
    }
  }

  /**
   * Get user contacts from conversations for presence notifications
   * Returns list of user IDs that the user has conversations with
   */
  async getUserContacts(userId: string): Promise<string[]> {
    try {
      this.logger.debug(`Getting contacts from conversations for user: ${userId}`);

      // Use repository method to get user contacts directly
      const contactIds = await this.conversationRepository.getUserContactsFromConversations(userId);

      this.logger.log(`Found ${contactIds.length} contacts for user ${userId} from conversations`);
      return contactIds;
    } catch (error) {
      this.logger.error(`Failed to get contacts for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Check if user is member of conversation
   * Used by Messages module for authorization
   */
  async isUserMemberOfConversation(userId: string, conversationId: string): Promise<boolean> {
    try {
      this.logger.debug(`Checking if user ${userId} is member of conversation ${conversationId}`);

      const isMember = await this.conversationRepository.isUserParticipant(conversationId, userId);

      this.logger.debug(`User ${userId} ${isMember ? 'is' : 'is not'} member of conversation ${conversationId}`);
      return isMember;

    } catch (error) {
      this.logger.error(`Failed to check membership for user ${userId} in conversation ${conversationId}:`, error);
      return false; // Fail safe - deny access on error
    }
  }
}
