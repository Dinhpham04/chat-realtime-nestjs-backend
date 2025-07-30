/**
 * Messages Service Implementation
 *
 * 🎯 Purpose: Implement message business logic following Clean Architecture
 * 📱 Mobile-First: Real-time messaging operations with Socket.IO integration
 * 🚀 Clean Architecture: Service layer with dependency injection
 *
 * Design Principles:
 * - Single Responsibility: Handle message business logic only
 * - Interface Segregation: Implement focused service operations
 * - Dependency Inversion: Depend on repository abstractions
 * - DRY: Reuse DTOs and types for consistent operations
 */

import { Injectable, Logger, BadRequestException, ForbiddenException, NotFoundException, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Types } from 'mongoose';
import {
    CreateMessageDto,
    UpdateMessageDto,
    MessagePaginationDto,
    MessageSearchDto,
    UpdateMessageStatusDto,
    BulkMessageOperationDto,
    MessageResponseDto,
    PaginatedMessagesResponseDto,
    BulkOperationResponseDto
} from '../dto';
import {
    IMessageService,
    IExtendedMessageService,
    UserContext
} from '../interfaces/message-service.interface';
import { IMessageRepository } from '../interfaces/message-repository.interface';
import { MessageStatus, MessageType } from '../types';
import { ConversationsService } from '../../conversations/services/conversations.service';
import { UsersService } from 'src/modules/users';

@Injectable()
export class MessagesService implements IExtendedMessageService {
    private readonly logger = new Logger(MessagesService.name);

    constructor(
        @Inject('IMessageRepository')
        private readonly messageRepository: IMessageRepository,
        private readonly eventEmitter: EventEmitter2,
        private readonly conversationsService: ConversationsService,
        private readonly usersService: UsersService
    ) { }

    /**
     * Send a new message with real-time notification
     */
    async sendMessage(
        dto: CreateMessageDto,
        userContext: UserContext
    ): Promise<MessageResponseDto> {
        this.logger.debug(`Sending message from user ${userContext.userId} to conversation ${dto.conversationId}`);

        // Business validation
        await this.validateUserCanSendMessage(dto.conversationId, userContext);
        await this.validateMessageContent(dto);

        // Create message data for repository
        const messageData = {
            conversationId: new Types.ObjectId(dto.conversationId),
            senderId: new Types.ObjectId(userContext.userId),
            messageType: (dto.type as any) || MessageType.TEXT,
            content: dto.content,
            mentions: dto.mentions || [],
            isDeleted: false,
            isEdited: false,
            isSystemMessage: false
        };

        // Save to repository
        const savedMessage = await this.messageRepository.create(messageData);

        // Transform to response DTO
        const message: MessageResponseDto = {
            id: savedMessage._id.toString(),
            conversationId: savedMessage.conversationId.toString(),
            senderId: savedMessage.senderId.toString(),
            type: savedMessage.messageType,
            content: savedMessage.content,
            attachments: [], // Will be handled by attachment module
            mentions: dto.mentions || [],
            createdAt: savedMessage.createdAt,
            updatedAt: savedMessage.updatedAt,
            status: MessageStatus.SENT
        };

        // Emit real-time events for Socket.IO Gateway
        this.eventEmitter.emit('message.sent', {
            message,
            conversationId: dto.conversationId,
            senderId: userContext.userId
        });

        // Emit delivery tracking event
        this.eventEmitter.emit('message.delivery.track', {
            messageId: message.id,
            conversationId: dto.conversationId,
            senderId: userContext.userId
        });

        this.logger.log(`Message ${message.id} sent successfully`);
        return message;
    }

    /**
     * Edit an existing message
     */
    async editMessage(
        messageId: string,
        dto: UpdateMessageDto,
        userContext: UserContext
    ): Promise<MessageResponseDto> {
        this.logger.debug(`Editing message ${messageId} by user ${userContext.userId}`);

        // Get existing message from repository
        const existingMessage = await this.messageRepository.findById(messageId);

        if (!existingMessage) {
            throw new NotFoundException(`Message ${messageId} not found`);
        }

        // Transform to response DTO for validation
        const messageDto: MessageResponseDto = {
            id: existingMessage._id.toString(),
            conversationId: existingMessage.conversationId.toString(),
            senderId: existingMessage.senderId.toString(),
            type: existingMessage.messageType,
            content: existingMessage.content,
            attachments: [], // Will be handled by attachment module
            mentions: [],
            createdAt: existingMessage.createdAt,
            updatedAt: existingMessage.updatedAt,
            status: MessageStatus.DELIVERED
        };

        // Validate user can edit this message
        await this.validateUserCanEditMessage(messageDto, userContext);

        // Update message in repository
        const updateData = {
            content: dto.content || existingMessage.content,
            isEdited: true,
            editedAt: new Date()
        };

        const updatedMessage = await this.messageRepository.updateById(messageId, updateData);

        if (!updatedMessage) {
            throw new NotFoundException(`Failed to update message ${messageId}`);
        }

        // Transform to response DTO
        const responseMessage: MessageResponseDto = {
            id: updatedMessage._id.toString(),
            conversationId: updatedMessage.conversationId.toString(),
            senderId: updatedMessage.senderId.toString(),
            type: updatedMessage.messageType,
            content: updatedMessage.content,
            attachments: [], // Will be handled by attachment module
            mentions: [],
            createdAt: updatedMessage.createdAt,
            updatedAt: updatedMessage.updatedAt,
            status: MessageStatus.DELIVERED
        };

        // Emit real-time event
        this.eventEmitter.emit('message.edited', {
            message: responseMessage,
            conversationId: responseMessage.conversationId,
            editedBy: userContext.userId
        });

        this.logger.log(`Message ${messageId} edited successfully`);
        return responseMessage;
    }

    /**
     * Delete a message (soft delete)
     */
    async deleteMessage(
        messageId: string,
        userContext: UserContext
    ): Promise<boolean> {
        this.logger.debug(`Deleting message ${messageId} by user ${userContext.userId}`);

        // Get existing message from repository
        const existingMessage = await this.messageRepository.findById(messageId);

        if (!existingMessage) {
            throw new NotFoundException(`Message ${messageId} not found`);
        }

        // Transform to response DTO for validation
        const messageDto: MessageResponseDto = {
            id: existingMessage._id.toString(),
            conversationId: existingMessage.conversationId.toString(),
            senderId: existingMessage.senderId.toString(),
            type: existingMessage.messageType,
            content: existingMessage.content,
            attachments: [],
            mentions: [],
            createdAt: existingMessage.createdAt,
            updatedAt: existingMessage.updatedAt,
            status: MessageStatus.DELIVERED
        };

        // Validate user can delete this message
        await this.validateUserCanDeleteMessage(messageDto, userContext);

        // Soft delete in repository
        const deleteSuccess = await this.messageRepository.softDelete(messageId);

        if (!deleteSuccess) {
            throw new BadRequestException(`Failed to delete message ${messageId}`);
        }

        // Emit real-time event
        this.eventEmitter.emit('message.deleted', {
            messageId,
            conversationId: existingMessage.conversationId.toString(),
            deletedBy: userContext.userId,
            timestamp: new Date()
        });

        this.logger.log(`Message ${messageId} deleted successfully`);
        return true;
    }

    /**
     * Get conversation messages with pagination
     */
    async getConversationMessages(
        conversationId: string,
        pagination: MessagePaginationDto,
        userContext: UserContext
    ): Promise<PaginatedMessagesResponseDto> {
        this.logger.debug(`Getting messages for conversation ${conversationId}`);

        // Validate user access to conversation
        await this.validateUserCanAccessConversation(conversationId, userContext);

        // Get messages from repository with pagination
        const result = await this.messageRepository.findByConversationId(
            conversationId,
            {
                page: pagination.page,
                limit: pagination.limit,
                cursor: pagination.cursor
            }
        );

        const senders = await Promise.all(
            result.data.map(async message => {
                return await this.usersService.findById(message.senderId.toString());
            }))


        // Transform to response DTOs
        const messages: MessageResponseDto[] = result.data.map((message, i) => ({
            id: message._id.toString(),
            conversationId: message.conversationId.toString(),
            senderId: message.senderId.toString(),
            sender: senders[i],
            type: message.messageType,
            content: message.content,
            attachments: [], // Will be handled by attachment module
            mentions: [],
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
            status: MessageStatus.DELIVERED // Default status since not stored in schema yet
        }));

        return {
            messages,
            pagination: {
                page: result.pagination.page,
                limit: result.pagination.limit,
                total: result.pagination.total,
                hasNext: result.pagination.page < result.pagination.totalPages,
                hasPrev: result.pagination.page > 1
            }
        };
    }

    /**
     * Mark message as read
     */
    async markAsRead(
        messageId: string,
        userContext: UserContext
    ): Promise<boolean> {
        this.logger.debug(`Marking message ${messageId} as read by user ${userContext.userId}`);

        // Mark as read in repository
        const success = await this.messageRepository.markAsRead(messageId, userContext.userId);

        if (success) {
            // Emit real-time event for read receipt
            this.eventEmitter.emit('message.read', {
                messageId,
                readBy: userContext.userId,
                readAt: new Date(),
                deviceId: userContext.deviceId
            });
        }

        return success;
    }

    /**
     * Search messages in conversation
     */
    async searchMessages(
        conversationId: string,
        searchDto: MessageSearchDto,
        userContext: UserContext
    ): Promise<PaginatedMessagesResponseDto> {
        this.logger.debug(`Searching messages in conversation ${conversationId}`);

        // Validate user access
        await this.validateUserCanAccessConversation(conversationId, userContext);

        // Search messages in repository
        const result = await this.messageRepository.searchInConversation(
            conversationId,
            searchDto
        );

        // Transform to response DTOs
        const messages: MessageResponseDto[] = result.data.map(message => ({
            id: message._id.toString(),
            conversationId: message.conversationId.toString(),
            senderId: message.senderId.toString(),
            type: message.messageType,
            content: message.content,
            attachments: [], // Will be handled by attachment module
            mentions: [],
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
            status: MessageStatus.DELIVERED // Default status
        }));

        return {
            messages,
            pagination: {
                page: result.pagination.page,
                limit: result.pagination.limit,
                total: result.pagination.total,
                hasNext: result.pagination.page < result.pagination.totalPages,
                hasPrev: result.pagination.page > 1
            }
        };
    }

    /**
     * Update message delivery status
     */
    async updateMessageStatus(
        messageId: string,
        statusDto: UpdateMessageStatusDto,
        userContext: UserContext
    ): Promise<boolean> {
        this.logger.debug(`Updating message ${messageId} status to ${statusDto.status}`);

        // Update status in repository
        const success = await this.messageRepository.updateStatus(
            messageId,
            statusDto.status,
            new Date()
        );

        if (success) {
            // Emit real-time event
            this.eventEmitter.emit('message.status.updated', {
                messageId,
                status: statusDto.status,
                updatedBy: userContext.userId,
                timestamp: new Date()
            });
        }

        return success;
    }

    /**
     * Bulk operations on messages
     */
    async bulkOperation(
        dto: BulkMessageOperationDto,
        userContext: UserContext
    ): Promise<BulkOperationResponseDto> {
        this.logger.debug(`Performing bulk ${dto.operation} on ${dto.messageIds.length} messages`);

        const results: BulkOperationResponseDto = {
            operation: dto.operation,
            successCount: 0,
            failureCount: 0,
            failures: []
        };

        // Process each message
        for (const messageId of dto.messageIds) {
            try {
                switch (dto.operation) {
                    case 'delete':
                        await this.deleteMessage(messageId, userContext);
                        break;
                    case 'mark_read':
                        await this.markAsRead(messageId, userContext);
                        break;
                    default:
                        throw new BadRequestException(`Unsupported bulk operation: ${dto.operation}`);
                }

                results.successCount++;
            } catch (error) {
                results.failureCount++;
                results.failures.push(messageId);
            }
        }

        this.logger.log(`Bulk operation completed: ${results.successCount} successful, ${results.failureCount} failed`);
        return results;
    }

    /**
     * Forward message to other conversations
     */
    async forwardMessage(
        messageId: string,
        conversationIds: string[],
        userContext: UserContext
    ): Promise<MessageResponseDto[]> {
        this.logger.debug(`Forwarding message ${messageId} to ${conversationIds.length} conversations`);

        // Get original message from repository
        const originalMessage = await this.messageRepository.findById(messageId);
        if (!originalMessage) {
            throw new NotFoundException(`Message ${messageId} not found`);
        }

        const forwardedMessages: MessageResponseDto[] = [];

        // Forward to each conversation
        for (const conversationId of conversationIds) {
            const forwardDto: CreateMessageDto = {
                conversationId,
                type: originalMessage.messageType,
                content: originalMessage.content,
                attachments: [], // Will be handled by attachment module
                mentions: []
            };

            const forwardedMessage = await this.sendMessage(forwardDto, userContext);
            forwardedMessages.push(forwardedMessage);
        }

        this.logger.log(`Message ${messageId} forwarded to ${conversationIds.length} conversations`);
        return forwardedMessages;
    }

    /**
     * Get message analytics for conversation
     */
    async getMessageAnalytics(
        conversationId: string,
        userContext: UserContext
    ): Promise<{
        totalMessages: number;
        messagesPerDay: number;
        mostActiveUsers: Array<{ userId: string; messageCount: number }>;
        messageTypeDistribution: Record<string, number>;
    }> {
        this.logger.debug(`Getting analytics for conversation ${conversationId}`);

        // Validate user access
        await this.validateUserCanAccessConversation(conversationId, userContext);

        // Get analytics from repository
        const analytics = await this.messageRepository.getConversationAnalytics(conversationId);

        return analytics;
    }

    // Private helper methods

    private async validateUserCanSendMessage(conversationId: string, userContext: UserContext): Promise<void> {
        // Check if user is member of conversation using ConversationsService
        const isMember = await this.conversationsService.isUserMemberOfConversation(
            userContext.userId,
            conversationId
        );

        if (!isMember) {
            throw new ForbiddenException('User is not a member of this conversation');
        }
    }

    private async validateUserCanAccessConversation(conversationId: string, userContext: UserContext): Promise<void> {
        // Check if user has access to conversation using ConversationsService
        const isMember = await this.conversationsService.isUserMemberOfConversation(
            userContext.userId,
            conversationId
        );

        if (!isMember) {
            throw new ForbiddenException('User does not have access to this conversation');
        }
    }

    private async validateUserCanEditMessage(message: MessageResponseDto, userContext: UserContext): Promise<void> {
        // Only sender can edit their own messages
        if (message.senderId !== userContext.userId) {
            throw new ForbiddenException('User can only edit their own messages');
        }

        // Check if message is too old to edit (e.g., 24 hours)
        const editTimeLimit = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        const messageAge = Date.now() - message.createdAt.getTime();

        if (messageAge > editTimeLimit) {
            throw new ForbiddenException('Message is too old to edit');
        }
    }

    private async validateUserCanDeleteMessage(message: MessageResponseDto, userContext: UserContext): Promise<void> {
        // User can delete their own messages or admin can delete any message
        if (message.senderId !== userContext.userId && !userContext.roles?.includes('admin')) {
            throw new ForbiddenException('User can only delete their own messages');
        }
    }

    private async validateMessageContent(dto: CreateMessageDto): Promise<void> {
        // Validate content based on message type
        if (dto.type === MessageType.TEXT && (!dto.content || dto.content.trim().length === 0)) {
            throw new BadRequestException('Text messages must have content');
        }

        // Validate content length
        if (dto.content && dto.content.length > 10000) {
            throw new BadRequestException('Message content is too long');
        }

        // Validate attachments for media messages
        if (dto.type && [MessageType.IMAGE, MessageType.FILE, MessageType.VOICE].includes(dto.type as any)) {
            if (!dto.attachments || dto.attachments.length === 0) {
                throw new BadRequestException(`${dto.type} messages must have attachments`);
            }
        }
    }

    /**
     * Mark message as delivered
     */
    async markAsDelivered(messageId: string, userId: string, deliveredAt: number): Promise<void> {
        try {
            // Update message in database with updatedAt timestamp
            await this.messageRepository.updateMessageStatus(messageId, {
                status: MessageStatus.DELIVERED, // This will be stored in a separate status collection
                updatedAt: new Date(deliveredAt)
            });

            // Emit delivery event
            this.eventEmitter.emit('message.delivered', {
                messageId,
                userId,
                deliveredAt,
                timestamp: Date.now()
            });

            this.logger.log(`Message ${messageId} marked as delivered by user ${userId}`);

        } catch (error) {
            this.logger.error(`Failed to mark message ${messageId} as delivered:`, error);
            throw error;
        }
    }

    /**
     * Get message by ID
     */
    async getMessageById(messageId: string): Promise<MessageResponseDto | null> {
        try {
            const message = await this.messageRepository.findById(messageId);

            if (!message) {
                return null;
            }

            return {
                id: message._id.toString(),
                conversationId: message.conversationId.toString(),
                senderId: message.senderId.toString(),
                content: message.content || '',
                type: message.messageType,
                status: MessageStatus.SENT, // Default status since we don't have it in schema
                attachments: [], // Default empty array since not in basic schema
                mentions: [], // Default empty array since not in basic schema
                replyTo: message.replyTo ? {
                    messageId: message.replyTo.toString(),
                    content: '',
                    senderId: '',
                    senderName: ''
                } : undefined,
                createdAt: message.createdAt,
                updatedAt: message.updatedAt,
                delivery: undefined // Not implemented yet
            };

        } catch (error) {
            this.logger.error(`Failed to get message by ID ${messageId}:`, error);
            throw error;
        }
    }

    /**
     * Get delivery status for multiple messages
     */
    async getMessagesDeliveryStatus(messageIds: string[], requesterId: string): Promise<Array<{
        messageId: string;
        deliveryStatus: Array<{
            userId: string;
            status: 'sent' | 'delivered' | 'read';
            timestamp: Date;
        }>;
    }>> {
        try {
            const deliveryStatuses: Array<{
                messageId: string;
                deliveryStatus: Array<{
                    userId: string;
                    status: 'sent' | 'delivered' | 'read';
                    timestamp: Date;
                }>;
            }> = [];

            for (const messageId of messageIds) {
                // Get message to verify requester has access
                const message = await this.messageRepository.findById(messageId);

                if (!message) {
                    continue;
                }

                // Check if requester is the sender
                if (message.senderId.toString() !== requesterId) {
                    // TODO: Add proper conversation access check when ConversationsService method is available
                    continue;
                }

                // TODO: Implement proper delivery status tracking
                // For now, return basic status based on message timestamps
                const deliveryStatus = {
                    messageId,
                    deliveryStatus: [{
                        userId: message.senderId.toString(),
                        status: 'sent' as const,
                        timestamp: message.createdAt
                    }]
                };

                deliveryStatuses.push(deliveryStatus);
            }

            return deliveryStatuses;

        } catch (error) {
            this.logger.error(`Failed to get delivery status for messages:`, error);
            throw error;
        }
    }

    /**
     * Get recent messages for conversation (optimized for chat history)
     * Fast loading for initial chat display
     */
    async getRecentMessages(
        conversationId: string,
        limit: number = 50,
        before?: string,
        userContext?: UserContext
    ): Promise<{
        messages: MessageResponseDto[];
        hasMore: boolean;
        oldestMessageId?: string;
        total: number;
    }> {
        try {
            // Build pagination query
            const pagination = {
                limit: Math.min(limit, 100), // Max 100 messages
                cursor: before,
                sortOrder: 'desc' as const, // Latest first
            };

            // Get messages with pagination
            const result = await this.messageRepository.findByConversationId(
                conversationId,
                pagination
            );

            // Transform to response DTOs
            const messages = await Promise.all(
                result.data.map(async (message) => {
                    return {
                        id: message._id.toString(),
                        conversationId: message.conversationId.toString(),
                        senderId: message.senderId.toString(),
                        content: message.content || '',
                        type: message.messageType,
                        status: MessageStatus.SENT, // Default status
                        attachments: [], // TODO: Implement attachments
                        mentions: [], // TODO: Implement mentions
                        replyTo: message.replyTo ? {
                            messageId: message.replyTo.toString(),
                            content: '',
                            senderId: '',
                            senderName: ''
                        } : undefined,
                        createdAt: message.createdAt,
                        updatedAt: message.updatedAt,
                        delivery: undefined
                    } as MessageResponseDto;
                })
            );

            // Get total count for conversation
            const totalCount = await this.messageRepository.countByConversationId(conversationId);

            return {
                messages: messages.reverse(), // Return in chronological order
                hasMore: result.pagination.page < result.pagination.totalPages,
                oldestMessageId: messages.length > 0 ? messages[0].id : undefined,
                total: result.pagination.total
            };

        } catch (error) {
            this.logger.error(`Failed to get recent messages for conversation ${conversationId}:`, error);
            throw error;
        }
    }

    /**
     * Get messages around a specific message (for jump to message feature)
     */
    async getMessagesAround(
        conversationId: string,
        messageId: string,
        contextLimit: number = 25,
        userContext?: UserContext
    ): Promise<{
        messages: MessageResponseDto[];
        targetMessage: MessageResponseDto;
        hasMoreBefore: boolean;
        hasMoreAfter: boolean;
    }> {
        try {
            // Get the target message first
            const targetMessage = await this.getMessageById(messageId);
            if (!targetMessage) {
                throw new NotFoundException(`Message ${messageId} not found`);
            }

            // Get messages before the target message
            const messagesBefore = await this.messageRepository.getMessagesBeforeMessage(
                conversationId,
                messageId,
                contextLimit
            );

            // Get messages after the target message
            const messagesAfter = await this.messageRepository.getMessagesAfterMessage(
                conversationId,
                messageId,
                contextLimit
            );

            // Transform to response DTOs
            const transformMessage = (message: any): MessageResponseDto => ({
                id: message._id.toString(),
                conversationId: message.conversationId.toString(),
                senderId: message.senderId.toString(),
                content: message.content || '',
                type: message.messageType,
                status: MessageStatus.SENT,
                attachments: [],
                mentions: [],
                replyTo: message.replyTo ? {
                    messageId: message.replyTo.toString(),
                    content: '',
                    senderId: '',
                    senderName: ''
                } : undefined,
                createdAt: message.createdAt,
                updatedAt: message.updatedAt,
                delivery: undefined
            });

            const beforeMessages = messagesBefore.map(transformMessage);
            const afterMessages = messagesAfter.map(transformMessage);

            // Combine all messages in chronological order
            const allMessages = [
                ...beforeMessages.reverse(), // Oldest first
                targetMessage,
                ...afterMessages
            ];

            return {
                messages: allMessages,
                targetMessage,
                hasMoreBefore: messagesBefore.length === contextLimit,
                hasMoreAfter: messagesAfter.length === contextLimit
            };

        } catch (error) {
            this.logger.error(`Failed to get messages around ${messageId}:`, error);
            throw error;
        }
    }
}
