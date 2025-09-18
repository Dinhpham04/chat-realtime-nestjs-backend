/**
 * Conversations Controller
 * 
 * 🎯 Purpose: REST API endpoints for conversation management
 * 📱 Mobile-First: Optimized for mobile messaging apps (Zalo/Messenger style)
 * 🚀 Features: Prepare conversation + Activate with first message
 */

import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  ValidationPipe,
  UsePipes,
  NotFoundException,
  Inject
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { IConversationsService } from '../services/interfaces/conversations-service.interface';
import {
  PrepareConversationDto,
  PrepareConversationResponseDto,
  ConversationResponseDto,
  CreateGroupConversationDto,
  UpdateConversationMetadataDto,
  GetUserConversationsQueryDto,
  AddParticipantsDto,
  UpdateParticipantRoleDto,
  AddParticipantsResponseDto,
  UpdateParticipantRoleResponseDto,
  RemoveParticipantResponseDto,
  LeaveConversationResponseDto,
  ConversationFilesQueryDto,
  ConversationFilesResponseDto
} from '../dto';
import {
  GroupCreationResponseDto,
  ConversationListResponseDto,
  DeleteConversationResponseDto
} from '../dto/response/group-conversation-response.dto';
import {
  PrepareConversationApiDocs,
  GetConversationApiDocs,
  ConversationFilesApiDocs
} from '../documentation';
import {
  CreateGroupConversationApiDocs,
  GetUserConversationsApiDocs,
  UpdateConversationMetadataApiDocs,
  DeleteConversationApiDocs
} from '../documentation/group-conversation-api.docs';
import {
  AddParticipantsApiDocs,
  UpdateParticipantRoleApiDocs,
  RemoveParticipantApiDocs,
  LeaveConversationApiDocs
} from '../documentation/participant-management.api-docs';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
@ApiTags('Conversations')
@ApiBearerAuth('JWT-auth')
export class ConversationsController {
  private readonly logger = new Logger(ConversationsController.name);

  constructor(
    @Inject('IConversationsService')
    private readonly conversationsService: IConversationsService,
  ) { }

  /**
   * Helper method to convert LastMessageInfo to MessageSummaryDto
   */
  private convertLastMessage(lastMessage?: any): any {
    if (!lastMessage) return undefined;

    return {
      id: lastMessage.messageId,
      content: lastMessage.content,
      messageType: lastMessage.messageType,
      senderId: lastMessage.senderId,
      createdAt: lastMessage.sentAt?.toISOString() || new Date().toISOString()
    };
  }

  /**
   * Helper method to convert ConversationWithParticipants to ConversationResponseDto
   */
  private convertToResponseDto(conversation: any): ConversationResponseDto {
    return {
      ...conversation,
      lastMessage: this.convertLastMessage(conversation.lastMessage),
      participants: conversation.participants?.map((p: any) => ({
        userId: p.userId,
        role: p.role,
        joinedAt: p.joinedAt?.toISOString() || new Date().toISOString(),
        addedBy: p.addedBy,
        user: {
          id: p.userId,
          username: p.username || '',
          fullName: p.fullName || '',
          avatar: p.avatarUrl || '',
        }
      })) || [],
      settings: {
        allowMemberInvite: true,
        allowMemberLeave: true,
        requireAdminApproval: false,
        maxParticipants: 1000,
        isPublic: false
      },
      status: {
        isActive: conversation.isActive,
        isArchived: false,
        isPinned: false
      },
      permissions: {
        canSendMessages: true,
        canAddMembers: true,
        canRemoveMembers: true,
        canEditGroup: true,
        canDeleteGroup: true,
        isAdmin: true
      }
    };
  }


  @Post('/create-direct')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @PrepareConversationApiDocs()
  async prepareConversation(
    @CurrentUser() user: any,
    @Body() prepareDto: PrepareConversationDto
  ): Promise<PrepareConversationResponseDto> {
    this.logger.log(
      `Preparing conversation between ${user.userId} and ${prepareDto.participantId}`
    );

    const result = await this.conversationsService.createDirectConversation(
      user.userId,
      prepareDto.participantId
    );

    this.logger.log(
      `Conversation prepared: ${result.conversationId}, exists: ${result.exists}, active: ${result.isActive}`
    );

    return {
      conversationId: result.conversationId,
      exists: result.exists,
      isActive: result.isActive,
      participant: result.participant,
      conversation: result.conversation!
    };
  }

  /**
   * Get Conversation In
   * 
   * 🎯 Purpose: Get full conversation info for active conversations
   * 📱 UX: Load conversation details when entering chat screen
   */
  @Get('/:conversationId')
  @GetConversationApiDocs()
  async getConversation(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string
  ): Promise<ConversationResponseDto> {
    this.logger.log(`Getting conversation ${conversationId} for user ${user.userId}`);

    const conversation = await this.conversationsService.getConversationById(
      conversationId,
      user.userId
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    this.logger.log(`Retrieved conversation: ${conversation.id}`);
    this.logger.debug(`Conversation details: `, conversation);

    return this.convertToResponseDto(conversation);
  }

  /**
   * Create Group Conversation
   * 
   * 🎯 Purpose: Create new group chat with multiple participants
   * 📱 UX: Handle group creation from contact selection
   * 🔒 Security: Validate all participants exist and user has permission
   */
  @Post('/group')
  @CreateGroupConversationApiDocs()
  @UsePipes(new ValidationPipe({ transform: true }))
  async createGroupConversation(
    @CurrentUser() user: any,
    @Body() createGroupDto: CreateGroupConversationDto
  ): Promise<GroupCreationResponseDto> {
    this.logger.log(`Creating group conversation: ${createGroupDto.name} by user: ${user.userId}`);

    const result = await this.conversationsService.createGroupConversation(user.userId, {
      name: createGroupDto.name,
      description: createGroupDto.description,
      participantIds: createGroupDto.participantIds,
      avatarUrl: createGroupDto.avatarUrl,
      settings: createGroupDto.settings,
      initialMessage: createGroupDto.initialMessage
    });

    this.logger.log(`Group conversation created: ${result.conversation.id}`);

    return {
      conversation: {
        id: result.conversation.id,
        type: result.conversation.type as 'direct' | 'group',
        name: result.conversation.name,
        description: result.conversation.description,
        avatarUrl: result.conversation.avatarUrl,
        participants: result.conversation.participants.map(p => ({
          userId: p.userId,
          role: p.role as 'admin' | 'member',
          joinedAt: p.joinedAt,
          user: {
            id: p.user.id,
            username: p.user.username,
            fullName: p.user.fullName,
            avatarUrl: p.user.avatarUrl,
            isOnline: p.user.isOnline,
            lastSeen: undefined
          }
        })),
        createdBy: result.conversation.createdBy,
        createdAt: result.conversation.createdAt,
        updatedAt: result.conversation.updatedAt,
        lastMessage: undefined,
        isActive: result.conversation.isActive,
        unreadCount: result.conversation.unreadCount,
        settings: {
          allowMemberInvite: result.conversation.settings.allowMembersToAdd,
          allowMemberLeave: true,
          requireAdminApproval: false,
          maxParticipants: 1000,
          isPublic: false
        },
        status: {
          isActive: result.conversation.isActive,
          isArchived: false,
          isPinned: false
        },
        permissions: {
          canSendMessages: true,
          canAddMembers: true,
          canRemoveMembers: true,
          canEditGroup: true,
          canDeleteGroup: true,
          isAdmin: true
        }
      },
      invitesSent: result.invitesSent,
      initialMessage: result.initialMessage
    };
  }

  /**
   * Get User's Conversations
   * 
   * 🎯 Purpose: Get paginated list of user's conversations
   * 📱 UX: Load conversation list in chat screen
   * ⚡ Performance: Optimized with pagination and filtering
   */
  @Get('/')
  @GetUserConversationsApiDocs()
  @UsePipes(new ValidationPipe({ transform: true }))
  async getUserConversations(
    @CurrentUser() user: any,
    @Query() query: GetUserConversationsQueryDto
  ): Promise<ConversationListResponseDto> {
    this.logger.log(`Getting conversations for user: ${user.userId}`, query);

    const startTime = Date.now();
    const result = await this.conversationsService.getUserConversations(user.userId, {
      type: query.type,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
      search: query.search,
      sortBy: query.sortBy,
      pinnedOnly: query.pinnedOnly,
      unreadOnly: query.unreadOnly
    });

    this.logger.debug(`found conversation: `, result.conversations);

    const responseTime = Date.now() - startTime;

    this.logger.log(
      `Retrieved ${result.conversations.length} conversations for user: ${user.userId} in ${responseTime}ms`
    );

    return {
      conversations: result.conversations.map(conv => ({
        id: conv.id,
        type: conv.type as 'direct' | 'group',
        name: conv.name,
        description: undefined,
        avatarUrl: conv.avatarUrl,
        participants: [], // Lightweight response
        createdBy: '', // Not needed for list
        createdAt: '',
        updatedAt: '',
        lastMessage: conv.lastMessage ? {
          id: conv.lastMessage.id,
          content: conv.lastMessage.content,
          messageType: conv.lastMessage.messageType,
          senderId: conv.lastMessage.senderId,
          createdAt: conv.lastMessage.createdAt
        } : undefined,
        isActive: true,
        unreadCount: conv.unreadCount,
        settings: {
          allowMemberInvite: true,
          allowMemberLeave: true,
          requireAdminApproval: false,
          maxParticipants: 1000,
          isPublic: false
        },
        status: {
          isActive: true,
          isArchived: conv.isArchived,
          isPinned: conv.isPinned
        },
        permissions: {
          canSendMessages: true,
          canAddMembers: false,
          canRemoveMembers: false,
          canEditGroup: false,
          canDeleteGroup: false,
          isAdmin: false
        }
      })),
      total: result.total,
      hasMore: result.hasMore,
      nextOffset: result.nextOffset,
      meta: {
        requestedAt: new Date().toISOString(),
        responseTime
      }
    };
  }

  /**
   * Update Conversation Metadata
   * 
   * 🎯 Purpose: Update group name, description, avatar, settings
   * 📱 UX: Handle group info editing
   * 🔒 Security: Only admins can update group metadata
   */
  @Put('/:conversationId')
  @UpdateConversationMetadataApiDocs()
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateConversationMetadata(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Body() updateDto: UpdateConversationMetadataDto
  ): Promise<ConversationResponseDto> {
    this.logger.log(`Updating conversation ${conversationId} by user: ${user.userId}`);

    const result = await this.conversationsService.updateConversationMetadata(
      conversationId,
      user.userId,
      {
        name: updateDto.name,
        description: updateDto.description,
        avatarUrl: updateDto.avatarUrl,
        settings: updateDto.settings
      }
    );

    this.logger.log(
      `Conversation ${conversationId} updated successfully. Changes: ${result.changes.join(', ')}`
    );

    // Use the updated conversation from the service result instead of fetching again
    const conversationInfo = result.conversation;

    return {
      id: conversationInfo.id,
      type: conversationInfo.type as 'direct' | 'group',
      name: conversationInfo.name,
      description: conversationInfo.description,
      avatarUrl: conversationInfo.avatarUrl,
      participants: [], // Will be populated when needed
      createdBy: '',
      createdAt: '',
      updatedAt: conversationInfo.updatedAt,
      lastMessage: undefined,
      isActive: true,
      unreadCount: 0,
      settings: {
        allowMemberInvite: true,
        allowMemberLeave: true,
        requireAdminApproval: false,
        maxParticipants: 1000,
        isPublic: false
      },
      status: {
        isActive: true,
        isArchived: false,
        isPinned: false
      },
      permissions: {
        canSendMessages: true,
        canAddMembers: true,
        canRemoveMembers: true,
        canEditGroup: true,
        canDeleteGroup: true,
        isAdmin: true
      }
    };
  }

  /**
   * Delete Conversation (Groups Only)
   * 
   * 🎯 Purpose: Delete group conversation (soft delete)
   * 📱 UX: Handle group deletion by admin
   * 🔒 Security: Only group admins can delete
   */
  @Delete('/:conversationId')
  @DeleteConversationApiDocs()
  async deleteConversation(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string
  ): Promise<DeleteConversationResponseDto> {
    this.logger.log(`Deleting conversation ${conversationId} by user: ${user.userId}`);

    const result = await this.conversationsService.deleteConversation(conversationId, user.userId);

    this.logger.log(`Conversation ${conversationId} deleted successfully`);

    return {
      success: result.success,
      deletedAt: result.deletedAt,
      participantsNotified: result.participantsNotified
    };
  }

  // =============== PARTICIPANT MANAGEMENT ENDPOINTS ===============

  /**
   * Add participants to group conversation
   * 
   * 🎯 Purpose: Add multiple users to group conversation
   * 📱 UX: Group admin can add contacts to conversation
   * 🔒 Security: Only admins can add participants
   */
  @Post('/:conversationId/participants')
  @AddParticipantsApiDocs()
  @UsePipes(new ValidationPipe({ transform: true }))
  async addParticipants(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Body() addParticipantsDto: AddParticipantsDto
  ): Promise<AddParticipantsResponseDto> {
    this.logger.log(`Adding participants to conversation ${conversationId} by admin: ${user.userId}`);

    const result = await this.conversationsService.addParticipants(
      conversationId,
      user.userId,
      addParticipantsDto.userIds,
      addParticipantsDto.role
    );

    this.logger.log(`Added ${result.added.length} participants to conversation ${conversationId}`);

    return {
      added: result.added,
      failed: result.failed,
      totalParticipants: result.totalParticipants
    };
  }

  /**
   * Update participant role in conversation
   * 
   * 🎯 Purpose: Promote/demote participant role (admin ↔ member)
   * 📱 UX: Admin can manage group member permissions
   * 🔒 Security: Only admins can change roles
   */
  @Put('/:conversationId/participants/:userId')
  @UpdateParticipantRoleApiDocs()
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateParticipantRole(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Param('userId') userId: string,
    @Body() updateRoleDto: UpdateParticipantRoleDto
  ): Promise<UpdateParticipantRoleResponseDto> {
    this.logger.log(`Updating role of ${userId} to ${updateRoleDto.role} in conversation ${conversationId}`);

    const result = await this.conversationsService.updateParticipantRole(
      conversationId,
      user.userId,
      userId,
      updateRoleDto.role
    );

    this.logger.log(`Successfully updated ${userId} role to ${updateRoleDto.role}`);

    return {
      participant: result.participant,
      previousRole: result.previousRole,
      updatedAt: result.updatedAt
    };
  }

  /**
   * Remove participant from conversation
   * 
   * 🎯 Purpose: Remove user from group conversation (kick)
   * 📱 UX: Admin can remove disruptive members
   * 🔒 Security: Only admins can remove others
   */
  @Delete('/:conversationId/participants/:userId')
  @RemoveParticipantApiDocs()
  async removeParticipant(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Param('userId') userId: string
  ): Promise<RemoveParticipantResponseDto> {
    this.logger.log(`Removing participant ${userId} from conversation ${conversationId} by admin: ${user.userId}`);

    const result = await this.conversationsService.removeParticipant(
      conversationId,
      user.userId,
      userId
    );

    this.logger.log(`Successfully removed ${userId} from conversation ${conversationId}`);

    return {
      success: true,
      removedUserId: result.removedUserId,
      removedAt: result.removedAt,
      remainingParticipants: result.remainingParticipants
    };
  }

  /**
   * Leave conversation
   * 
   * 🎯 Purpose: Current user leaves the conversation
   * 📱 UX: User can leave group conversation they no longer want to be in
   * 🔒 Security: User can only remove themselves
   */
  @Post('/:conversationId/leave')
  @LeaveConversationApiDocs()
  async leaveConversation(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string
  ): Promise<LeaveConversationResponseDto> {
    this.logger.log(`User ${user.userId} leaving conversation ${conversationId}`);

    const result = await this.conversationsService.leaveConversation(
      conversationId,
      user.userId
    );

    this.logger.log(`User ${user.userId} successfully left conversation ${conversationId}`);

    return {
      success: true,
      leftAt: result.leftAt,
      remainingParticipants: result.remainingParticipants
    };
  }

  /**
   * Get conversation files/media
   * 
   * 🎯 Purpose: Retrieve all files shared in a conversation
   * 📱 Mobile-First: Optimized for mobile gallery/media views
   * 🔒 Security: Only conversation members can access files
   * 
   * Features:
   * - Paginated file list with filtering
   * - File type filtering (images, videos, documents, etc.)
   * - Search by filename
   * - Sort by date, size, name
   * - File statistics and storage usage
   * - Download URLs and thumbnails
   */
  @Get('/:conversationId/files')
  @ConversationFilesApiDocs()
  async getConversationFiles(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string,
    @Query() query: ConversationFilesQueryDto
  ): Promise<ConversationFilesResponseDto> {
    this.logger.log(`Getting files for conversation ${conversationId}, user ${user.userId}`, query);

    const result = await this.conversationsService.getConversationFiles(
      conversationId,
      user.userId,
      {
        page: query.page,
        limit: query.limit,
        fileType: query.fileType,
        sortBy: query.sortBy,
        search: query.search,
        minSize: query.minSize,
        maxSize: query.maxSize
      }
    );

    this.logger.log(`Retrieved ${result.files.length} files for conversation ${conversationId}`);

    return {
      files: result.files,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
      hasPreviousPage: result.hasPreviousPage,
      fileTypeStats: result.fileTypeStats,
      totalStorageUsed: result.totalStorageUsed
    };
  }
}
