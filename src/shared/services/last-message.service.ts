/**
 * Last Message Service - Real-time Conversation Updates
 * 
 * 🎯 Purpose: Handle real-time lastMessage updates for conversation lists
 * 📱 Mobile-First: Optimized for mobile conversation list performance
 * 🔄 Real-time: Socket.IO integration for instant updates
 * 💾 Redis Caching: Cache frequently accessed lastMessage data
 * 
 * Features:
 * - LastMessage tracking and updates
 * - Read status management
 * - Content optimization for display
 * - Bulk operations for efficiency
 * - File message previews
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import {
    LastMessageDto,
    ConversationLastMessageUpdate,
    OptimizedMessageContent,
    FileMessagePreview,
    ILastMessageService
} from '../types/last-message.types';

@Injectable()
export class LastMessageService implements ILastMessageService {
    private readonly logger = new Logger(LastMessageService.name);

    // Redis key prefixes
    private readonly LAST_MESSAGE_PREFIX = 'lastmsg:conv:';
    private readonly READ_STATUS_PREFIX = 'lastmsg:read:';

    // Cache TTL settings
    private readonly CACHE_TTL = 3600 * 24 * 7; // 1 hour
    private readonly READ_STATUS_TTL = 7200; // 2 hours

    constructor(
        @Inject('IOREDIS_CLIENT') private readonly redis: Redis,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    // ================= CORE LASTMESSAGE OPERATIONS =================

    /**
     * Get lastMessage for specific conversation
     */
    async getConversationLastMessage(
        conversationId: string,
        userId: string
    ): Promise<LastMessageDto | null> {
        try {
            // Try to get from Redis cache first
            const cachedData = await this.redis.hgetall(`${this.LAST_MESSAGE_PREFIX}${conversationId}`);

            if (cachedData && Object.keys(cachedData).length > 0) {
                const lastMessage = this.deserializeLastMessage(cachedData);

                // Add user-specific read status
                lastMessage.isRead = await this.isMessageReadByUser(
                    lastMessage.messageId,
                    userId
                );

                return lastMessage;
            }

            // If not in cache, we'll need to query from database
            // This would typically integrate with MessagesService
            this.logger.debug(`LastMessage not found in cache for conversation ${conversationId}`);
            return null;

        } catch (error) {
            this.logger.error(`Failed to get lastMessage for conversation ${conversationId}:`, error);
            return null;
        }
    }

    /**
     * Get lastMessages for multiple conversations (bulk operation)
     */
    async getBulkConversationsLastMessages(
        conversationIds: string[],
        userId: string
    ): Promise<Map<string, LastMessageDto>> {
        try {
            const results = new Map<string, LastMessageDto>();

            if (conversationIds.length === 0) {
                return results;
            }

            // Use Redis pipeline for efficiency
            const pipeline = this.redis.pipeline();

            conversationIds.forEach(convId => {
                pipeline.hgetall(`${this.LAST_MESSAGE_PREFIX}${convId}`);
            });

            const cacheResults = await pipeline.exec();

            // Process results
            for (let i = 0; i < conversationIds.length; i++) {
                const convId = conversationIds[i];
                const [error, data] = cacheResults?.[i] || [null, null];

                if (!error && data && Object.keys(data).length > 0) {
                    const lastMessage = this.deserializeLastMessage(data as Record<string, string>);

                    // Add user-specific read status
                    lastMessage.isRead = await this.isMessageReadByUser(
                        lastMessage.messageId,
                        userId
                    );

                    results.set(convId, lastMessage);
                }
            }

            return results;
        } catch (error) {
            this.logger.error(`Failed to get bulk lastMessages:`, error);
            return new Map();
        }
    }

    /**
     * Update lastMessage when new message is sent
     */
    async updateLastMessageOnSend(
        message: any,
        conversationId: string
    ): Promise<void> {
        try {
            // Create LastMessageDto from message
            const lastMessage: LastMessageDto = {
                messageId: message.id,
                conversationId: conversationId,
                senderId: message.senderId,
                senderName: message.senderName || 'User', // This should come from message data
                content: this.optimizeMessageContent(
                    message.content,
                    message.type,
                    message.attachments
                ).preview,
                messageType: message.type,
                timestamp: message.createdAt || Date.now(),
                readBy: [message.senderId], // Sender has "read" their own message
                deliveredTo: [], // Will be updated as delivery confirmations come in
                isRead: false, // Will be set per user context
                attachmentCount: message.attachments?.length || 0,
            };

            // Save to Redis cache
            await this.cacheLastMessage(conversationId, lastMessage);

            // Emit event for real-time broadcasting
            this.eventEmitter.emit('lastmessage.updated', {
                conversationId,
                lastMessage,
                trigger: 'new_message',
                timestamp: Date.now()
            });

            this.logger.debug(`LastMessage updated for conversation ${conversationId}`);

        } catch (error) {
            this.logger.error(`Failed to update lastMessage for conversation ${conversationId}:`, error);
        }
    }

    /**
     * Update read status for lastMessage
     */
    async updateLastMessageReadStatus(
        conversationId: string,
        messageId: string,
        userId: string,
        isRead: boolean
    ): Promise<void> {
        try {
            // Update read status in Redis
            const readKey = `${this.READ_STATUS_PREFIX}${messageId}:${userId}`;

            if (isRead) {
                await this.redis.setex(readKey, this.READ_STATUS_TTL, Date.now().toString());
            } else {
                await this.redis.del(readKey);
            }

            // Get current lastMessage
            const lastMessage = await this.getConversationLastMessage(conversationId, userId);

            if (lastMessage && lastMessage.messageId === messageId) {
                // Update readBy array
                if (isRead && !lastMessage.readBy.includes(userId)) {
                    lastMessage.readBy.push(userId);
                } else if (!isRead) {
                    lastMessage.readBy = lastMessage.readBy.filter(id => id !== userId);
                }

                // Update cache
                await this.cacheLastMessage(conversationId, lastMessage);

                // Emit read status update event
                this.eventEmitter.emit('lastmessage.read_status_updated', {
                    conversationId,
                    messageId,
                    userId,
                    isRead,
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            this.logger.error(`Failed to update read status for lastMessage:`, error);
        }
    }

    /**
     * Update delivery status for lastMessage
     */
    async updateLastMessageDeliveryStatus(
        conversationId: string,
        messageId: string,
        userId: string,
        isDelivered: boolean
    ): Promise<void> {
        try {
            const lastMessage = await this.getConversationLastMessage(conversationId, userId);

            if (lastMessage && lastMessage.messageId === messageId) {
                // Update deliveredTo array
                if (isDelivered && !lastMessage.deliveredTo.includes(userId)) {
                    lastMessage.deliveredTo.push(userId);
                } else if (!isDelivered) {
                    lastMessage.deliveredTo = lastMessage.deliveredTo.filter(id => id !== userId);
                }

                // Update cache
                await this.cacheLastMessage(conversationId, lastMessage);
            }

        } catch (error) {
            this.logger.error(`Failed to update delivery status for lastMessage:`, error);
        }
    }

    // ================= CONTENT OPTIMIZATION =================

    /**
     * Generate optimized content for display in conversation list
     */
    optimizeMessageContent(
        content: string,
        messageType: string,
        attachments?: any[]
    ): OptimizedMessageContent {
        // Handle file messages
        if (messageType !== 'text' && attachments && attachments.length > 0) {
            const filePreview = this.generateFilePreview(messageType, attachments);

            return {
                original: content,
                preview: filePreview.preview,
                hasMore: false,
                filePreview: filePreview
            };
        }

        // Handle text messages
        const maxLength = 100;
        let preview = content;
        let hasMore = false;

        if (content.length > maxLength) {
            preview = content.substring(0, maxLength).trim() + '...';
            hasMore = true;
        }

        // Handle mentions, emoji, etc.
        preview = this.processMentionsAndEmoji(preview);

        return {
            original: content,
            preview: preview,
            hasMore: hasMore
        };
    }

    /**
     * Generate file preview text for different file types
     */
    private generateFilePreview(
        messageType: string,
        attachments: any[]
    ): FileMessagePreview {
        const fileCount = attachments.length;

        if (fileCount === 1) {
            const file = attachments[0];
            return {
                type: 'single_file',
                fileName: file.fileName,
                fileType: this.getFileTypeFromMessageType(messageType),
                preview: this.getSingleFilePreviewText(messageType, file.fileName)
            };
        } else {
            return {
                type: 'multiple_files',
                fileCount: fileCount,
                fileType: this.getFileTypeFromMessageType(messageType),
                preview: this.getMultipleFilesPreviewText(messageType, fileCount)
            };
        }
    }

    /**
     * Get preview text for single file
     */
    private getSingleFilePreviewText(messageType: string, fileName: string): string {
        const emojis = {
            'image': '🖼️',
            'video': '🎥',
            'audio': '🎵',
            'document': '📄',
            'file': '📎'
        };

        const emoji = emojis[messageType] || emojis['file'];

        switch (messageType) {
            case 'image':
                return `${emoji} Sent a photo`;
            case 'video':
                return `${emoji} Sent a video`;
            case 'audio':
                return `${emoji} Sent an audio`;
            case 'document':
                return `${emoji} Sent a document`;
            default:
                return `${emoji} Sent a file`;
        }
    }

    /**
     * Get preview text for multiple files
     */
    private getMultipleFilesPreviewText(messageType: string, count: number): string {
        const emojis = {
            'image': '🖼️',
            'video': '🎥',
            'audio': '🎵',
            'document': '📄',
            'file': '📎'
        };

        const emoji = emojis[messageType] || emojis['file'];

        switch (messageType) {
            case 'image':
                return `${emoji} Sent ${count} photos`;
            case 'video':
                return `${emoji} Sent ${count} videos`;
            case 'audio':
                return `${emoji} Sent ${count} audio files`;
            case 'document':
                return `${emoji} Sent ${count} documents`;
            default:
                return `${emoji} Sent ${count} files`;
        }
    }

    /**
     * Process mentions and emoji in content
     */
    private processMentionsAndEmoji(content: string): string {
        // TODO: Process @mentions to show user names
        // TODO: Ensure emoji display properly

        return content;
    }

    // ================= UTILITY METHODS =================

    /**
     * Check if message is read by specific user
     */
    private async isMessageReadByUser(messageId: string, userId: string): Promise<boolean> {
        try {
            const readKey = `${this.READ_STATUS_PREFIX}${messageId}:${userId}`;
            const readStatus = await this.redis.get(readKey);
            return readStatus !== null;
        } catch (error) {
            this.logger.error(`Failed to check read status:`, error);
            return false;
        }
    }

    /**
     * Cache lastMessage in Redis
     */
    private async cacheLastMessage(
        conversationId: string,
        lastMessage: LastMessageDto
    ): Promise<void> {
        try {
            const cacheKey = `${this.LAST_MESSAGE_PREFIX}${conversationId}`;
            const serializedData = this.serializeLastMessage(lastMessage);

            await this.redis.hmset(cacheKey, serializedData);
            await this.redis.expire(cacheKey, this.CACHE_TTL);

        } catch (error) {
            this.logger.error(`Failed to cache lastMessage:`, error);
        }
    }

    /**
     * Serialize lastMessage for Redis storage
     */
    private serializeLastMessage(lastMessage: LastMessageDto): Record<string, string> {
        return {
            messageId: lastMessage.messageId,
            conversationId: lastMessage.conversationId,
            senderId: lastMessage.senderId,
            senderName: lastMessage.senderName,
            content: lastMessage.content,
            messageType: lastMessage.messageType,
            timestamp: lastMessage.timestamp.toString(),
            readBy: JSON.stringify(lastMessage.readBy),
            deliveredTo: JSON.stringify(lastMessage.deliveredTo),
            attachmentCount: (lastMessage.attachmentCount || 0).toString(),
        };
    }

    /**
     * Deserialize lastMessage from Redis
     */
    private deserializeLastMessage(data: Record<string, string>): LastMessageDto {
        return {
            messageId: data.messageId,
            conversationId: data.conversationId,
            senderId: data.senderId,
            senderName: data.senderName,
            content: data.content,
            messageType: data.messageType as any,
            timestamp: parseInt(data.timestamp, 10),
            readBy: JSON.parse(data.readBy || '[]'),
            deliveredTo: JSON.parse(data.deliveredTo || '[]'),
            isRead: false, // Will be set per user context
            attachmentCount: parseInt(data.attachmentCount || '0', 10),
        };
    }

    /**
     * Get file type from message type
     */
    private getFileTypeFromMessageType(messageType: string): 'image' | 'video' | 'audio' | 'document' | 'other' {
        switch (messageType) {
            case 'image':
                return 'image';
            case 'video':
                return 'video';
            case 'audio':
                return 'audio';
            case 'document':
                return 'document';
            default:
                return 'other';
        }
    }

    /**
     * Clear lastMessage cache for conversation
     */
    async clearLastMessageCache(conversationId: string): Promise<void> {
        try {
            await this.redis.del(`${this.LAST_MESSAGE_PREFIX}${conversationId}`);
            this.logger.debug(`Cleared lastMessage cache for conversation ${conversationId}`);
        } catch (error) {
            this.logger.error(`Failed to clear lastMessage cache:`, error);
        }
    }

    /**
     * Get unread count for conversation (for current user)
     */
    async getUnreadCount(conversationId: string, userId: string): Promise<number> {
        try {
            // This would integrate with MessagesService to get accurate unread count
            // For now, return 0 as placeholder
            return 0;
        } catch (error) {
            this.logger.error(`Failed to get unread count:`, error);
            return 0;
        }
    }
}
