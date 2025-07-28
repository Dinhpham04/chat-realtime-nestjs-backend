import { Injectable, Logger, Inject } from '@nestjs/common';
import { Socket } from 'socket.io';
import Redis from 'ioredis';
import { MessageRepository } from '../../modules/messages/repositories/message.repository';
import { SocketAuthService } from './socket-auth.service';
import { UsersService } from '../../modules/users/services/users.service';

interface QueuedMessage {
    id: string;
    conversationId: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: number;
    type: 'text' | 'image' | 'file' | 'audio' | 'video';
}

@Injectable()
export class MessageQueueService {
    private readonly logger = new Logger(MessageQueueService.name);

    constructor(
        @Inject('IOREDIS_CLIENT')
        private readonly redis: Redis,
        private readonly messageRepository: MessageRepository,
        private readonly socketAuthService: SocketAuthService,
        private readonly usersService: UsersService,
    ) { }

    /**
     * Queue message for offline user
     * Inspired by Zalo's offline message strategy
     */
    async queueForOfflineUser(userId: string, message: QueuedMessage): Promise<void> {
        try {
            const queueKey = `offline_queue:${userId}`;

            // Store message in Redis list (FIFO)
            await this.redis.lpush(queueKey, JSON.stringify(message));

            // Set expiry: 7 days retention
            await this.redis.expire(queueKey, 86400 * 7);

            this.logger.log(`Queued message ${message.id} for offline user ${userId}`);

        } catch (error) {
            this.logger.error(`Failed to queue message for user ${userId}:`, error);
        }
    }

    /**
     * Queue message for multiple offline users
     */
    async queueMessageForOfflineUsers(messageId: string, participants: string[]): Promise<void> {
        try {
            // Get full message details from database
            const messageDoc = await this.messageRepository.findById(messageId);

            if (!messageDoc) {
                this.logger.warn(`Message ${messageId} not found in database`);
                return;
            }

            // Get sender info to get name
            let senderName = 'Unknown User';
            try {
                const senderInfo = await this.usersService.findById(messageDoc.senderId.toString());
                senderName = senderInfo?.fullName || senderInfo?.username || 'Unknown User';
            } catch (error) {
                this.logger.warn(`Failed to get sender info for user ${messageDoc.senderId}:`, error);
            }

            // Transform to QueuedMessage format with safe type handling
            const message: QueuedMessage = {
                id: messageDoc._id.toString(),
                conversationId: messageDoc.conversationId.toString(),
                senderId: messageDoc.senderId.toString(),
                senderName,
                content: messageDoc.content || '', // Default to empty string if undefined
                timestamp: messageDoc.createdAt?.getTime() || Date.now(),
                type: (messageDoc.messageType as QueuedMessage['type']) || 'text',
            };

            // Check which users are offline and queue for them
            for (const userId of participants) {
                const isOnline = await this.isUserOnline(userId);
                if (!isOnline) {
                    await this.queueForOfflineUser(userId, message);
                }
            }

        } catch (error) {
            this.logger.error(`Failed to queue message for offline users:`, error);
        }
    }

    /**
     * Deliver queued messages when user comes online
     * Socket.IO version with acknowledgment
     */
    async deliverQueuedMessages(userId: string, socket: Socket): Promise<void> {
        try {
            const queueKey = `offline_queue:${userId}`;

            // Get all queued messages
            const messageIds = await this.redis.lrange(queueKey, 0, -1);

            if (messageIds.length === 0) {
                this.logger.log(`No queued messages for user ${userId}`);
                return;
            }

            const messages = messageIds.map(msgStr => JSON.parse(msgStr));

            this.logger.log(`Delivering ${messages.length} queued messages to user ${userId}`);

            // Send batch with Socket.IO acknowledgment
            socket.emit('offline_messages_batch', {
                messages,
                total: messages.length,
                timestamp: Date.now(),
            }, async (ack) => {
                if (ack?.received) {
                    // Client confirmed receipt, mark as delivered and clean queue
                    for (const message of messages) {
                        await this.updateDeliveryStatus(message.id, userId, 'delivered');
                    }

                    // Clear the queue
                    await this.redis.del(queueKey);

                    this.logger.log(`Successfully delivered and cleared queue for user ${userId}`);
                } else {
                    this.logger.warn(`Client did not acknowledge offline messages for user ${userId}`);
                }
            });

        } catch (error) {
            this.logger.error(`Failed to deliver queued messages for user ${userId}:`, error);
        }
    }

    /**
     * Check if user is online in any Socket.IO room
     */
    async isUserOnline(userId: string): Promise<boolean> {
        try {
            // Use SocketAuthService which has Redis tracking for device connections
            return await this.socketAuthService.isUserOnline(userId);

        } catch (error) {
            this.logger.error(`Failed to check online status for user ${userId}:`, error);
            return false;
        }
    }

    /**
     * Update message delivery status
     */
    async updateDeliveryStatus(messageId: string, userId: string, status: 'delivered' | 'read'): Promise<void> {
        try {
            const deliveryKey = `msg_delivery:${messageId}`;
            const timestamp = Date.now();

            // Store delivery status in Redis hash
            await this.redis.hset(deliveryKey, userId, `${status}:${timestamp}`);

            // Set expiry: 30 days
            await this.redis.expire(deliveryKey, 86400 * 30);

            this.logger.log(`Updated delivery status: ${messageId} -> ${userId}:${status}`);

        } catch (error) {
            this.logger.error(`Failed to update delivery status:`, error);
        }
    }

    /**
     * Get delivery status for a message
     */
    async getMessageDeliveryStatus(messageId: string): Promise<Record<string, string>> {
        try {
            const deliveryKey = `msg_delivery:${messageId}`;
            return await this.redis.hgetall(deliveryKey);

        } catch (error) {
            this.logger.error(`Failed to get delivery status for ${messageId}:`, error);
            return {};
        }
    }

    /**
     * Get queued message count for user
     */
    async getQueuedMessageCount(userId: string): Promise<number> {
        try {
            const queueKey = `offline_queue:${userId}`;
            return await this.redis.llen(queueKey);

        } catch (error) {
            this.logger.error(`Failed to get queue count for user ${userId}:`, error);
            return 0;
        }
    }

    /**
     * Clear expired message queues (cleanup job)
     */
    async cleanupExpiredQueues(): Promise<void> {
        try {
            this.logger.log('Starting cleanup of expired message queues...');

            // Scan for all offline queue keys
            const queuePattern = 'offline_queue:*';
            const keys = await this.redis.keys(queuePattern);

            if (keys.length === 0) {
                this.logger.log('No offline queues found to cleanup');
                return;
            }

            let cleanedCount = 0;
            let totalMessages = 0;

            // Check each queue for expiry and cleanup empty/expired ones
            for (const key of keys) {
                try {
                    // Check TTL (-1 means no expiry, -2 means expired/non-existent)
                    const ttl = await this.redis.ttl(key);
                    const length = await this.redis.llen(key);

                    totalMessages += length;

                    // If queue has expired or is empty, clean it up
                    if (ttl === -2 || length === 0) {
                        await this.redis.del(key);
                        cleanedCount++;

                        const userId = key.replace('offline_queue:', '');
                        this.logger.debug(`Cleaned expired/empty queue for user: ${userId}`);
                    }
                    // If queue has very old messages (no TTL), set a new TTL
                    else if (ttl === -1) {
                        await this.redis.expire(key, 86400 * 7); // 7 days
                        this.logger.debug(`Set TTL for queue: ${key}`);
                    }

                } catch (keyError) {
                    this.logger.warn(`Failed to process queue key ${key}:`, keyError);
                }
            }

            // Cleanup message delivery status older than 30 days
            const deliveryPattern = 'msg_delivery:*';
            const deliveryKeys = await this.redis.keys(deliveryPattern);

            let deliveryCleanedCount = 0;
            for (const key of deliveryKeys) {
                try {
                    const ttl = await this.redis.ttl(key);
                    if (ttl === -2) { // Expired
                        await this.redis.del(key);
                        deliveryCleanedCount++;
                    }
                } catch (keyError) {
                    this.logger.warn(`Failed to process delivery key ${key}:`, keyError);
                }
            }

            this.logger.log(`Cleanup completed: 
                - Processed ${keys.length} offline queues (${totalMessages} total messages)
                - Cleaned ${cleanedCount} expired/empty queues
                - Cleaned ${deliveryCleanedCount} expired delivery status records`);

        } catch (error) {
            this.logger.error('Failed to cleanup expired queues:', error);
        }
    }

    /**
     * Cache recent messages for fast retrieval
     */
    async cacheRecentMessages(conversationId: string, messages: QueuedMessage[]): Promise<void> {
        try {
            const cacheKey = `recent_msgs:${conversationId}`;

            // Store last 50 messages
            const messagesToCache = messages.slice(-50);

            // Clear existing cache
            await this.redis.del(cacheKey);

            // Add messages to list
            for (const message of messagesToCache) {
                await this.redis.rpush(cacheKey, JSON.stringify(message));
            }

            // Set expiry: 7 days
            await this.redis.expire(cacheKey, 86400 * 7);

            this.logger.log(`Cached ${messagesToCache.length} recent messages for conversation ${conversationId}`);

        } catch (error) {
            this.logger.error(`Failed to cache recent messages:`, error);
        }
    }

    /**
     * Get cached recent messages
     */
    async getCachedRecentMessages(conversationId: string, limit: number = 50): Promise<QueuedMessage[]> {
        try {
            const cacheKey = `recent_msgs:${conversationId}`;

            // Get last N messages
            const messageStrings = await this.redis.lrange(cacheKey, -limit, -1);

            return messageStrings.map(msgStr => JSON.parse(msgStr));

        } catch (error) {
            this.logger.error(`Failed to get cached messages for conversation ${conversationId}:`, error);
            return [];
        }
    }
}
