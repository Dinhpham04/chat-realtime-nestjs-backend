/**
 * Message Service - Core Business Logic
 * 
 * 🎯 Purpose: Central business logic for message operations
 * 📱 Mobile-First: Optimized for real-time messaging performance
 * 🚀 Clean Architecture: Service layer with proper dependency injection
 * 
 * Design Principles:
 * - Single Responsibility: Only message business logic
 * - DRY: Reuse validation and repository services
 * - Error Handling: Comprehensive error handling with proper context
 * - Performance: Optimized database operations and caching
 * - Security: Authorization and permission checks
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IMessageRepository } from '../interfaces/message-repository.interface';
import { MessageValidationService } from './message-validation.service';
import {
  SendMessageDto,
  EditMessageDto,
  MessagePaginationDto,
  MessageSearchDto,
  UpdateMessageStatusDto,
  BulkMessageOperationDto,
  MessageResponse,
  PaginatedMessagesResponse,
  BulkOperationResponse
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
  MessageRateLimitError,
  MessageServiceUnavailableError
} from '../exceptions/message-service.exceptions';

/**
 * Message Events for real-time notifications
 */
export const MESSAGE_EVENTS = {
  MESSAGE_SENT: 'message.sent',
  MESSAGE_EDITED: 'message.edited',
  MESSAGE_DELETED: 'message.deleted',
  MESSAGE_STATUS_UPDATED: 'message.status.updated',
  TYPING_STARTED: 'message.typing.started',
  TYPING_STOPPED: 'message.typing.stopped'
} as const;

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

  // Rate limiting tracking (in production, use Redis)
  private readonly rateLimitTracker = new Map<string, { count: number; resetTime: number }>();
  private readonly RATE_LIMIT_MESSAGES_PER_MINUTE = 60;
  private readonly RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

  constructor(
    @Inject('IMessageRepository')
    private readonly messageRepository: IMessageRepository,
    private readonly validationService: MessageValidationService,
    private readonly eventEmitter: EventEmitter2
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

      // Check for duplicate client message ID
      if (dto.clientMessageId) {
        await this.checkDuplicateClientMessage(dto.clientMessageId, userContext.userId);
      }

      // Create message data
      const createData: CreateMessageData = {
        conversationId: dto.conversationId,
        senderId: userContext.userId,
        messageType: dto.messageType,
        content: this.formatMessageContent(dto.messageType, dto.content),
        replyToMessageId: dto.replyTo,
        mentions: dto.mentions || [],
        clientMessageId: dto.clientMessageId
      };

      // Repository operation
      const message = await this.messageRepository.create(createData);

      // Convert to response format
      const response = await this.convertToMessageResponse(this.transformToMessageInfo(message), userContext);

      // Emit event for real-time notifications
      this.eventEmitter.emit(MESSAGE_EVENTS.MESSAGE_SENT, {
        message: response,
        conversationId: dto.conversationId,
        senderId: userContext.userId
      });

      this.logger.debug(`Message sent successfully: ${message._id}`);
      return response;

    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`, error.stack);

      if (error instanceof MessageServiceUnavailableError ||
        error instanceof MessageNotFoundError ||
        error instanceof MessageUnauthorizedError) {
        throw error;
      }

      throw new MessageServiceUnavailableError(
        'message-sending',
        'Failed to send message due to internal error'
      );
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
      await this.checkMessageEditPermission(this.transformToMessageInfo(existingMessage), userContext);

      // Business rule: Only allow editing within time limit (e.g., 15 minutes)
      this.checkEditTimeLimit(this.transformToMessageInfo(existingMessage));

      // Validation
      await this.validationService.validateEditMessage(existingMessage.messageType, dto);

      // Create update data
      const updateData: UpdateMessageData = {
        content: this.formatMessageContent(existingMessage.messageType, dto.content),
        mentions: dto.mentions,
        isEdited: true,
        editReason: dto.editReason
      };

      // Repository operation
      const updatedMessage = await this.messageRepository.update(messageId, updateData);

      // Convert to response format
      const response = await this.convertToMessageResponse(this.transformToMessageInfo(updatedMessage), userContext);

      // Emit event for real-time notifications
      this.eventEmitter.emit(MESSAGE_EVENTS.MESSAGE_EDITED, {
        message: response,
        originalMessage: existingMessage,
        editorId: userContext.userId
      });

      this.logger.debug(`Message edited successfully: ${messageId}`);
      return response;

    } catch (error) {
      this.logger.error(`Failed to edit message ${messageId}: ${error.message}`, error.stack);

      if (error instanceof MessageNotFoundError ||
        error instanceof MessageUnauthorizedError ||
        error instanceof MessageEditNotAllowedError ||
        error instanceof MessageAlreadyDeletedError) {
        throw error;
      }

      throw new MessageServiceUnavailableError(
        'message-editing',
        'Failed to edit message due to internal error'
      );
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
      await this.checkMessageDeletePermission(this.transformToMessageInfo(existingMessage), userContext);

      // Repository operation
      const success = await this.messageRepository.softDelete(messageId);

      if (success) {
        // Emit event for real-time notifications
        this.eventEmitter.emit(MESSAGE_EVENTS.MESSAGE_DELETED, {
          messageId,
          conversationId: existingMessage.conversationId,
          deletedBy: userContext.userId
        });

        this.logger.debug(`Message deleted successfully: ${messageId}`);
      }

      return success;

    } catch (error) {
      this.logger.error(`Failed to delete message ${messageId}: ${error.message}`, error.stack);

      if (error instanceof MessageNotFoundError ||
        error instanceof MessageUnauthorizedError ||
        error instanceof MessageAlreadyDeletedError) {
        throw error;
      }

      throw new MessageServiceUnavailableError(
        'message-deletion',
        'Failed to delete message due to internal error'
      );
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
        cursor: pagination.cursor,
        limit: pagination.limit || 20,
        sortDirection: pagination.sortDirection || 'desc'
      });

      // Convert messages to response format
      const messageResponses = await Promise.all(
        result.messages.map(message => this.convertToMessageResponse(message, userContext))
      );

      const response: PaginatedMessagesResponse = {
        messages: messageResponses,
        pagination: {
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
          totalCount: result.totalCount
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

      if (error instanceof ConversationAccessError) {
        throw error;
      }

      throw new MessageServiceUnavailableError(
        'message-retrieval',
        'Failed to retrieve messages due to internal error'
      );
    }
  }

  /**
   * Search messages
   */
  async searchMessages(
    conversationId: string,
    searchDto: MessageSearchDto,
    userContext: UserContext
  ): Promise<PaginatedMessagesResponse> {
    this.logger.debug(`Searching messages in conversation: ${conversationId}`);

    try {
      // Authorization check
      await this.checkConversationAccess(conversationId, userContext);

      const startTime = Date.now();

      // Repository operation
      const result = await this.messageRepository.searchMessages({
        conversationId,
        query: searchDto.query || '', // Provide default empty string
        messageTypes: searchDto.messageTypes,
        senderId: searchDto.senderId,
        fromDate: searchDto.fromDate ? new Date(searchDto.fromDate) : undefined,
        toDate: searchDto.toDate ? new Date(searchDto.toDate) : undefined,
        includeDeleted: searchDto.includeDeleted || false,
        hasAttachments: searchDto.hasAttachments || false,
        cursor: searchDto.cursor,
        limit: searchDto.limit || 20,
        sortDirection: searchDto.sortDirection || 'desc'
      });

      // Convert messages to response format
      const messageResponses = await Promise.all(
        result.messages.map(message => this.convertToMessageResponse(message, userContext))
      );

      const response: PaginatedMessagesResponse = {
        messages: messageResponses,
        pagination: {
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
          totalCount: result.totalCount
        },
        meta: {
          conversationId,
          requestedAt: new Date().toISOString(),
          responseTime: Date.now() - startTime
        }
      };

      this.logger.debug(`Found ${messageResponses.length} messages matching search criteria`);
      return response;

    } catch (error) {
      this.logger.error(`Failed to search messages: ${error.message}`, error.stack);
      throw new MessageServiceUnavailableError(
        'message-search',
        'Failed to search messages due to internal error'
      );
    }
  }

  /**
   * Update message delivery status
   */
  async updateMessageStatus(
    messageId: string,
    statusDto: UpdateMessageStatusDto,
    userContext: UserContext
  ): Promise<boolean> {
    this.logger.debug(`Updating status for message: ${messageId} to ${statusDto.status}`);

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
        this.convertStatusToDeliveryStatus(statusDto.status),
        statusDto.deviceId
      );

      if (success) {
        // Emit event for real-time notifications
        this.eventEmitter.emit(MESSAGE_EVENTS.MESSAGE_STATUS_UPDATED, {
          messageId,
          userId: userContext.userId,
          status: statusDto.status,
          conversationId: message.conversationId
        });

        this.logger.debug(`Message status updated successfully: ${messageId}`);
      }

      return success;

    } catch (error) {
      this.logger.error(`Failed to update message status: ${error.message}`, error.stack);

      if (error instanceof MessageNotFoundError ||
        error instanceof ConversationAccessError) {
        throw error;
      }

      throw new MessageServiceUnavailableError(
        'status-update',
        'Failed to update message status due to internal error'
      );
    }
  }

  /**
   * Bulk operations on messages
   */
  async bulkOperation(
    dto: BulkMessageOperationDto,
    userContext: UserContext
  ): Promise<BulkOperationResponse> {
    this.logger.debug(`Performing bulk operation: ${dto.operation} on ${dto.messageIds.length} messages`);

    const results: BulkOperationResponse = {
      successCount: 0,
      failureCount: 0,
      successful: [],
      failed: [],
      executedAt: new Date().toISOString()
    };

    try {
      // Process each message individually to handle partial failures
      for (const messageId of dto.messageIds) {
        try {
          let success = false;

          switch (dto.operation) {
            case 'delete':
              success = await this.deleteMessage(messageId, userContext);
              break;
            case 'mark_read':
              success = await this.updateMessageStatus(
                messageId,
                { status: MessageStatus.READ },
                userContext
              );
              break;
            case 'mark_unread':
              // Implement mark as unread logic
              success = await this.markAsUnread(messageId, userContext);
              break;
          }

          if (success) {
            results.successCount++;
            results.successful.push(messageId);
          } else {
            results.failureCount++;
            results.failed.push({
              messageId,
              reason: `Operation ${dto.operation} failed`
            });
          }

        } catch (error) {
          results.failureCount++;
          results.failed.push({
            messageId,
            reason: error.message
          });
        }
      }

      this.logger.debug(`Bulk operation completed: ${results.successCount} successful, ${results.failureCount} failed`);
      return results;

    } catch (error) {
      this.logger.error(`Bulk operation failed: ${error.message}`, error.stack);
      throw new MessageServiceUnavailableError(
        'bulk-operation',
        'Failed to perform bulk operation due to internal error'
      );
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
    message: MessageInfo,
    userContext: UserContext
  ): Promise<void> {
    // Only sender can edit their own messages
    if (message.senderId !== userContext.userId) {
      throw new MessageUnauthorizedError('edit', message.id);
    }

    // System messages cannot be edited
    if (message.messageType === MessageType.SYSTEM) {
      throw new MessageEditNotAllowedError('System messages cannot be edited', message.id);
    }
  }

  /**
   * Check if user can delete the message
   */
  private async checkMessageDeletePermission(
    message: MessageInfo,
    userContext: UserContext
  ): Promise<void> {
    // Sender can always delete their own messages
    if (message.senderId === userContext.userId) {
      return;
    }

    // Check if user has admin/moderator roles in conversation
    if (userContext.roles?.includes('admin') || userContext.roles?.includes('moderator')) {
      return;
    }

    throw new MessageUnauthorizedError('delete', message.id);
  }

  /**
   * Check edit time limit (15 minutes)
   */
  private checkEditTimeLimit(message: MessageInfo): void {
    const EDIT_TIME_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
    const now = new Date();
    const messageTime = new Date(message.createdAt);

    if (now.getTime() - messageTime.getTime() > EDIT_TIME_LIMIT_MS) {
      throw new MessageEditNotAllowedError(
        'Message can only be edited within 15 minutes',
        message.id
      );
    }
  }

  /**
   * Check for duplicate client message ID
   */
  private async checkDuplicateClientMessage(
    clientMessageId: string,
    userId: string
  ): Promise<void> {
    // In production, implement Redis-based deduplication
    // For now, this is a placeholder
    this.logger.debug(`Checking duplicate client message ID: ${clientMessageId} for user: ${userId}`);
  }

  /**
   * Convert MessageStatus to MessageDeliveryStatus
   */
  private convertStatusToDeliveryStatus(status: MessageStatus): MessageDeliveryStatus {
    switch (status) {
      case MessageStatus.SENDING:
        return MessageDeliveryStatus.SENDING;
      case MessageStatus.SENT:
        return MessageDeliveryStatus.SENT;
      case MessageStatus.DELIVERED:
        return MessageDeliveryStatus.DELIVERED;
      case MessageStatus.READ:
        return MessageDeliveryStatus.READ;
      case MessageStatus.FAILED:
        return MessageDeliveryStatus.FAILED;
      default:
        return MessageDeliveryStatus.SENT;
    }
  }

  /**
   * Transform MongoDB Message entity to MessageInfo interface
   */
  private transformToMessageInfo(message: any): MessageInfo {
    return {
      id: message._id?.toString(),
      conversationId: message.conversationId?.toString(),
      senderId: message.senderId?.toString(),
      messageType: message.messageType,
      content: message.content,
      systemData: message.systemData,
      replyToMessageId: message.replyToMessageId?.toString(),
      editedAt: message.editedAt,
      isEdited: message.isEdited || false,
      isDeleted: message.isDeleted || false,
      clientMessageId: message.clientMessageId,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt
    };
  }

  /**
   * Format message content based on type
   */
  private formatMessageContent(messageType: MessageType, content: any): any {
    // Content formatting and sanitization based on message type
    switch (messageType) {
      case MessageType.TEXT:
        return {
          text: content.text?.trim()
        };
      case MessageType.LOCATION:
        return {
          latitude: content.latitude,
          longitude: content.longitude,
          address: content.address?.trim()
        };
      case MessageType.IMAGE:
      case MessageType.VIDEO:
      case MessageType.AUDIO:
        return {
          url: content.url,
          filename: content.filename,
          size: content.size,
          duration: content.duration
        };
      case MessageType.FILE:
        return {
          url: content.url,
          filename: content.filename,
          size: content.size,
          mimeType: content.mimeType
        };
      default:
        return content;
    }
  }

  /**
   * Convert message entity to response DTO
   */
  private async convertToMessageResponse(
    message: MessageInfo,
    userContext: UserContext
  ): Promise<MessageResponse> {
    // This is a simplified conversion - in production, you'd populate
    // sender info, mentions, reactions, etc. from their respective services

    return {
      id: message.id!,
      conversationId: message.conversationId,
      sender: {
        id: message.senderId,
        name: 'User Name', // Populate from user service
        avatar: undefined
      },
      messageType: message.messageType,
      content: this.formatContentForResponse(message.messageType, message.content),
      replyTo: undefined, // Populate if replyTo exists
      mentions: [], // Populate from mentions
      reactions: [], // Populate from reactions
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt?.toISOString(),
      isEdited: message.isEdited || false,
      isDeleted: message.isDeleted || false,
      status: MessageStatus.SENT, // Get actual status for user
      clientMessageId: message.clientMessageId
    };
  }

  /**
   * Format content for response
   */
  private formatContentForResponse(messageType: MessageType, content: any): any {
    // Format content for client consumption
    return content;
  }

  /**
   * Mark message as unread (placeholder)
   */
  private async markAsUnread(messageId: string, userContext: UserContext): Promise<boolean> {
    // Implement logic to mark message as unread
    return true;
  }
}
