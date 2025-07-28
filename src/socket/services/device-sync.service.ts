import { Injectable, Logger, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Socket } from 'socket.io';
import Redis from 'ioredis';
import { MessageRepository } from '../../modules/messages/repositories/message.repository';
import { ConversationRepository } from '../../modules/conversations/repositories/conversation.repository';
import { ConversationsService } from '../../modules/conversations/services/conversations.service';

interface DeviceInfo {
    deviceId: string;
    deviceType: 'mobile' | 'web' | 'desktop';
    platform: 'ios' | 'android' | 'web' | 'windows' | 'mac';
    userId: string;
    socketId: string;
    lastActiveAt: Date;
    status?: 'online' | 'offline';
}

interface SyncData {
    missedMessages: any[];
    conversationStates: any[];
    unreadCounts: Record<string, number>;
    readUpdates: any[];
    lastSyncAt: Date;
}

@Injectable()
export class DeviceSyncService {
    private readonly logger = new Logger(DeviceSyncService.name);

    constructor(
        @Inject('IOREDIS_CLIENT')
        private readonly redis: Redis,
        private readonly eventEmitter: EventEmitter2,
        private readonly messageRepository: MessageRepository,
        private readonly conversationRepository: ConversationRepository,
        private readonly conversationsService: ConversationsService,
    ) { }

    /**
     * Handle device connection and sync state
     * Multi-device sync like Zalo/Messenger
     */
    async syncDeviceOnConnect(userId: string, deviceId: string, socket: Socket): Promise<void> {
        try {
            // Register device as online
            await this.registerDeviceOnline(userId, deviceId, socket.id);

            // Get sync data for this device
            const syncData = await this.getDeviceSyncData(userId, deviceId);

            // Send missed messages if any
            if (syncData.missedMessages.length > 0) {
                socket.emit('sync_missed_messages', {
                    messages: syncData.missedMessages,
                    totalCount: syncData.missedMessages.length,
                    lastSyncAt: syncData.lastSyncAt,
                });

                this.logger.log(`Synced ${syncData.missedMessages.length} missed messages for device ${deviceId}`);
            }

            // Send conversation states
            socket.emit('sync_conversation_states', {
                conversations: syncData.conversationStates,
                unreadCounts: syncData.unreadCounts,
            });

            // Send read status updates
            if (syncData.readUpdates.length > 0) {
                socket.emit('sync_read_status', {
                    readUpdates: syncData.readUpdates,
                });
            }

            // Update last sync timestamp
            await this.updateLastSyncTimestamp(userId, deviceId);

            this.logger.log(`Device sync completed for ${deviceId} (user: ${userId})`);

        } catch (error) {
            this.logger.error(`Failed to sync device ${deviceId} for user ${userId}:`, error);
        }
    }

    /**
     * Register device as online
     */
    async registerDeviceOnline(userId: string, deviceId: string, socketId: string): Promise<void> {
        try {
            // Add device to user's device set
            await this.redis.sadd(`user_devices:${userId}`, deviceId);

            // Store device info
            const deviceInfo = {
                deviceId,
                userId,
                socketId,
                lastActiveAt: new Date().toISOString(),
                status: 'online',
            };

            await this.redis.hset(`device_info:${deviceId}`, deviceInfo);

            // Map socket to device
            await this.redis.set(`socket_device:${socketId}`, deviceId, 'EX', 86400); // 24 hours

            this.logger.log(`Registered device ${deviceId} as online for user ${userId}`);

        } catch (error) {
            this.logger.error(`Failed to register device online:`, error);
        }
    }

    /**
     * Update device last seen timestamp
     */
    async updateDeviceLastSeen(deviceId: string): Promise<void> {
        try {
            await this.redis.hset(`device_info:${deviceId}`, 'lastActiveAt', new Date().toISOString());
            await this.redis.hset(`device_info:${deviceId}`, 'status', 'offline');

        } catch (error) {
            this.logger.error(`Failed to update device last seen:`, error);
        }
    }

    /**
     * Get sync data for device
     */
    async getDeviceSyncData(userId: string, deviceId: string): Promise<SyncData> {
        try {
            const lastSync = await this.getLastSyncTimestamp(userId, deviceId);

            return {
                missedMessages: await this.getMissedMessages(userId, lastSync),
                conversationStates: await this.getConversationStates(userId),
                unreadCounts: await this.getUnreadCounts(userId, deviceId),
                readUpdates: await this.getReadUpdates(userId, lastSync),
                lastSyncAt: lastSync,
            };

        } catch (error) {
            this.logger.error(`Failed to get sync data for device ${deviceId}:`, error);
            return {
                missedMessages: [],
                conversationStates: [],
                unreadCounts: {},
                readUpdates: [],
                lastSyncAt: new Date(),
            };
        }
    }

    /**
     * Sync read status to other devices of same user
     */
    async syncReadStatusToOtherDevices(
        userId: string,
        excludeDeviceId: string,
        messageIds: string[],
        readAt: number,
    ): Promise<void> {
        try {
            // Get other devices of this user
            const otherDevices = await this.getUserOtherDevices(userId, excludeDeviceId);

            for (const device of otherDevices) {
                if (device.socketId && device.status === 'online') {
                    // Emit event for ChatGateway to handle device sync
                    this.eventEmitter.emit('device.read.sync', {
                        socketId: device.socketId,
                        messageIds,
                        readAt,
                        syncedFrom: excludeDeviceId,
                        targetDeviceId: device.deviceId
                    });
                }
            }

            this.logger.log(`Synced read status for ${messageIds.length} messages to ${otherDevices.length} other devices`);

        } catch (error) {
            this.logger.error('Failed to sync read status to other devices:', error);
        }
    }

    /**
     * Get user's other devices (excluding current)
     */
    async getUserOtherDevices(userId: string, excludeDeviceId: string): Promise<DeviceInfo[]> {
        try {
            const deviceIds = await this.redis.smembers(`user_devices:${userId}`);
            const otherDeviceIds = deviceIds.filter(id => id !== excludeDeviceId);

            const devices: DeviceInfo[] = [];

            for (const deviceId of otherDeviceIds) {
                const deviceInfo = await this.redis.hgetall(`device_info:${deviceId}`);
                if (deviceInfo.deviceId) {
                    devices.push({
                        deviceId: deviceInfo.deviceId,
                        deviceType: deviceInfo.deviceType as any,
                        platform: deviceInfo.platform as any,
                        userId: deviceInfo.userId,
                        socketId: deviceInfo.socketId,
                        lastActiveAt: new Date(deviceInfo.lastActiveAt),
                        status: deviceInfo.status as 'online' | 'offline',
                    });
                }
            }

            return devices;

        } catch (error) {
            this.logger.error(`Failed to get other devices for user ${userId}:`, error);
            return [];
        }
    }

    /**
     * Handle read conflict resolution (when same message read on multiple devices)
     */
    async resolveReadConflict(messageId: string, readEvents: Array<{
        userId: string;
        deviceId: string;
        readAt: number;
    }>): Promise<{ userId: string; deviceId: string; readAt: number }> {
        try {
            // Strategy: earliest read wins (more user-friendly)
            const earliestRead = readEvents.sort((a, b) => a.readAt - b.readAt)[0];

            // Store the resolved read time
            await this.redis.hset(`msg_read_resolved:${messageId}`, {
                userId: earliestRead.userId,
                deviceId: earliestRead.deviceId,
                readAt: earliestRead.readAt.toString(),
                resolvedAt: Date.now().toString(),
            });

            return earliestRead;

        } catch (error) {
            this.logger.error(`Failed to resolve read conflict for message ${messageId}:`, error);
            return readEvents[0]; // Fallback to first event
        }
    }

    /**
     * Get last sync timestamp for device
     */
    private async getLastSyncTimestamp(userId: string, deviceId: string): Promise<Date> {
        try {
            const timestamp = await this.redis.hget(`device_sync:${deviceId}`, 'lastMessageSync');
            return timestamp ? new Date(parseInt(timestamp)) : new Date(Date.now() - 86400000); // 24 hours ago

        } catch (error) {
            this.logger.error('Failed to get last sync timestamp:', error);
            return new Date(Date.now() - 86400000);
        }
    }

    /**
     * Update last sync timestamp
     */
    private async updateLastSyncTimestamp(userId: string, deviceId: string): Promise<void> {
        try {
            await this.redis.hset(`device_sync:${deviceId}`, {
                lastMessageSync: Date.now().toString(),
                lastReadSync: Date.now().toString(),
                userId,
            });

        } catch (error) {
            this.logger.error('Failed to update last sync timestamp:', error);
        }
    }

    /**
     * Get missed messages since last sync
     */
    private async getMissedMessages(userId: string, lastSync: Date): Promise<any[]> {
        try {
            // Get user's conversations to find messages in
            const userConversations = await this.conversationsService.getUserConversations(userId, {
                limit: 100,
                offset: 0,
                type: 'all',
                status: 'all'
            });

            if (!userConversations.conversations || userConversations.conversations.length === 0) {
                return [];
            }

            const conversationIds = userConversations.conversations.map(conv => conv.id);
            const missedMessages: any[] = [];

            // Query messages after lastSync timestamp for each conversation
            for (const conversationId of conversationIds) {
                try {
                    const paginatedMessages = await this.messageRepository.findByConversationId(conversationId, {
                        limit: 50, // Limit per conversation to avoid overwhelming
                        page: 1
                    });

                    // Filter messages after lastSync timestamp and transform to sync format
                    const filteredMessages = paginatedMessages.data
                        .filter(msg => msg.createdAt && msg.createdAt > lastSync)
                        .map(msg => ({
                            id: msg._id.toString(),
                            conversationId: msg.conversationId.toString(),
                            senderId: msg.senderId.toString(),
                            content: msg.content || '',
                            messageType: msg.messageType,
                            createdAt: msg.createdAt,
                            timestamp: msg.createdAt?.getTime() || Date.now(),
                        }));

                    missedMessages.push(...filteredMessages);
                } catch (error) {
                    this.logger.warn(`Failed to get missed messages for conversation ${conversationId}:`, error);
                }
            }

            // Sort all missed messages by timestamp (oldest first) and limit total
            const sortedMessages = missedMessages
                .sort((a, b) => a.timestamp - b.timestamp)
                .slice(0, 200); // Max 200 missed messages per sync

            this.logger.log(`Found ${sortedMessages.length} missed messages for user ${userId} since ${lastSync.toISOString()}`);
            return sortedMessages;

        } catch (error) {
            this.logger.error('Failed to get missed messages:', error);
            return [];
        }
    }

    /**
     * Get conversation states for user
     */
    private async getConversationStates(userId: string): Promise<any[]> {
        try {
            // Get user's conversations with current state
            const userConversations = await this.conversationsService.getUserConversations(userId, {
                limit: 50,
                offset: 0,
                type: 'all',
                status: 'all'
            });

            if (!userConversations.conversations || userConversations.conversations.length === 0) {
                return [];
            }

            // Transform conversations to sync state format
            const conversationStates = userConversations.conversations.map(conv => ({
                conversationId: conv.id,
                name: conv.name,
                type: conv.type,
                lastMessage: conv.lastMessage ? {
                    id: conv.lastMessage.id,
                    content: conv.lastMessage.content,
                    senderId: conv.lastMessage.senderId,
                    timestamp: new Date(conv.lastMessage.createdAt).getTime(),
                    messageType: conv.lastMessage.messageType
                } : null,
                participantCount: conv.participantCount,
                lastActivity: conv.lastActivity,
                unreadCount: conv.unreadCount,
                isMuted: conv.isMuted,
            }));

            this.logger.log(`Retrieved ${conversationStates.length} conversation states for user ${userId}`);
            return conversationStates;

        } catch (error) {
            this.logger.error('Failed to get conversation states:', error);
            return [];
        }
    }

    /**
     * Get unread counts per conversation for device
     */
    private async getUnreadCounts(userId: string, deviceId: string): Promise<Record<string, number>> {
        try {
            // Get user's conversations
            const userConversations = await this.conversationsService.getUserConversations(userId, {
                limit: 100,
                offset: 0,
                type: 'all',
                status: 'all'
            });

            if (!userConversations.conversations || userConversations.conversations.length === 0) {
                return {};
            }

            const unreadCounts: Record<string, number> = {};

            // Get device-specific last seen timestamps
            for (const conv of userConversations.conversations) {
                try {
                    // Get device's last seen timestamp for this conversation
                    const lastSeenKey = `device_last_seen:${deviceId}:${conv.id}`;
                    const lastSeenTimestamp = await this.redis.get(lastSeenKey);

                    let unreadCount = 0;

                    if (lastSeenTimestamp) {
                        const lastSeen = new Date(parseInt(lastSeenTimestamp));

                        // Count unread messages in this conversation since last seen
                        const messagePage = await this.messageRepository.findByConversationId(conv.id, {
                            limit: 100,
                            page: 1
                        });

                        unreadCount = messagePage.data
                            .filter(msg =>
                                msg.createdAt &&
                                msg.createdAt > lastSeen &&
                                msg.senderId.toString() !== userId // Don't count own messages
                            ).length;
                    } else {
                        // If no last seen, use conversation's unread count
                        unreadCount = conv.unreadCount || 0;
                    }

                    unreadCounts[conv.id] = unreadCount;

                } catch (error) {
                    this.logger.warn(`Failed to calculate unread count for conversation ${conv.id}:`, error);
                    unreadCounts[conv.id] = conv.unreadCount || 0;
                }
            }

            this.logger.log(`Calculated unread counts for ${Object.keys(unreadCounts).length} conversations for device ${deviceId}`);
            return unreadCounts;

        } catch (error) {
            this.logger.error('Failed to get unread counts:', error);
            return {};
        }
    }

    /**
     * Get read status updates since last sync
     */
    private async getReadUpdates(userId: string, lastSync: Date): Promise<any[]> {
        try {
            // Get read updates from Redis that happened after lastSync
            const readUpdates: any[] = [];

            // Pattern to find read status keys for this user
            const readKeys = await this.redis.keys(`msg_delivery:*`);

            for (const key of readKeys) {
                try {
                    const messageId = key.replace('msg_delivery:', '');
                    const deliveryStatuses = await this.redis.hgetall(key);

                    // Check if this user has read updates after lastSync
                    for (const [readUserId, statusData] of Object.entries(deliveryStatuses)) {
                        if (statusData.startsWith('read:')) {
                            const readTimestamp = parseInt(statusData.split(':')[1]);
                            const readDate = new Date(readTimestamp);

                            // If read after lastSync and involves conversations user is in
                            if (readDate > lastSync) {
                                readUpdates.push({
                                    messageId,
                                    userId: readUserId,
                                    readAt: readTimestamp,
                                    type: 'read'
                                });
                            }
                        }
                    }
                } catch (error) {
                    this.logger.warn(`Failed to process read update for key ${key}:`, error);
                }
            }

            // Also get read conflict resolutions since lastSync
            const resolvedKeys = await this.redis.keys(`msg_read_resolved:*`);

            for (const key of resolvedKeys) {
                try {
                    const messageId = key.replace('msg_read_resolved:', '');
                    const resolvedData = await this.redis.hgetall(key);

                    if (resolvedData.resolvedAt) {
                        const resolvedTimestamp = parseInt(resolvedData.resolvedAt);
                        const resolvedDate = new Date(resolvedTimestamp);

                        if (resolvedDate > lastSync) {
                            readUpdates.push({
                                messageId,
                                userId: resolvedData.userId,
                                deviceId: resolvedData.deviceId,
                                readAt: parseInt(resolvedData.readAt),
                                type: 'read_resolved'
                            });
                        }
                    }
                } catch (error) {
                    this.logger.warn(`Failed to process resolved read for key ${key}:`, error);
                }
            }

            // Sort by timestamp and limit
            const sortedUpdates = readUpdates
                .sort((a, b) => a.readAt - b.readAt)
                .slice(0, 500); // Limit to 500 read updates

            this.logger.log(`Found ${sortedUpdates.length} read updates for user ${userId} since ${lastSync.toISOString()}`);
            return sortedUpdates;

        } catch (error) {
            this.logger.error('Failed to get read updates:', error);
            return [];
        }
    }

    /**
     * Cleanup expired device connections
     */
    async cleanupExpiredDevices(): Promise<void> {
        try {
            // Get all device info keys
            const deviceKeys = await this.redis.keys('device_info:*');
            const expiredThreshold = Date.now() - (24 * 60 * 60 * 1000); // 24 hours

            for (const key of deviceKeys) {
                const deviceInfo = await this.redis.hgetall(key);
                const lastActive = new Date(deviceInfo.lastActiveAt).getTime();

                if (lastActive < expiredThreshold) {
                    const deviceId = deviceInfo.deviceId;
                    const userId = deviceInfo.userId;

                    // Remove from user's device set
                    await this.redis.srem(`user_devices:${userId}`, deviceId);

                    // Remove device info
                    await this.redis.del(key);

                    this.logger.log(`Cleaned up expired device: ${deviceId} for user ${userId}`);
                }
            }

        } catch (error) {
            this.logger.error('Failed to cleanup expired devices:', error);
        }
    }

    /**
     * Get device sync statistics
     */
    async getDeviceSyncStats(userId: string): Promise<{
        totalDevices: number;
        onlineDevices: number;
        lastSyncTimes: Record<string, Date>;
    }> {
        try {
            const deviceIds = await this.redis.smembers(`user_devices:${userId}`);
            let onlineCount = 0;
            const lastSyncTimes: Record<string, Date> = {};

            for (const deviceId of deviceIds) {
                const deviceInfo = await this.redis.hgetall(`device_info:${deviceId}`);

                if (deviceInfo.status === 'online') {
                    onlineCount++;
                }

                const syncInfo = await this.redis.hgetall(`device_sync:${deviceId}`);
                if (syncInfo.lastMessageSync) {
                    lastSyncTimes[deviceId] = new Date(parseInt(syncInfo.lastMessageSync));
                }
            }

            return {
                totalDevices: deviceIds.length,
                onlineDevices: onlineCount,
                lastSyncTimes,
            };

        } catch (error) {
            this.logger.error(`Failed to get device sync stats for user ${userId}:`, error);
            return {
                totalDevices: 0,
                onlineDevices: 0,
                lastSyncTimes: {},
            };
        }
    }

    /**
     * Update device last seen for specific conversation
     */
    async updateDeviceLastSeenInConversation(deviceId: string, conversationId: string): Promise<void> {
        try {
            const lastSeenKey = `device_last_seen:${deviceId}:${conversationId}`;
            await this.redis.set(lastSeenKey, Date.now().toString(), 'EX', 86400 * 30); // 30 days TTL

            this.logger.debug(`Updated last seen for device ${deviceId} in conversation ${conversationId}`);

        } catch (error) {
            this.logger.error(`Failed to update device last seen in conversation:`, error);
        }
    }

    /**
     * Get all active devices for user
     */
    async getActiveDevicesForUser(userId: string): Promise<DeviceInfo[]> {
        try {
            const deviceIds = await this.redis.smembers(`user_devices:${userId}`);
            const activeDevices: DeviceInfo[] = [];

            for (const deviceId of deviceIds) {
                const deviceInfo = await this.redis.hgetall(`device_info:${deviceId}`);

                if (deviceInfo.deviceId && deviceInfo.status === 'online') {
                    activeDevices.push({
                        deviceId: deviceInfo.deviceId,
                        deviceType: deviceInfo.deviceType as any,
                        platform: deviceInfo.platform as any,
                        userId: deviceInfo.userId,
                        socketId: deviceInfo.socketId,
                        lastActiveAt: new Date(deviceInfo.lastActiveAt),
                        status: 'online',
                    });
                }
            }

            return activeDevices;

        } catch (error) {
            this.logger.error(`Failed to get active devices for user ${userId}:`, error);
            return [];
        }
    }

    /**
     * Force sync all devices for user (admin function)
     */
    async forceSyncAllDevices(userId: string): Promise<void> {
        try {
            const activeDevices = await this.getActiveDevicesForUser(userId);

            for (const device of activeDevices) {
                if (device.socketId) {
                    // Emit force sync event
                    this.eventEmitter.emit('device.force.sync', {
                        socketId: device.socketId,
                        userId,
                        deviceId: device.deviceId,
                        timestamp: Date.now()
                    });
                }
            }

            this.logger.log(`Force synced ${activeDevices.length} devices for user ${userId}`);

        } catch (error) {
            this.logger.error(`Failed to force sync devices for user ${userId}:`, error);
        }
    }
}
