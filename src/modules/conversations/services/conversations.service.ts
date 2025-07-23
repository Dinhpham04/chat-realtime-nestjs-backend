/**
 * Conversations Service Implementation
 * 
 * 🎯 Purpose: Core business logic for conversation management
 * 📱 Mobile-First: Zalo/Messenger-style conversation handling
 * 🚀 Clean Architecture: Service layer implementation
 */

import { Injectable, Logger, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  IConversationsService,
  PrepareConversationResult,
  ActivateConversationResult,
  InitialMessageData
} from './interfaces/conversations-service.interface';
import { IUsersService } from '../../users/services/interfaces/users-service.interface';
import { IConversationRepository } from '../repositories/interfaces/conversation-repository.interface';
import { ConversationType, ParticipantRole } from '../types/conversation.types';
import { StorageProvider } from '../../messages/types/message-attachment.types';

@Injectable()
export class ConversationsService implements IConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    @Inject('IConversationRepository')
    private readonly conversationRepository: IConversationRepository,

    @Inject('IUsersService')
    private readonly usersService: IUsersService,

    // @Inject(forwardRef(() => 'IMessagesService'))
    // private readonly messagesService: IMessagesService,
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
  async prepareDirectConversation(
    userId: string,
    participantId: string
  ): Promise<PrepareConversationResult> {
    this.logger.log(`Preparing direct conversation between ${userId} and ${participantId}`);

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

      let conversationResult: any;
      let exists = false;
      let isActive = false;

      if (existingConversation) {
        // Conversation already exists
        exists = true;
        isActive = existingConversation.isActive;
        conversationResult = existingConversation;

        this.logger.log(`Found existing conversation: ${existingConversation.id}, active: ${isActive}`);
      } else {
        // Step 3: Create dormant conversation (not active until first message)
        const conversationData = {
          type: ConversationType.DIRECT,
          createdBy: userId, // String as per interface
          isActive: false, // Key: Dormant until first message
          lastActivity: new Date()
        };

        conversationResult = await this.conversationRepository.create(conversationData);
        exists = false;
        isActive = false;

        this.logger.log(`Created dormant conversation: ${conversationResult.id}`);
      }

      // Step 4: Build response with participant info
      const result: PrepareConversationResult = {
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
          createdAt: conversationResult.createdAt.toISOString(),
          lastActivity: conversationResult.lastActivity.toISOString()
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
   * Activate Conversation with First Message
   * 
   * Business Logic:
   * 1. Validate conversation exists and user is participant
   * 2. Create and send the initial message
   * 3. Mark conversation as active
   * 4. Update last message reference
   * 5. Return full conversation context
   */
  async activateConversation(
    conversationId: string,
    senderId: string,
    initialMessageData: InitialMessageData
  ): Promise<ActivateConversationResult> {
    this.logger.log(`Activating conversation ${conversationId} with message from ${senderId}`);

    try {
      // Step 1: Validate conversation exists
      const conversation = await this.conversationRepository.findByIdWithParticipants(conversationId);

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      // Step 2: Validate user is participant
      const isParticipant = conversation.participants.some(p =>
        p.userId.toString() === senderId
      );

      if (!isParticipant) {
        throw new BadRequestException('User is not a participant in this conversation');
      }

      // Step 3: Start transaction for atomic operations
      return await this.conversationRepository.withTransaction(async () => {
        // Step 4: Send initial message - TRANSFORM DATA TO MATCH MessagesService
        const messageData = {
          conversationId,
          senderId,
          messageType: initialMessageData.messageType || 'text',
          content: {
            text: initialMessageData.content.text,
            mentions: initialMessageData.content.mentions?.map(m => m.userId) || []
          },
          // Transform attachments to match CreateMessageAttachmentData structure
          attachments: initialMessageData.attachments?.map(att => ({
            messageId: '', // Will be set by repository
            uploadedBy: senderId,
            fileInfo: {
              originalName: att.originalName,
              fileName: att.fileName,
              mimeType: att.mimeType,
              fileSize: att.fileSize,
              checksum: 'pending' // Will be calculated during upload
            },
            storage: {
              storageProvider: 'local' as const,
              storagePath: att.url,
              publicUrl: att.url
            }
          })) || [],
          metadata: initialMessageData.metadata || {}
        };

        // const message = await this.messagesService.createMessage(messageData);
        const message: any = {};

        // Step 5: Activate conversation and update last message
        const updateData = {
          isActive: true,
          lastMessage: {
            messageId: message.id,
            senderId: new Types.ObjectId(senderId),
            content: initialMessageData.content.text,
            messageType: messageData.messageType,
            sentAt: new Date()
          },
          lastActivity: new Date()
        };

        await this.conversationRepository.updateById(conversationId, updateData);

        // Step 6: Get full conversation details for response
        const fullConversation = await this.conversationRepository.findByIdWithParticipants(conversationId);

        if (!fullConversation) {
          throw new NotFoundException('Conversation not found after update');
        }

        // Step 7: Build response - use CompleteMessageResponse with proper type conversion
        const result: ActivateConversationResult = {
          conversation: {
            id: fullConversation.id.toString(),
            type: fullConversation.type,
            participants: [], // TODO: Will populate when types are aligned
            createdBy: fullConversation.createdBy.toString(),
            createdAt: fullConversation.createdAt.toISOString(),
            updatedAt: fullConversation.updatedAt.toISOString(),
            lastMessage: {
              id: message.id.toString(),
              content: message.content.text,
              messageType: message.messageType as 'text' | 'image' | 'file' | 'video' | 'audio',
              senderId: message.senderId.toString(),
              createdAt: message.createdAt.toISOString()
            },
            isActive: true,
            unreadCount: 0 // Sender has read their own message
          },
          message: {
            id: message.id.toString(),
            conversationId: message.conversationId.toString(),
            senderId: message.senderId.toString(),
            messageType: message.messageType as 'text' | 'image' | 'file' | 'video' | 'audio',
            content: {
              text: message.content.text,
              mentions: initialMessageData.content.mentions || []
            },
            attachments: message.attachments.map(att => ({
              id: 'generated-id', // TODO: Generate proper attachment ID
              fileName: att.fileName,
              originalName: att.originalName,
              mimeType: att.mimeType,
              fileSize: att.fileSize,
              url: att.url
            })),
            createdAt: message.createdAt.toISOString(),
            updatedAt: message.updatedAt.toISOString()
          },
          created: !conversation.isActive // true if this was the activation message
        };

        this.logger.log(`Activated conversation ${conversationId} successfully`);
        return result;
      });

    } catch (error) {
      this.logger.error(`Error activating conversation: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get conversation by ID with full details
   */
  async getConversationById(
    conversationId: string,
    userId: string
  ): Promise<ActivateConversationResult['conversation'] | null> {
    this.logger.log(`Getting conversation ${conversationId} for user ${userId}`);

    try {
      const conversation = await this.conversationRepository.findByIdWithParticipants(conversationId);

      if (!conversation) {
        return null;
      }

      // Check if user is participant
      const isParticipant = conversation.participants.some(p =>
        p.userId.toString() === userId
      );

      if (!isParticipant) {
        throw new BadRequestException('Access denied to this conversation');
      }

      // Return simplified conversation for now
      return {
        id: conversation.id.toString(),
        type: conversation.type,
        participants: [], // TODO: Will populate when types are aligned
        createdBy: conversation.createdBy.toString(),
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
        lastMessage: conversation.lastMessage ? {
          id: conversation.lastMessage.messageId.toString(),
          content: conversation.lastMessage.content,
          messageType: 'text',
          senderId: conversation.lastMessage.senderId.toString(),
          createdAt: conversation.lastMessage.sentAt.toISOString()
        } : null,
        isActive: conversation.isActive,
        unreadCount: 0 // TODO: Calculate actual unread count
      };

    } catch (error) {
      this.logger.error(`Error getting conversation: ${error.message}`, error.stack);
      throw error;
    }
  }
}
