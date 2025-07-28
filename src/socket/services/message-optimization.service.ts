import { Injectable, Logger, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';

interface DeliveryUpdate {
    messageId: string;
    userId: string;
    status: 'delivered' | 'read';
    timestamp: number;
}

interface ReadReceiptBatch {
    conversationId: string;
    userId: string;
    messageIds: string[];
    timestamp: number;
}

@Injectable()
export class MessageOptimizationService {
    private readonly logger = new Logger(MessageOptimizationService.name);

    // In-memory batches for optimization
    private deliveryBatch = new Map<string, DeliveryUpdate[]>();
    private readBatch = new Map<string, string[]>();
    private batchTimers = new Map<string, NodeJS.Timeout>();
    private processedCounter = 0; // Track processed operations count

    constructor(
        @Inject('IOREDIS_CLIENT')
        private readonly redis: Redis,
        private readonly eventEmitter: EventEmitter2,
    ) {
        // Start batch processing intervals
        this.startBatchProcessing();
    }

    /**
     * Start background batch processing (Zalo-inspired optimization)
     */
    private startBatchProcessing(): void {
        // Flush delivery batch every 1 second
        setInterval(() => this.flushDeliveryBatch(), 1000);

        // Flush read receipts every 500ms
        setInterval(() => this.flushReadBatch(), 500);

        this.logger.log('Started batch processing for message optimization');
    }

    /**
     * Add delivery update to batch (prevents spam)
     */
    async addDeliveryUpdate(conversationId: string, update: DeliveryUpdate): Promise<void> {
        try {
            if (!this.deliveryBatch.has(conversationId)) {
                this.deliveryBatch.set(conversationId, []);
            }

            this.deliveryBatch.get(conversationId)!.push(update);

            // Store in Redis for persistence
            await this.storeDeliveryUpdate(update);

        } catch (error) {
            this.logger.error('Failed to add delivery update:', error);
        }
    }

    /**
     * Add read receipt to batch (debounced)
     */
    async addReadReceipt(conversationId: string, messageIds: string[], userId: string): Promise<void> {
        try {
            const key = `${conversationId}:${userId}`;

            if (!this.readBatch.has(key)) {
                this.readBatch.set(key, []);
            }

            // Merge with existing read receipts (deduplication)
            const existing = this.readBatch.get(key)!;
            const merged = [...new Set([...existing, ...messageIds])];
            this.readBatch.set(key, merged);

            // Store in Redis for persistence
            await this.storeReadReceipts(conversationId, messageIds, userId);

        } catch (error) {
            this.logger.error('Failed to add read receipt:', error);
        }
    }

    /**
     * Flush delivery batch - broadcast to conversation participants
     */
    private async flushDeliveryBatch(): Promise<void> {
        if (this.deliveryBatch.size === 0) return;

        try {
            for (const [conversationId, updates] of this.deliveryBatch) {
                if (updates.length === 0) continue;

                // Emit event for ChatGateway to handle broadcasting
                this.eventEmitter.emit('delivery.updates.batch', {
                    conversationId,
                    updates,
                    timestamp: Date.now()
                });

                this.processedCounter += updates.length;
                this.logger.log(`Flushed ${updates.length} delivery updates for conversation ${conversationId}`);
            }

            // Clear the batch
            this.deliveryBatch.clear();

        } catch (error) {
            this.logger.error('Failed to flush delivery batch:', error);
        }
    }

    /**
     * Flush read receipt batch - broadcast to conversation participants
     */
    private async flushReadBatch(): Promise<void> {
        if (this.readBatch.size === 0) return;

        try {
            for (const [key, messageIds] of this.readBatch) {
                if (messageIds.length === 0) continue;

                const [conversationId, userId] = key.split(':');

                // Remove duplicates
                const uniqueMessageIds = [...new Set(messageIds)];

                // Emit event for ChatGateway to handle broadcasting
                this.eventEmitter.emit('read.receipts.batch', {
                    conversationId,
                    userId,
                    messageIds: uniqueMessageIds,
                    timestamp: Date.now()
                });

                this.processedCounter += uniqueMessageIds.length;
                this.logger.log(`Flushed ${uniqueMessageIds.length} read receipts for user ${userId} in conversation ${conversationId}`);
            }

            // Clear the batch
            this.readBatch.clear();

        } catch (error) {
            this.logger.error('Failed to flush read batch:', error);
        }
    }

    /**
     * Store delivery update in Redis
     */
    private async storeDeliveryUpdate(update: DeliveryUpdate): Promise<void> {
        try {
            const deliveryKey = `msg_delivery:${update.messageId}`;
            await this.redis.hset(deliveryKey, update.userId, `${update.status}:${update.timestamp}`);
            await this.redis.expire(deliveryKey, 86400 * 30); // 30 days

        } catch (error) {
            this.logger.error('Failed to store delivery update:', error);
        }
    }

    /**
     * Store read receipts in Redis
     */
    private async storeReadReceipts(conversationId: string, messageIds: string[], userId: string): Promise<void> {
        try {
            const timestamp = Date.now();

            // Update read status for each message
            for (const messageId of messageIds) {
                const deliveryKey = `msg_delivery:${messageId}`;
                await this.redis.hset(deliveryKey, userId, `read:${timestamp}`);
                await this.redis.expire(deliveryKey, 86400 * 30); // 30 days
            }

            // Store in read batch for analytics
            const batchKey = `read_batch:${userId}`;
            await this.redis.sadd(batchKey, ...messageIds);
            await this.redis.expire(batchKey, 86400); // 1 day

        } catch (error) {
            this.logger.error('Failed to store read receipts:', error);
        }
    }

    /**
     * Get message delivery statistics
     */
    async getMessageDeliveryStats(messageId: string): Promise<{
        totalParticipants: number;
        delivered: number;
        read: number;
        pending: number;
    }> {
        try {
            const deliveryKey = `msg_delivery:${messageId}`;
            const statuses = await this.redis.hgetall(deliveryKey);

            let delivered = 0;
            let read = 0;

            for (const status of Object.values(statuses)) {
                if (status.startsWith('delivered:')) delivered++;
                if (status.startsWith('read:')) read++;
            }

            const totalParticipants = Object.keys(statuses).length;
            const pending = totalParticipants - delivered - read;

            return { totalParticipants, delivered, read, pending };

        } catch (error) {
            this.logger.error(`Failed to get delivery stats for ${messageId}:`, error);
            return { totalParticipants: 0, delivered: 0, read: 0, pending: 0 };
        }
    }

    /**
     * Socket.IO specific: Compress large payloads
     */
    async sendCompressedMessage(roomName: string, event: string, data: any): Promise<void> {
        try {
            // Emit event for ChatGateway to handle compressed message sending
            this.eventEmitter.emit('message.compressed.send', {
                roomName,
                event,
                data,
                compressed: true,
                timestamp: Date.now()
            });

            this.processedCounter++;
            this.logger.log(`Sent compressed message to room ${roomName}`);

        } catch (error) {
            this.logger.error('Failed to send compressed message:', error);
        }
    }

    /**
     * Optimize room management - cleanup empty rooms
     */
    async optimizeRoomManagement(): Promise<void> {
        try {
            // Emit event for ChatGateway to handle room optimization
            // ChatGateway has access to server.sockets.adapter.rooms
            this.eventEmitter.emit('rooms.optimize', {
                timestamp: Date.now(),
                cleanupEmptyRooms: true,
                patterns: ['conversation:', 'user:', 'device:']
            });

            this.logger.log('Triggered room optimization');

        } catch (error) {
            this.logger.error('Failed to optimize room management:', error);
        }
    }

    /**
     * Batch processing for message operations
     */
    async batchProcessMessages(operations: Array<{
        type: 'delivery' | 'read';
        conversationId: string;
        data: any;
    }>): Promise<void> {
        try {
            // Group operations by type and conversation
            const deliveryOps = operations.filter(op => op.type === 'delivery');
            const readOps = operations.filter(op => op.type === 'read');

            // Process delivery operations
            for (const op of deliveryOps) {
                await this.addDeliveryUpdate(op.conversationId, op.data);
            }

            // Process read operations
            for (const op of readOps) {
                await this.addReadReceipt(op.conversationId, op.data.messageIds, op.data.userId);
            }

            this.logger.log(`Batch processed ${operations.length} message operations`);

        } catch (error) {
            this.logger.error('Failed to batch process messages:', error);
        }
    }

    /**
     * Message deduplication cache
     */
    async isMessageDuplicate(messageId: string, senderId: string): Promise<boolean> {
        try {
            const dedupeKey = `msg_dedupe:${senderId}:${messageId}`;
            const exists = await this.redis.exists(dedupeKey);

            if (exists) {
                return true;
            }

            // Mark as seen for 5 minutes
            await this.redis.setex(dedupeKey, 300, '1');
            return false;

        } catch (error) {
            this.logger.error('Failed to check message duplication:', error);
            return false;
        }
    }

    /**
     * Performance metrics collection
     */
    async collectPerformanceMetrics(): Promise<{
        batchSizes: { delivery: number; read: number };
        queueLengths: Record<string, number>;
        processedCount: number;
    }> {
        try {
            const deliveryBatchSize = Array.from(this.deliveryBatch.values())
                .reduce((sum, batch) => sum + batch.length, 0);

            const readBatchSize = Array.from(this.readBatch.values())
                .reduce((sum, batch) => sum + batch.length, 0);

            return {
                batchSizes: {
                    delivery: deliveryBatchSize,
                    read: readBatchSize,
                },
                queueLengths: {
                    delivery: this.deliveryBatch.size,
                    read: this.readBatch.size,
                },
                processedCount: this.processedCounter,
            };

        } catch (error) {
            this.logger.error('Failed to collect performance metrics:', error);
            return {
                batchSizes: { delivery: 0, read: 0 },
                queueLengths: {},
                processedCount: 0,
            };
        }
    }

    /**
     * Reset performance counter (for testing/monitoring)
     */
    resetProcessedCounter(): void {
        this.processedCounter = 0;
        this.logger.log('Reset processed counter to 0');
    }

    /**
     * Get current processing status
     */
    getProcessingStatus(): {
        isActive: boolean;
        activeOperations: { delivery: number; read: number };
        totalProcessed: number;
    } {
        const deliveryOps = Array.from(this.deliveryBatch.values())
            .reduce((sum, batch) => sum + batch.length, 0);

        const readOps = Array.from(this.readBatch.values())
            .reduce((sum, batch) => sum + batch.length, 0);

        return {
            isActive: deliveryOps > 0 || readOps > 0,
            activeOperations: {
                delivery: deliveryOps,
                read: readOps,
            },
            totalProcessed: this.processedCounter,
        };
    }

    /**
     * Manual flush for immediate processing (for testing/emergency)
     */
    async forceFlushAll(): Promise<void> {
        this.logger.log('Force flushing all batches...');

        await this.flushDeliveryBatch();
        await this.flushReadBatch();

        this.logger.log('Force flush completed');
    }
}
