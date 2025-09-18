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
  LeaveConversationResult,
  ConversationFilesResult
} from './interfaces/conversations-service.interface';
import { IUsersService } from '../../users/services/interfaces/users-service.interface';
import { IConversationRepository } from '../repositories/interfaces/conversation-repository.interface';
import { ConversationType, ParticipantRole, CreateConversationData, UpdateConversationData, ConversationQuery, ConversationWithParticipants, AddParticipantData } from '../types/conversation.types';
import { ConversationFileType } from '../dto/conversation-files.dto';
import { MessagesService } from '../../messages/services/messages.service';
import { FilesService } from '../../files/services/files.service';

@Injectable()
export class ConversationsService implements IConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    @Inject('IConversationRepository')
    private readonly conversationRepository: IConversationRepository,

    @Inject('IUsersService')
    private readonly usersService: IUsersService,

    @Inject(forwardRef(() => MessagesService))
    private readonly messagesService: MessagesService,

    @Inject(forwardRef(() => FilesService))
    private readonly filesService: FilesService,
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

  /**
   * Get all files/media from a conversation
   * 
   * 🎯 Purpose: Retrieve all files shared in a conversation with filtering and pagination
   * 📱 Mobile-First: Optimized for mobile gallery views
   * 🔒 Security: Validates user membership before access
   * 
   * Business Logic:
   * 1. Validate user is member of conversation
   * 2. Query messages with attachments in the conversation
   * 3. Extract and deduplicate file attachments
   * 4. Apply filtering (file type, size, search)
   * 5. Sort and paginate results
   * 6. Include file metadata and uploader info
   * 7. Generate download URLs
   * 8. Return structured response with statistics
   */
  async getConversationFiles(
    conversationId: string,
    userId: string,
    options: {
      page?: number;
      limit?: number;
      fileType?: string;
      sortBy?: string;
      search?: string;
      minSize?: number;
      maxSize?: number;
    } = {}
  ): Promise<ConversationFilesResult> {
    try {
      this.logger.log(`Getting files for conversation ${conversationId}, user ${userId}`);

      // 1. Validate user exists
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // 2. Validate conversation exists and user is member
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      const isMember = await this.isUserMemberOfConversation(userId, conversationId);
      if (!isMember) {
        throw new ForbiddenException('You are not a member of this conversation');
      }

      // 3. Set default options and validate
      const {
        page = 1,
        limit = 20,
        fileType = 'all',
        sortBy = 'newest',
        search,
        minSize,
        maxSize
      } = options;

      // Validate pagination
      if (page < 1) {
        throw new BadRequestException('Page must be greater than 0');
      }
      if (limit < 1 || limit > 100) {
        throw new BadRequestException('Limit must be between 1 and 100');
      }

      // 4. Get all messages from conversation with large pagination to find attachments
      // We'll process in batches to avoid memory issues
      const allFiles: any[] = [];
      const filesMap = new Map(); // For deduplication
      let messagePage = 1;
      const messagesPerBatch = 100;
      let hasMoreMessages = true;

      this.logger.debug(`Starting to scan messages for files in conversation ${conversationId}`);

      while (hasMoreMessages) {
        try {
          // Get messages from this conversation
          const messagesResult = await this.messagesService.getConversationMessages(
            conversationId,
            { page: messagePage, limit: messagesPerBatch },
            { userId, deviceId: undefined }
          );

          if (!messagesResult.messages || messagesResult.messages.length === 0) {
            hasMoreMessages = false;
            break;
          }

          // Process each message to extract file attachments
          for (const message of messagesResult.messages) {
            if (message.attachments && message.attachments.length > 0) {
              // Get uploader info (sender)
              const uploader = message.sender || await this.usersService.findById(message.senderId);

              for (const attachment of message.attachments) {
                // Avoid duplicates (same file attached to multiple messages)
                const fileKey = `${attachment.fileId}_${message.id}`;
                if (filesMap.has(fileKey)) {
                  continue;
                }

                // Determine file type category
                const fileTypeCategory = this.determineFileType(attachment.mimeType);

                // Create file entry
                const fileEntry = {
                  id: attachment.fileId,
                  messageId: message.id,
                  originalName: attachment.fileName,
                  fileName: attachment.fileName,
                  mimeType: attachment.mimeType,
                  fileSize: attachment.fileSize,
                  fileType: fileTypeCategory,
                  fileUrl: attachment.downloadUrl,
                  thumbnailUrl: attachment.thumbnailUrl,
                  uploadedBy: {
                    id: uploader?.id || message.senderId,
                    fullName: uploader?.fullName || 'Unknown User',
                    avatarUrl: uploader?.avatarUrl
                  },
                  uploadedAt: new Date(message.createdAt),
                  messageTimestamp: new Date(message.createdAt),
                  messageContent: message.content,
                  downloadCount: 0, // TODO: Implement download tracking
                  metadata: {} // TODO: Add metadata from FilesService
                };

                filesMap.set(fileKey, fileEntry);
                allFiles.push(fileEntry);
              }
            }
          }

          // Check if we have more messages
          hasMoreMessages = messagesResult.pagination.hasNext;
          messagePage++;

          this.logger.debug(`Processed page ${messagePage - 1}, found ${allFiles.length} files so far`);

        } catch (error) {
          this.logger.warn(`Failed to get messages page ${messagePage}: ${error.message}`);
          hasMoreMessages = false;
        }
      }

      this.logger.debug(`Found total ${allFiles.length} files in conversation ${conversationId}`);

      // 5. Apply filtering
      let filteredFiles = [...allFiles];

      // Filter by file type
      if (fileType && fileType !== 'all') {
        filteredFiles = filteredFiles.filter(file => file.fileType === fileType);
      }

      // Filter by search term
      if (search) {
        const searchLower = search.toLowerCase();
        filteredFiles = filteredFiles.filter(file =>
          file.originalName?.toLowerCase().includes(searchLower) ||
          file.messageContent?.toLowerCase().includes(searchLower) ||
          file.uploadedBy.fullName?.toLowerCase().includes(searchLower)
        );
      }

      // Filter by file size
      if (minSize !== undefined) {
        filteredFiles = filteredFiles.filter(file => file.fileSize >= minSize);
      }
      if (maxSize !== undefined) {
        filteredFiles = filteredFiles.filter(file => file.fileSize <= maxSize);
      }

      // 6. Sort files
      filteredFiles = this.sortFiles(filteredFiles, sortBy);

      // 7. Apply pagination
      const total = filteredFiles.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedFiles = filteredFiles.slice(startIndex, endIndex);

      // 8. Enhance files with additional metadata from FilesService
      const enhancedFiles = await Promise.all(
        paginatedFiles.map(async (file) => {
          try {
            // Generate fresh download URLs through FilesService
            const downloadUrl = await this.filesService.generateDownloadUrl(
              file.id,
              userId,
              { expiresIn: 24 * 60 * 60 } // 24 hours
            );

            // Generate thumbnail URL if applicable
            let thumbnailUrl = file.thumbnailUrl;
            if (this.shouldHaveThumbnail(file.mimeType)) {
              try {
                // Generate preview URL for thumbnail (inline display)
                thumbnailUrl = await this.filesService.generateThumbnailPreviewUrl(
                  file.id,
                  userId,
                  24 * 60 * 60 // 24 hours
                );
              } catch (error) {
                this.logger.warn(`Failed to generate thumbnail URL for file ${file.id}: ${error.message}`);
              }
            }

            return {
              ...file,
              fileUrl: downloadUrl,
              thumbnailUrl,
              downloadCount: 0, // TODO: Get real download count from FilesService
            };
          } catch (error) {
            this.logger.warn(`Failed to enhance file ${file.id}: ${error.message}`);
            return file; // Return original file if enhancement fails
          }
        })
      );

      // 9. Calculate statistics
      const fileTypeStats = this.calculateFileTypeStats(filteredFiles);
      const totalStorageUsed = this.calculateTotalStorageUsed(filteredFiles);

      // 10. Build result
      const result: ConversationFilesResult = {
        files: enhancedFiles,
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        fileTypeStats,
        totalStorageUsed
      };

      this.logger.log(`Retrieved ${enhancedFiles.length} files for conversation ${conversationId} (page ${page}/${totalPages})`);
      return result;

    } catch (error) {
      this.logger.error(`Failed to get conversation files: ${error.message}`, error.stack);

      if (error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to retrieve conversation files');
    }
  }

  /**
   * Build MongoDB aggregation pipeline for file extraction
   * @private
   */
  private buildFileAggregationPipeline(
    conversationId: string,
    filters: {
      fileType?: string;
      search?: string;
      minSize?: number;
      maxSize?: number;
      sortBy?: string;
      page: number;
      limit: number;
    }
  ): any[] {
    const pipeline: any[] = [
      // Stage 1: Match messages in conversation with attachments
      {
        $match: {
          conversationId: new Types.ObjectId(conversationId),
          'attachments.0': { $exists: true }, // Has at least one attachment
          deletedAt: { $exists: false } // Not deleted
        }
      },

      // Stage 2: Unwind attachments to process each file separately
      {
        $unwind: '$attachments'
      },

      // Stage 3: Lookup user information for uploaders
      {
        $lookup: {
          from: 'users',
          localField: 'senderId',
          foreignField: '_id',
          as: 'uploader'
        }
      },

      // Stage 4: Unwind uploader (should be single user)
      {
        $unwind: '$uploader'
      },

      // Stage 5: Add computed fields
      {
        $addFields: {
          'attachments.messageId': '$_id',
          'attachments.messageTimestamp': '$createdAt',
          'attachments.messageContent': '$content',
          'attachments.uploadedBy': {
            id: '$uploader._id',
            fullName: '$uploader.fullName',
            avatarUrl: '$uploader.avatarUrl'
          },
          // Map MIME types to file categories
          'attachments.fileType': {
            $switch: {
              branches: [
                {
                  case: { $regexMatch: { input: '$attachments.mimeType', regex: '^image/' } },
                  then: 'image'
                },
                {
                  case: { $regexMatch: { input: '$attachments.mimeType', regex: '^video/' } },
                  then: 'video'
                },
                {
                  case: { $regexMatch: { input: '$attachments.mimeType', regex: '^audio/' } },
                  then: 'audio'
                },
                {
                  case: {
                    $or: [
                      { $regexMatch: { input: '$attachments.mimeType', regex: 'pdf' } },
                      { $regexMatch: { input: '$attachments.mimeType', regex: 'document' } },
                      { $regexMatch: { input: '$attachments.mimeType', regex: 'text/' } },
                      { $regexMatch: { input: '$attachments.mimeType', regex: 'application/' } }
                    ]
                  },
                  then: 'document'
                }
              ],
              default: 'other'
            }
          }
        }
      }
    ];

    // Stage 6: Apply filters
    const matchConditions: any = {};

    if (filters.fileType && filters.fileType !== 'all') {
      matchConditions['attachments.fileType'] = filters.fileType;
    }

    if (filters.search) {
      matchConditions['attachments.originalName'] = {
        $regex: filters.search,
        $options: 'i'
      };
    }

    if (filters.minSize) {
      matchConditions['attachments.fileSize'] = { $gte: filters.minSize };
    }

    if (filters.maxSize) {
      if (matchConditions['attachments.fileSize']) {
        matchConditions['attachments.fileSize'].$lte = filters.maxSize;
      } else {
        matchConditions['attachments.fileSize'] = { $lte: filters.maxSize };
      }
    }

    if (Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }

    // Stage 7: Sort
    const sortField = this.getSortField(filters.sortBy || 'newest');
    pipeline.push({ $sort: sortField });

    // Stage 8: Project final structure
    pipeline.push({
      $project: {
        _id: 0,
        id: '$attachments._id',
        messageId: '$attachments.messageId',
        originalName: '$attachments.originalName',
        fileName: '$attachments.fileName',
        mimeType: '$attachments.mimeType',
        fileSize: '$attachments.fileSize',
        fileType: '$attachments.fileType',
        fileUrl: '$attachments.fileUrl',
        thumbnailUrl: '$attachments.thumbnailUrl',
        uploadedBy: '$attachments.uploadedBy',
        uploadedAt: '$attachments.uploadedAt',
        messageTimestamp: '$attachments.messageTimestamp',
        messageContent: '$attachments.messageContent',
        downloadCount: '$attachments.downloadCount',
        metadata: '$attachments.metadata'
      }
    });

    return pipeline;
  }

  /**
   * Execute file aggregation with smart mock data simulation
   * @private
   */
  private async executeFileAggregation(pipeline: any[]): Promise<{
    files: any[];
    allFiles: any[];
    total: number;
  }> {
    try {
      // Check if we have Messages collection available
      const useRealData = process.env.USE_REAL_MESSAGES_DATA === 'true' && this.hasMessagesService();

      if (useRealData) {
        return await this.executeRealFileAggregation(pipeline);
      } else {
        return await this.executeMockFileAggregation(pipeline);
      }
    } catch (error) {
      this.logger.error('File aggregation failed, falling back to mock data', error.stack);
      return await this.executeMockFileAggregation(pipeline);
    }
  }

  /**
   * Execute real MongoDB aggregation (when Messages collection is available)
   * @private
   */
  private async executeRealFileAggregation(pipeline: any[]): Promise<{
    files: any[];
    allFiles: any[];
    total: number;
  }> {
    // TODO: Implement when MessagesService is properly injected
    /*
    const messageModel = this.messagesService.getModel(); // Get MongoDB model
    
    // Clone pipeline for different operations
    const basePipeline = [...pipeline];
    
    // Get total count first
    const countPipeline = [...basePipeline, { $count: "total" }];
    const countResult = await messageModel.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;
    
    // Get all files for statistics (without pagination, but limited)
    const statsPipeline = [...basePipeline];
    const allFiles = await messageModel.aggregate(statsPipeline).limit(1000); // Limit for performance
    
    // Extract pagination info from pipeline
    const { page, limit } = this.extractPaginationFromPipeline(basePipeline);
    
    // Get paginated files
    const filesPipeline = [
      ...basePipeline,
      { $skip: (page - 1) * limit },
      { $limit: limit }
    ];
    const files = await messageModel.aggregate(filesPipeline);
    
    this.logger.log(`Executed real aggregation: ${files.length} files, total: ${total}`);
    return { files, allFiles, total };
    */

    throw new Error('Real Messages integration not yet implemented');
  }

  /**
   * Execute mock file aggregation with realistic simulation
   * @private
   */
  private async executeMockFileAggregation(pipeline: any[]): Promise<{
    files: any[];
    allFiles: any[];
    total: number;
  }> {
    this.logger.warn('Using realistic mock data for file aggregation - implement Messages integration for production');

    // Extract filters from pipeline for realistic simulation
    const filters = this.extractFiltersFromPipeline(pipeline);
    const { page, limit } = this.extractPaginationFromPipeline(pipeline);

    // Generate comprehensive mock dataset
    const allMockFiles = this.generateRealisticMockFiles(filters.conversationId);

    // Apply filters
    let filteredFiles = this.applyFiltersToMockData(allMockFiles, filters);

    // Apply sorting
    filteredFiles = this.applySortingToMockData(filteredFiles, filters.sortBy);

    // Calculate total after filtering
    const total = filteredFiles.length;

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedFiles = filteredFiles.slice(startIndex, endIndex);

    // Simulate network delay for realism
    await this.simulateNetworkDelay();

    this.logger.log(`Mock aggregation completed: ${paginatedFiles.length} files (page ${page}), total: ${total}`);

    return {
      files: paginatedFiles,
      allFiles: filteredFiles, // For statistics calculation
      total
    };
  }

  /**
   * Check if MessagesService is available
   * @private
   */
  private hasMessagesService(): boolean {
    // TODO: Implement when MessagesService is injected
    // return !!this.messagesService;
    return false;
  }

  /**
   * Simulate realistic network delay
   * @private
   */
  private async simulateNetworkDelay(): Promise<void> {
    const delay = Math.random() * 100 + 50; // 50-150ms
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Extract filters from aggregation pipeline
   * @private
   */
  private extractFiltersFromPipeline(pipeline: any[]): any {
    // Extract conversation ID from first match stage
    const matchStage = pipeline.find(stage => stage.$match);
    const conversationId = matchStage?.$match?.conversationId?.toString() || 'unknown';

    // Extract other filters from subsequent match stages
    let fileType = 'all';
    let search = '';
    let minSize: number | undefined;
    let maxSize: number | undefined;
    let sortBy = 'newest';

    for (const stage of pipeline) {
      if (stage.$match && stage.$match['attachments.fileType']) {
        fileType = stage.$match['attachments.fileType'];
      }
      if (stage.$match && stage.$match['attachments.originalName']) {
        search = stage.$match['attachments.originalName'].$regex;
      }
      if (stage.$match && stage.$match['attachments.fileSize']) {
        if (stage.$match['attachments.fileSize'].$gte) {
          minSize = stage.$match['attachments.fileSize'].$gte;
        }
        if (stage.$match['attachments.fileSize'].$lte) {
          maxSize = stage.$match['attachments.fileSize'].$lte;
        }
      }
    }

    return { conversationId, fileType, search, minSize, maxSize, sortBy };
  }

  /**
   * Generate realistic mock files dataset
   * @private
   */
  private generateRealisticMockFiles(conversationId: string): any[] {
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;

    const mockFiles = [
      // Recent image files
      {
        id: '507f1f77bcf86cd799439001',
        messageId: '507f1f77bcf86cd799439101',
        originalName: 'vacation-sunset.jpg',
        fileName: '2025-09-04_507f1f77bcf86cd799439001.jpg',
        mimeType: 'image/jpeg',
        fileSize: 2048576, // 2MB
        fileType: 'image',
        uploadedBy: {
          id: '507f1f77bcf86cd799439201',
          fullName: 'Nguyen Van A',
          avatarUrl: 'https://example.com/avatar1.jpg'
        },
        uploadedAt: new Date(now.getTime() - oneDay),
        messageTimestamp: new Date(now.getTime() - oneDay),
        messageContent: 'Check out this amazing sunset! 🌅',
        downloadCount: 5,
        metadata: { width: 1920, height: 1080 }
      },
      {
        id: '507f1f77bcf86cd799439002',
        messageId: '507f1f77bcf86cd799439102',
        originalName: 'team-photo.png',
        fileName: '2025-09-03_507f1f77bcf86cd799439002.png',
        mimeType: 'image/png',
        fileSize: 3145728, // 3MB
        fileType: 'image',
        uploadedBy: {
          id: '507f1f77bcf86cd799439202',
          fullName: 'Tran Thi B',
          avatarUrl: 'https://example.com/avatar2.jpg'
        },
        uploadedAt: new Date(now.getTime() - 2 * oneDay),
        messageTimestamp: new Date(now.getTime() - 2 * oneDay),
        messageContent: 'Our team meeting today',
        downloadCount: 12,
        metadata: { width: 1280, height: 720 }
      },

      // Document files
      {
        id: '507f1f77bcf86cd799439003',
        messageId: '507f1f77bcf86cd799439103',
        originalName: 'quarterly-report.pdf',
        fileName: '2025-09-02_507f1f77bcf86cd799439003.pdf',
        mimeType: 'application/pdf',
        fileSize: 5242880, // 5MB
        fileType: 'document',
        uploadedBy: {
          id: '507f1f77bcf86cd799439201',
          fullName: 'Nguyen Van A',
          avatarUrl: 'https://example.com/avatar1.jpg'
        },
        uploadedAt: new Date(now.getTime() - 3 * oneDay),
        messageTimestamp: new Date(now.getTime() - 3 * oneDay),
        messageContent: 'Q3 financial report for review',
        downloadCount: 8,
        metadata: { pages: 25 }
      },
      {
        id: '507f1f77bcf86cd799439004',
        messageId: '507f1f77bcf86cd799439104',
        originalName: 'project-presentation.pptx',
        fileName: '2025-09-01_507f1f77bcf86cd799439004.pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        fileSize: 8388608, // 8MB
        fileType: 'document',
        uploadedBy: {
          id: '507f1f77bcf86cd799439203',
          fullName: 'Le Van C',
          avatarUrl: 'https://example.com/avatar3.jpg'
        },
        uploadedAt: new Date(now.getTime() - 4 * oneDay),
        messageTimestamp: new Date(now.getTime() - 4 * oneDay),
        messageContent: 'Final presentation slides',
        downloadCount: 15,
        metadata: { slides: 42 }
      },

      // Video files
      {
        id: '507f1f77bcf86cd799439005',
        messageId: '507f1f77bcf86cd799439105',
        originalName: 'demo-video.mp4',
        fileName: '2025-08-31_507f1f77bcf86cd799439005.mp4',
        mimeType: 'video/mp4',
        fileSize: 15728640, // 15MB
        fileType: 'video',
        uploadedBy: {
          id: '507f1f77bcf86cd799439202',
          fullName: 'Tran Thi B',
          avatarUrl: 'https://example.com/avatar2.jpg'
        },
        uploadedAt: new Date(now.getTime() - 5 * oneDay),
        messageTimestamp: new Date(now.getTime() - 5 * oneDay),
        messageContent: 'Product demo for client meeting',
        downloadCount: 6,
        metadata: { duration: 180, width: 1280, height: 720, fps: 30 }
      },

      // Audio files
      {
        id: '507f1f77bcf86cd799439006',
        messageId: '507f1f77bcf86cd799439106',
        originalName: 'meeting-recording.mp3',
        fileName: '2025-08-30_507f1f77bcf86cd799439006.mp3',
        mimeType: 'audio/mpeg',
        fileSize: 4194304, // 4MB
        fileType: 'audio',
        uploadedBy: {
          id: '507f1f77bcf86cd799439204',
          fullName: 'Pham Van D',
          avatarUrl: 'https://example.com/avatar4.jpg'
        },
        uploadedAt: new Date(now.getTime() - 6 * oneDay),
        messageTimestamp: new Date(now.getTime() - 6 * oneDay),
        messageContent: 'Yesterday\'s meeting recording',
        downloadCount: 3,
        metadata: { duration: 2400, bitrate: 128, sampleRate: 44100 }
      },

      // Other file types
      {
        id: '507f1f77bcf86cd799439007',
        messageId: '507f1f77bcf86cd799439107',
        originalName: 'data-export.zip',
        fileName: '2025-08-29_507f1f77bcf86cd799439007.zip',
        mimeType: 'application/zip',
        fileSize: 10485760, // 10MB
        fileType: 'other',
        uploadedBy: {
          id: '507f1f77bcf86cd799439203',
          fullName: 'Le Van C',
          avatarUrl: 'https://example.com/avatar3.jpg'
        },
        uploadedAt: new Date(now.getTime() - 7 * oneDay),
        messageTimestamp: new Date(now.getTime() - 7 * oneDay),
        messageContent: 'Database export files',
        downloadCount: 2,
        metadata: { compressedSize: 10485760, uncompressedSize: 52428800 }
      }
    ];

    // Add file URLs dynamically
    return mockFiles.map(file => ({
      ...file,
      fileUrl: this.generateFileUrl(file.fileName, file.id),
      thumbnailUrl: file.fileType === 'image' || file.fileType === 'video'
        ? this.generateThumbnailUrl(file.id, file.mimeType)
        : undefined
    }));
  }

  /**
   * Apply filters to mock data
   * @private
   */
  private applyFiltersToMockData(files: any[], filters: any): any[] {
    let result = [...files];

    // Filter by file type
    if (filters.fileType && filters.fileType !== 'all') {
      result = result.filter(file => file.fileType === filters.fileType);
    }

    // Filter by search term
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(file =>
        file.originalName.toLowerCase().includes(searchTerm) ||
        file.messageContent?.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by file size
    if (filters.minSize) {
      result = result.filter(file => file.fileSize >= filters.minSize);
    }

    if (filters.maxSize) {
      result = result.filter(file => file.fileSize <= filters.maxSize);
    }

    return result;
  }

  /**
   * Apply sorting to mock data
   * @private
   */
  private applySortingToMockData(files: any[], sortBy: string): any[] {
    const result = [...files];

    switch (sortBy) {
      case 'newest':
        return result.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
      case 'oldest':
        return result.sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime());
      case 'size_desc':
        return result.sort((a, b) => b.fileSize - a.fileSize);
      case 'size_asc':
        return result.sort((a, b) => a.fileSize - b.fileSize);
      case 'name_asc':
        return result.sort((a, b) => a.originalName.localeCompare(b.originalName));
      case 'name_desc':
        return result.sort((a, b) => b.originalName.localeCompare(a.originalName));
      default:
        return result.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    }
  }

  /**
   * Process file results and add download URLs
   * @private
   */
  private async processFileResults(files: any[]): Promise<ConversationFilesResult['files']> {
    // TODO: Generate actual download URLs when FilesService is integrated
    return files.map(file => ({
      ...file,
      fileType: file.fileType as ConversationFileType,
      // Generate download URL
      fileUrl: file.fileUrl || this.generateFileUrl(file.fileName, file.id),
      // Generate thumbnail URL for images/videos
      thumbnailUrl: file.thumbnailUrl || this.generateThumbnailUrl(file.id, file.mimeType)
    }));
  }

  /**
   * Calculate file type statistics
   * @private
   */
  private calculateFileTypeStats(allFiles: any[]): Record<string, number> {
    const stats = {
      image: 0,
      video: 0,
      audio: 0,
      document: 0,
      other: 0
    };

    allFiles.forEach(file => {
      if (stats.hasOwnProperty(file.fileType)) {
        stats[file.fileType as keyof typeof stats]++;
      } else {
        stats.other++;
      }
    });

    return stats;
  }

  /**
   * Calculate total storage used by all files
   * @private
   */
  private calculateTotalStorageUsed(allFiles: any[]): number {
    return allFiles.reduce((total, file) => total + (file.fileSize || 0), 0);
  }

  /**
   * Get sort field for MongoDB aggregation
   * @private
   */
  private getSortField(sortBy: string): Record<string, 1 | -1> {
    switch (sortBy) {
      case 'newest':
        return { 'attachments.uploadedAt': -1 };
      case 'oldest':
        return { 'attachments.uploadedAt': 1 };
      case 'size_desc':
        return { 'attachments.fileSize': -1 };
      case 'size_asc':
        return { 'attachments.fileSize': 1 };
      case 'name_asc':
        return { 'attachments.originalName': 1 };
      case 'name_desc':
        return { 'attachments.originalName': -1 };
      default:
        return { 'attachments.uploadedAt': -1 };
    }
  }

  /**
   * Extract pagination parameters from aggregation pipeline
   * @private
   */
  private extractPaginationFromPipeline(pipeline: any[]): { page: number; limit: number } {
    let page = 1;
    let limit = 20;

    // Find skip and limit stages in pipeline
    for (const stage of pipeline) {
      if (stage.$skip !== undefined && stage.$limit !== undefined) {
        limit = stage.$limit;
        page = Math.floor(stage.$skip / limit) + 1;
        break;
      }
    }

    return { page, limit };
  }

  /**
   * Generate file download URL
   * @private
   */
  private generateFileUrl(fileName: string, fileId: string): string {
    const baseUrl = process.env.FILE_BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/api/files/${fileId}/download/${encodeURIComponent(fileName)}`;
  }

  /**
   * Generate thumbnail URL for media files
   * @private
   */
  private generateThumbnailUrl(fileId: string, mimeType: string): string | undefined {
    // Only generate thumbnails for images and videos
    if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
      return undefined;
    }

    const baseUrl = process.env.FILE_BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/api/files/${fileId}/thumbnail`;
  }

  /**
   * Determine file type category from MIME type
   * @private
   */
  private determineFileType(mimeType: string): ConversationFileType {
    if (mimeType.startsWith('image/')) {
      return ConversationFileType.IMAGE;
    }
    if (mimeType.startsWith('video/')) {
      return ConversationFileType.VIDEO;
    }
    if (mimeType.startsWith('audio/')) {
      return ConversationFileType.AUDIO;
    }
    if (
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.startsWith('text/') ||
      mimeType.startsWith('application/')
    ) {
      return ConversationFileType.DOCUMENT;
    }
    return ConversationFileType.OTHER;
  }

  /**
   * Sort files based on sort criteria
   * @private
   */
  private sortFiles(files: any[], sortBy: string): any[] {
    switch (sortBy) {
      case 'newest':
        return files.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      case 'oldest':
        return files.sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
      case 'size_desc':
        return files.sort((a, b) => b.fileSize - a.fileSize);
      case 'size_asc':
        return files.sort((a, b) => a.fileSize - b.fileSize);
      case 'name_asc':
        return files.sort((a, b) => a.originalName.localeCompare(b.originalName));
      case 'name_desc':
        return files.sort((a, b) => b.originalName.localeCompare(a.originalName));
      default:
        return files.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    }
  }

  /**
   * Check if file type should have thumbnail
   * @private
   */
  private shouldHaveThumbnail(mimeType: string): boolean {
    return mimeType.startsWith('image/') || mimeType.startsWith('video/');
  }
}
