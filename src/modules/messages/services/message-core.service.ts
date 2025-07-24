/**
 * Message Service - Core Business Logic (Simplified Version)
 * 
 * 🎯 Purpose: Essential message operations with proper error handling
 * 📱 Mobile-First: Optimized for real-time messaging
 * 🚀 Clean Architecture: Service layer following senior standards
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { IMessageRepository } from '../interfaces/message-repository.interface';
import { MessageValidationService } from './message-validation.service';
import {
  SendMessageDto,
  EditMessageDto,
  MessagePaginationDto,
  MessageResponse,
  PaginatedMessagesResponse
} from '../dto';
import {
  CreateMessageData,
  UpdateMessageData,
  MessageDeliveryStatus,
  MessageType,
  MessageInfo,
  MessageStatus
} from '../types/message.types';
import {
  MessageNotFoundError,
  MessageUnauthorizedError,
  MessageEditNotAllowedError,
  MessageAlreadyDeletedError,
  ConversationAccessError,
  MessageRateLimitError
} from '../exceptions/message-service.exceptions';

/**
 * User context for authorization
 */
export interface UserContext {
  userId: string;
  deviceId?: string;
  conversationMemberships: string[]; // Conversation IDs user is member of
  roles?: string[];
}

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  // Rate limiting tracking (simplified for demo)
  private readonly rateLimitTracker = new Map<string, { count: number; resetTime: number }>();
  private readonly RATE_LIMIT_MESSAGES_PER_MINUTE = 60;
  private readonly RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

  constructor(
    @Inject('IMessageRepository')
    private readonly messageRepository: IMessageRepository,
    private readonly validationService: MessageValidationService
  ) { }

  /**
   * Send a new message
   */
  async sendMessage(
    dto: SendMessageDto,
    userContext: UserContext
  ): Promise<MessageResponse> {
    this.logger.debug(`Sending message in conversation: ${dto.conversationId}`);

    try {
      // Rate limiting check
      await this.checkRateLimit(userContext.userId);

      // Validation
      await this.validationService.validateSendMessage(dto);

      // Authorization check
      await this.checkConversationAccess(dto.conversationId, userContext);

      // Create message data
      const createData: CreateMessageData = {
        conversationId: dto.conversationId,
        senderId: userContext.userId,
        messageType: dto.messageType,
        content: this.formatMessageContent(dto.messageType, dto.content)
      };

      // Repository operation
      const message = await this.messageRepository.create(createData);

      // Convert to response format
      const response = this.convertToMessageResponse(message, userContext);

      this.logger.debug(`Message sent successfully: ${message._id}`);
      return response;

    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Edit an existing message
   */
  async editMessage(
    messageId: string,
    dto: EditMessageDto,
    userContext: UserContext
  ): Promise<MessageResponse> {
    this.logger.debug(`Editing message: ${messageId}`);

    try {
      // Get existing message
      const existingMessage = await this.messageRepository.findById(messageId);
      if (!existingMessage) {
        throw new MessageNotFoundError(messageId);
      }

      // Check if message is deleted
      if (existingMessage.isDeleted) {
        throw new MessageAlreadyDeletedError(messageId);
      }

      // Authorization check
      await this.checkMessageEditPermission(existingMessage, userContext);

      // Business rule: Only allow editing within time limit (e.g., 15 minutes)
      this.checkEditTimeLimit(existingMessage);

      // Validation
      await this.validationService.validateEditMessage(existingMessage.messageType, dto);

      // Create update data
      const updateData: UpdateMessageData = {
        content: this.formatMessageContent(existingMessage.messageType, dto.content)
      };

      // Repository operation
      const updatedMessage = await this.messageRepository.update(messageId, updateData);

      // Convert to response format
      const response = this.convertToMessageResponse(updatedMessage, userContext);

      this.logger.debug(`Message edited successfully: ${messageId}`);
      return response;

    } catch (error) {
      this.logger.error(`Failed to edit message ${messageId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(
    messageId: string,
    userContext: UserContext
  ): Promise<boolean> {
    this.logger.debug(`Deleting message: ${messageId}`);

    try {
      // Get existing message
      const existingMessage = await this.messageRepository.findById(messageId);
      if (!existingMessage) {
        throw new MessageNotFoundError(messageId);
      }

      // Check if already deleted
      if (existingMessage.isDeleted) {
        throw new MessageAlreadyDeletedError(messageId);
      }

      // Authorization check
      await this.checkMessageDeletePermission(existingMessage, userContext);

      // Repository operation
      const success = await this.messageRepository.softDelete(messageId);

      this.logger.debug(`Message deleted successfully: ${messageId}`);
      return success;

    } catch (error) {
      this.logger.error(`Failed to delete message ${messageId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get conversation messages with pagination
   */
  async getConversationMessages(
    conversationId: string,
    pagination: MessagePaginationDto,
    userContext: UserContext
  ): Promise<PaginatedMessagesResponse> {
    this.logger.debug(`Getting messages for conversation: ${conversationId}`);

    try {
      // Authorization check
      await this.checkConversationAccess(conversationId, userContext);

      const startTime = Date.now();

      // Repository operation
      const result = await this.messageRepository.findByConversation(conversationId, {
        limit: pagination.limit || 20
      });

      // Convert messages to response format
      const messageResponses = result.messages.map(message =>
        this.convertToMessageResponse(message, userContext)
      );

      const response: PaginatedMessagesResponse = {
        messages: messageResponses,
        pagination: {
          hasMore: result.hasMore,
          nextCursor: undefined // Simplified pagination
        },
        meta: {
          conversationId,
          requestedAt: new Date().toISOString(),
          responseTime: Date.now() - startTime
        }
      };

      this.logger.debug(`Retrieved ${messageResponses.length} messages for conversation: ${conversationId}`);
      return response;

    } catch (error) {
      this.logger.error(`Failed to get conversation messages: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(
    messageId: string,
    userContext: UserContext
  ): Promise<boolean> {
    this.logger.debug(`Marking message as read: ${messageId}`);

    try {
      // Get message to verify it exists and user has access
      const message = await this.messageRepository.findById(messageId);
      if (!message) {
        throw new MessageNotFoundError(messageId);
      }

      // Authorization check
      await this.checkConversationAccess(message.conversationId.toString(), userContext);

      // Repository operation
      const success = await this.messageRepository.updateDeliveryStatus(
        messageId,
        userContext.userId,
        MessageDeliveryStatus.READ,
        userContext.deviceId
      );

      this.logger.debug(`Message marked as read successfully: ${messageId}`);
      return success;

    } catch (error) {
      this.logger.error(`Failed to mark message as read: ${error.message}`, error.stack);
      throw error;
    }
  }

  // =============== PRIVATE HELPER METHODS ===============

  /**
   * Check rate limiting for user
   */
  private async checkRateLimit(userId: string): Promise<void> {
    const now = Date.now();
    const userKey = `rate_limit_${userId}`;
    const userLimit = this.rateLimitTracker.get(userKey);

    if (!userLimit || now > userLimit.resetTime) {
      // Reset or initialize rate limit
      this.rateLimitTracker.set(userKey, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW_MS
      });
      return;
    }

    if (userLimit.count >= this.RATE_LIMIT_MESSAGES_PER_MINUTE) {
      throw new MessageRateLimitError(
        this.RATE_LIMIT_MESSAGES_PER_MINUTE,
        '1 minute'
      );
    }

    userLimit.count++;
  }

  /**
   * Check if user has access to conversation
   */
  private async checkConversationAccess(
    conversationId: string,
    userContext: UserContext
  ): Promise<void> {
    if (!userContext.conversationMemberships.includes(conversationId)) {
      throw new ConversationAccessError(conversationId, userContext.userId);
    }
  }

  /**
   * Check if user can edit the message
   */
  private async checkMessageEditPermission(
    message: any,
    userContext: UserContext
  ): Promise<void> {
    // Only sender can edit their own messages
    if (message.senderId.toString() !== userContext.userId) {
      throw new MessageUnauthorizedError('edit', message._id?.toString());
    }

    // System messages cannot be edited
    if (message.messageType === MessageType.SYSTEM) {
      throw new MessageEditNotAllowedError('System messages cannot be edited', message._id?.toString());
    }
  }

  /**
   * Check if user can delete the message
   */
  private async checkMessageDeletePermission(
    message: any,
    userContext: UserContext
  ): Promise<void> {
    // Sender can always delete their own messages
    if (message.senderId.toString() === userContext.userId) {
      return;
    }

    // Check if user has admin/moderator roles in conversation
    if (userContext.roles?.includes('admin') || userContext.roles?.includes('moderator')) {
      return;
    }

    throw new MessageUnauthorizedError('delete', message._id?.toString());
  }

  /**
   * Check edit time limit (15 minutes)
   */
  private checkEditTimeLimit(message: any): void {
    const EDIT_TIME_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
    const now = new Date();
    const messageTime = new Date(message.createdAt);

    if (now.getTime() - messageTime.getTime() > EDIT_TIME_LIMIT_MS) {
      throw new MessageEditNotAllowedError(
        'Message can only be edited within 15 minutes',
        message._id?.toString()
      );
    }
  }

  /**
   * Format message content based on type
   */
  private formatMessageContent(messageType: MessageType, content: any): any {
    // Content formatting and sanitization based on message type
    switch (messageType) {
      case MessageType.TEXT:
        return {
          text: content.text?.trim(),
          mentions: content.mentions || []
        };
      case MessageType.LOCATION:
        return {
          text: `Location: ${content.latitude}, ${content.longitude}`,
          mentions: []
        };
      case MessageType.IMAGE:
      case MessageType.VIDEO:
      case MessageType.AUDIO:
        return {
          text: content.filename || 'Media file',
          mentions: []
        };
      case MessageType.FILE:
        return {
          text: content.filename || 'File attachment',
          mentions: []
        };
      default:
        return {
          text: content.text || '',
          mentions: []
        };
    }
  }

  /**
   * Convert message entity to response DTO
   */
  private convertToMessageResponse(
    message: any,
    userContext: UserContext
  ): MessageResponse {
    return {
      id: message._id?.toString() || '',
      conversationId: message.conversationId?.toString() || '',
      sender: {
        id: message.senderId?.toString() || '',
        name: 'User Name', // TODO: Populate from user service
        avatar: undefined
      },
      messageType: message.messageType,
      content: this.formatContentForResponse(message.messageType, message.content),
      replyTo: undefined, // TODO: Populate if replyTo exists
      mentions: [], // TODO: Populate from mentions
      reactions: [], // TODO: Populate from reactions
      createdAt: message.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: message.updatedAt?.toISOString(),
      isEdited: message.isEdited || false,
      isDeleted: message.isDeleted || false,
      status: MessageStatus.SENT, // TODO: Get actual status for user
      clientMessageId: message.clientMessageId
    };
  }

  /**
   * Format content for response
   */
  private formatContentForResponse(messageType: MessageType, content: any): any {
    switch (messageType) {
      case MessageType.TEXT:
        return { text: content?.text || '' };
      case MessageType.LOCATION:
        return {
          location: {
            latitude: content?.latitude,
            longitude: content?.longitude,
            address: content?.address
          }
        };
      case MessageType.IMAGE:
      case MessageType.VIDEO:
      case MessageType.AUDIO:
        return {
          media: {
            url: content?.url,
            filename: content?.filename,
            size: content?.size,
            duration: content?.duration
          }
        };
      case MessageType.FILE:
        return {
          file: {
            url: content?.url,
            filename: content?.filename,
            size: content?.size,
            mimeType: content?.mimeType
          }
        };
      default:
        return { text: content?.text || '' };
    }
  }
}
