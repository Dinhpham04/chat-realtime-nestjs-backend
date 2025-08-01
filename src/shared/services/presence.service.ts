/**
 * Presence Service - Online Status Management
 * 
 * 🎯 Purpose: Handle real-time user presence and online status
 * 📱 Multi-device: Support users with multiple active devices  
 * 🔴 Redis-based: Scalable presence storage with TTL management
 * 🚀 Real-time: Socket.IO integration for instant notifications
 * 
 * Features:
 * - Online/Offline detection with heartbeat
 * - Multi-device presence management
 * - Contact-based presence notifications
 * - Status updates (online, away, busy, offline)
 * - Stale connection cleanup
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import {
    UserPresence,
    DeviceInfo,
    PresenceStatus,
    BulkPresenceResponse,
    PresenceUpdateEvent
} from '../types/presence.types';
import { ConversationsService } from '../../modules/conversations/services/conversations.service';

@Injectable()
export class PresenceService {
    private readonly logger = new Logger(PresenceService.name);

    // Redis key prefixes
    private readonly USER_PRESENCE_PREFIX = 'presence:user:';
    private readonly USER_DEVICES_PREFIX = 'presence:devices:';
    private readonly USER_CONTACTS_PREFIX = 'presence:contacts:';

    // TTL settings
    private readonly PRESENCE_TTL = 300; // 5 minutes
    private readonly HEARTBEAT_INTERVAL = 30; // 30 seconds
    private readonly STALE_CONNECTION_THRESHOLD = 120; // 2 minutes

    constructor(
        @Inject('IOREDIS_CLIENT') private readonly redis: Redis,
        private readonly eventEmitter: EventEmitter2,
        private readonly conversationsService: ConversationsService,
    ) { }

    // ================= CORE PRESENCE OPERATIONS =================

    /**
     * Set user as online with device information
     * Called when user connects via Socket.IO
     */
    async setUserOnline(
        userId: string,
        deviceInfo: DeviceInfo
    ): Promise<void> {
        try {
            const now = Date.now();

            // Create presence data
            const presenceData: UserPresence = {
                userId,
                status: 'online',
                lastSeen: now,
                connectedAt: now,
                deviceId: deviceInfo.deviceId,
                deviceType: deviceInfo.deviceType,
                platform: deviceInfo.platform,
                socketId: deviceInfo.socketId,
            };

            // Use Redis pipeline for atomic operations
            const pipeline = this.redis.pipeline();

            // Store user presence with TTL
            pipeline.hset(
                `${this.USER_PRESENCE_PREFIX}${userId}`,
                this.serializePresence(presenceData)
            );
            pipeline.expire(`${this.USER_PRESENCE_PREFIX}${userId}`, this.PRESENCE_TTL);

            // Add device to user's device set
            pipeline.sadd(`${this.USER_DEVICES_PREFIX}${userId}`, deviceInfo.deviceId);
            pipeline.expire(`${this.USER_DEVICES_PREFIX}${userId}`, this.PRESENCE_TTL);

            await pipeline.exec();

            this.logger.log(`User ${userId} set online on device ${deviceInfo.deviceId}`);

            // Emit presence change event for broadcasting
            this.eventEmitter.emit('presence.user.online', {
                userId,
                status: 'online',
                deviceInfo,
                timestamp: now
            } as PresenceUpdateEvent);

        } catch (error) {
            this.logger.error(`Failed to set user ${userId} online:`, error);
            throw error;
        }
    }

    /**
     * Set user as offline and cleanup device
     * Called when user disconnects from Socket.IO
     */
    async setUserOffline(
        userId: string,
        deviceId: string
    ): Promise<void> {
        try {
            const pipeline = this.redis.pipeline();

            // Remove device from user's device set
            pipeline.srem(`${this.USER_DEVICES_PREFIX}${userId}`, deviceId);

            // Check if user has other active devices
            const remainingDevices = await this.redis.scard(`${this.USER_DEVICES_PREFIX}${userId}`);

            if (remainingDevices === 0) {
                // No other devices - set user offline
                const now = Date.now();

                pipeline.hset(`${this.USER_PRESENCE_PREFIX}${userId}`, {
                    status: 'offline',
                    lastSeen: now.toString(),
                });
                pipeline.expire(`${this.USER_PRESENCE_PREFIX}${userId}`, this.PRESENCE_TTL);

                this.logger.log(`User ${userId} set offline - no active devices`);

                // Emit offline event
                this.eventEmitter.emit('presence.user.offline', {
                    userId,
                    status: 'offline',
                    timestamp: now
                } as PresenceUpdateEvent);
            } else {
                // User still has other devices - just update lastSeen
                pipeline.hset(`${this.USER_PRESENCE_PREFIX}${userId}`, {
                    lastSeen: Date.now().toString(),
                });

                this.logger.log(`User ${userId} device ${deviceId} disconnected - ${remainingDevices} devices remaining`);
            }

            await pipeline.exec();

        } catch (error) {
            this.logger.error(`Failed to set user ${userId} offline:`, error);
            throw error;
        }
    }

    /**
     * Update user's presence status (online, away, busy)
     * Called when user manually changes status
     */
    async updateUserStatus(
        userId: string,
        status: PresenceStatus,
        statusMessage?: string
    ): Promise<void> {
        try {
            const now = Date.now();

            // Check if user is currently online
            const currentPresence = await this.getUserPresence(userId);
            if (!currentPresence) {
                this.logger.warn(`Cannot update status for offline user ${userId}`);
                return;
            }

            // Update status in Redis
            const updateData: Partial<UserPresence> = {
                status,
                lastSeen: now,
                statusMessage,
            };

            await this.redis.hmset(
                `${this.USER_PRESENCE_PREFIX}${userId}`,
                this.serializePresence(updateData as UserPresence)
            );

            this.logger.log(`User ${userId} status updated to ${status}`);

            // Emit status change event
            this.eventEmitter.emit('presence.user.status_change', {
                userId,
                status,
                statusMessage,
                timestamp: now
            } as PresenceUpdateEvent);

        } catch (error) {
            this.logger.error(`Failed to update status for user ${userId}:`, error);
            throw error;
        }
    }

    // ================= QUERY OPERATIONS =================

    /**
     * Get user's current presence information
     */
    async getUserPresence(userId: string): Promise<UserPresence | null> {
        try {
            const presenceData = await this.redis.hgetall(`${this.USER_PRESENCE_PREFIX}${userId}`);

            if (!presenceData || Object.keys(presenceData).length === 0) {
                return null;
            }

            return this.deserializePresence(presenceData);
        } catch (error) {
            this.logger.error(`Failed to get presence for user ${userId}:`, error);
            return null;
        }
    }

    /**
     * Get presence information for multiple users
     * Optimized for bulk operations (e.g., contact list)
     */
    async getBulkPresence(userIds: string[]): Promise<BulkPresenceResponse> {
        try {
            if (userIds.length === 0) {
                return { presences: new Map(), onlineCount: 0 };
            }

            const pipeline = this.redis.pipeline();

            // Queue all presence queries
            userIds.forEach(userId => {
                pipeline.hgetall(`${this.USER_PRESENCE_PREFIX}${userId}`);
            });

            const results = await pipeline.exec();
            const presences = new Map<string, UserPresence>();
            let onlineCount = 0;

            results?.forEach((result, index) => {
                const [error, data] = result;
                if (!error && data && Object.keys(data).length > 0) {
                    const userId = userIds[index];
                    const presence = this.deserializePresence(data as Record<string, string>);
                    presences.set(userId, presence);

                    if (presence.status === 'online') {
                        onlineCount++;
                    }
                }
            });

            return { presences, onlineCount };
        } catch (error) {
            this.logger.error(`Failed to get bulk presence:`, error);
            return { presences: new Map(), onlineCount: 0 };
        }
    }

    /**
     * Get user's contact list for presence notifications
     * Gets contacts from conversations (more comprehensive than friends list)
     * Uses Redis cache for performance
     */
    async getUserContacts(userId: string): Promise<string[]> {
        try {
            // Try cache first
            const cacheKey = `${this.USER_CONTACTS_PREFIX}${userId}`;
            const cachedContacts = await this.redis.smembers(cacheKey);

            if (cachedContacts.length > 0) {
                this.logger.debug(`Using cached contacts for user ${userId}: ${cachedContacts.length} contacts`);
                return cachedContacts;
            }

            // Get contacts from conversations
            const contactIds = await this.conversationsService.getUserContacts(userId);

            // Cache the result for 5 minutes
            if (contactIds.length > 0) {
                await this.redis.sadd(cacheKey, ...contactIds);
                await this.redis.expire(cacheKey, 300); // 5 minutes cache
            }

            this.logger.log(`Found ${contactIds.length} contacts for user ${userId} from conversations`);
            return contactIds;
        } catch (error) {
            this.logger.error(`Failed to get contacts for user ${userId}:`, error);
            return [];
        }
    }

    /**
     * Add contact relationship for presence notifications
     */
    async addUserContact(userId: string, contactId: string): Promise<void> {
        try {
            await this.redis.sadd(`${this.USER_CONTACTS_PREFIX}${userId}`, contactId);
            this.logger.debug(`Added contact ${contactId} for user ${userId}`);
        } catch (error) {
            this.logger.error(`Failed to add contact relationship:`, error);
        }
    }

    // ================= HEARTBEAT MANAGEMENT =================

    /**
     * Update user's heartbeat to keep connection alive
     * Called periodically from client
     */
    async updateHeartbeat(userId: string, deviceId: string): Promise<void> {
        try {
            const now = Date.now();

            // Update lastSeen and refresh TTL
            const pipeline = this.redis.pipeline();
            pipeline.hset(`${this.USER_PRESENCE_PREFIX}${userId}`, 'lastSeen', now.toString());
            pipeline.expire(`${this.USER_PRESENCE_PREFIX}${userId}`, this.PRESENCE_TTL);
            pipeline.expire(`${this.USER_DEVICES_PREFIX}${userId}`, this.PRESENCE_TTL);

            await pipeline.exec();

            this.logger.debug(`Heartbeat updated for user ${userId}, device ${deviceId}`);
        } catch (error) {
            this.logger.error(`Failed to update heartbeat for user ${userId}:`, error);
        }
    }

    /**
     * Cleanup stale connections that haven't sent heartbeat
     * Run periodically as a background job
     */
    async cleanupStaleConnections(): Promise<void> {
        try {
            const now = Date.now();
            const staleThreshold = now - (this.STALE_CONNECTION_THRESHOLD * 1000);

            // Scan for all presence keys
            const presenceKeys = await this.redis.keys(`${this.USER_PRESENCE_PREFIX}*`);

            let cleanedCount = 0;

            for (const key of presenceKeys) {
                const lastSeenStr = await this.redis.hget(key, 'lastSeen');

                if (lastSeenStr) {
                    const lastSeen = parseInt(lastSeenStr, 10);

                    if (lastSeen < staleThreshold) {
                        // Connection is stale - set user offline
                        const userId = key.replace(this.USER_PRESENCE_PREFIX, '');

                        await this.redis.hset(key, {
                            status: 'offline',
                            lastSeen: now.toString(),
                        });

                        // Clear devices
                        await this.redis.del(`${this.USER_DEVICES_PREFIX}${userId}`);

                        // Emit offline event
                        this.eventEmitter.emit('presence.user.offline', {
                            userId,
                            status: 'offline',
                            timestamp: now,
                            reason: 'stale_connection'
                        } as PresenceUpdateEvent);

                        cleanedCount++;
                    }
                }
            }

            if (cleanedCount > 0) {
                this.logger.log(`Cleaned ${cleanedCount} stale connections`);
            }
        } catch (error) {
            this.logger.error(`Failed to cleanup stale connections:`, error);
        }
    }

    // ================= UTILITY METHODS =================

    /**
     * Check if user is currently online
     */
    async isUserOnline(userId: string): Promise<boolean> {
        const presence = await this.getUserPresence(userId);
        return presence?.status === 'online';
    }

    /**
     * Get count of online users from a list
     */
    async getOnlineCount(userIds: string[]): Promise<number> {
        const { onlineCount } = await this.getBulkPresence(userIds);
        return onlineCount;
    }

    /**
     * Serialize presence data for Redis storage
     */
    private serializePresence(presence: Partial<UserPresence>): Record<string, string> {
        const serialized: Record<string, string> = {};

        Object.entries(presence).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                serialized[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
            }
        });

        return serialized;
    }

    /**
     * Deserialize presence data from Redis
     */
    private deserializePresence(data: Record<string, string>): UserPresence {
        return {
            userId: data.userId,
            status: data.status as PresenceStatus,
            lastSeen: parseInt(data.lastSeen, 10),
            connectedAt: parseInt(data.connectedAt, 10),
            deviceId: data.deviceId,
            deviceType: data.deviceType as any,
            platform: data.platform,
            socketId: data.socketId,
            statusMessage: data.statusMessage,
        };
    }
}
