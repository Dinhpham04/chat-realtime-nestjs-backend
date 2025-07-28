import { Injectable, Logger, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { AuthService } from '../../modules/auth/services/auth.service';
import { JwtUser } from '../../modules/auth/interfaces/jwt-payload.interface';

export interface UserInfo {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
}

export interface DeviceInfo {
    deviceId: string;
    deviceType: 'mobile' | 'web' | 'desktop';
    platform: 'ios' | 'android' | 'web' | 'windows' | 'mac';
    userId: string;
    socketId: string;
    lastActiveAt: Date;
}

@Injectable()
export class SocketAuthService {
    private readonly logger = new Logger(SocketAuthService.name);

    constructor(
        @Inject('IOREDIS_CLIENT')
        private readonly redis: Redis,
        private readonly jwtService: JwtService,
        private readonly authService: AuthService,
    ) { }

    /**
     * Authenticate user from JWT token using Auth Service
     */
    async authenticateSocket(token: string): Promise<JwtUser | null> {
        try {
            // Verify JWT token using Auth Service
            const payload = await this.jwtService.verifyAsync(token);

            if (!payload.sub) {
                this.logger.warn('Invalid token payload: missing user ID');
                return null;
            }

            // Validate user using AuthService (same as JWT Strategy)
            const user = await this.authService.validateUser(payload);

            if (!user) {
                this.logger.warn(`User validation failed: ${payload.sub}`);
                return null;
            }

            this.logger.log(`Socket authenticated successfully for user: ${user.userId}`);
            return user;

        } catch (error) {
            this.logger.error('Socket authentication failed:', error);
            return null;
        }
    }

    /**
     * Register device connection
     */
    async registerDeviceConnection(deviceInfo: Omit<DeviceInfo, 'lastActiveAt'>): Promise<void> {
        try {
            const deviceData = {
                ...deviceInfo,
                lastActiveAt: new Date(),
            };

            // Store device info: "device_info:{deviceId}" -> Hash
            await this.redis.hset(`device_info:${deviceInfo.deviceId}`, {
                deviceId: deviceData.deviceId,
                deviceType: deviceData.deviceType,
                platform: deviceData.platform,
                userId: deviceData.userId,
                socketId: deviceData.socketId,
                lastActiveAt: deviceData.lastActiveAt.toISOString(),
            });

            // Add device to user's device set: "user_devices:{userId}" -> Set<deviceId>
            await this.redis.sadd(`user_devices:${deviceInfo.userId}`, deviceInfo.deviceId);

            // Set expiration for device info (7 days)
            await this.redis.expire(`device_info:${deviceInfo.deviceId}`, 7 * 24 * 60 * 60);

            // Update user's device list expiration
            await this.redis.expire(`user_devices:${deviceInfo.userId}`, 7 * 24 * 60 * 60);

            this.logger.log(`Device connected: ${deviceInfo.deviceType} (${deviceInfo.deviceId}) for user ${deviceInfo.userId}`);

        } catch (error) {
            this.logger.error('Failed to register device connection:', error);
            throw error;
        }
    }

    /**
     * Unregister device connection
     */
    async unregisterDeviceConnection(deviceId: string, userId: string): Promise<void> {
        try {
            // Remove device from user's device set
            await this.redis.srem(`user_devices:${userId}`, deviceId);

            // Update device info to mark as disconnected (keep for history)
            await this.redis.hset(`device_info:${deviceId}`, {
                socketId: '', // Clear socket ID to mark as offline
                lastActiveAt: new Date().toISOString(),
            });

            // If this was the last device, set shorter expiration for user devices
            const remainingDevices = await this.redis.scard(`user_devices:${userId}`);
            if (remainingDevices === 0) {
                await this.redis.expire(`user_devices:${userId}`, 60 * 60); // 1 hour
            }

            this.logger.log(`Device disconnected: ${deviceId} for user ${userId}`);

        } catch (error) {
            this.logger.error('Failed to unregister device connection:', error);
            throw error;
        }
    }

    /**
     * Get all devices for a user
     */
    async getUserDevices(userId: string): Promise<DeviceInfo[]> {
        try {
            // Get all device IDs for user: "user_devices:{userId}" -> Set<deviceId>
            const deviceIds = await this.redis.smembers(`user_devices:${userId}`);

            if (deviceIds.length === 0) {
                return [];
            }

            // Get device info for each device: "device_info:{deviceId}" -> Hash
            const devices: DeviceInfo[] = [];

            for (const deviceId of deviceIds) {
                const deviceData = await this.redis.hgetall(`device_info:${deviceId}`);

                if (deviceData && deviceData.deviceId) {
                    devices.push({
                        deviceId: deviceData.deviceId,
                        deviceType: deviceData.deviceType as 'mobile' | 'web' | 'desktop',
                        platform: deviceData.platform as 'ios' | 'android' | 'web' | 'windows' | 'mac',
                        userId: deviceData.userId,
                        socketId: deviceData.socketId || '',
                        lastActiveAt: new Date(deviceData.lastActiveAt),
                    });
                }
            }

            return devices;

        } catch (error) {
            this.logger.error(`Failed to get user devices for ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Get other devices for a user (excluding current device)
     */
    async getUserOtherDevices(userId: string, excludeDeviceId: string): Promise<DeviceInfo[]> {
        const allDevices = await this.getUserDevices(userId);
        return allDevices.filter(device => device.deviceId !== excludeDeviceId);
    }

    /**
     * Check if user is online on any device
     */
    async isUserOnline(userId: string): Promise<boolean> {
        try {
            const devices = await this.getUserDevices(userId);

            // User is online if any device has an active socket connection
            const isOnline = devices.some(device =>
                device.socketId &&
                device.socketId.trim() !== '' &&
                this.isDeviceRecentlyActive(device.lastActiveAt)
            );

            return isOnline;

        } catch (error) {
            this.logger.error(`Failed to check online status for ${userId}:`, error);
            return false;
        }
    }

    /**
     * Helper method to check if device was recently active (within 5 minutes)
     */
    private isDeviceRecentlyActive(lastActiveAt: Date): boolean {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return lastActiveAt > fiveMinutesAgo;
    }

    /**
     * Update device last activity
     */
    async updateDeviceActivity(deviceId: string): Promise<void> {
        try {
            // Check if device exists
            const exists = await this.redis.exists(`device_info:${deviceId}`);

            if (exists) {
                // Update lastActiveAt timestamp: "device_info:{deviceId}" -> Hash
                await this.redis.hset(`device_info:${deviceId}`, {
                    lastActiveAt: new Date().toISOString(),
                });

                this.logger.debug(`Updated activity for device: ${deviceId}`);
            } else {
                this.logger.warn(`Attempted to update activity for non-existent device: ${deviceId}`);
            }

        } catch (error) {
            this.logger.error(`Failed to update device activity for ${deviceId}:`, error);
            throw error;
        }
    }

    /**
     * Clean up expired device connections
     */
    async cleanupExpiredConnections(): Promise<void> {
        try {
            const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
            let cleanedCount = 0;

            // Get all device info keys
            const deviceKeys = await this.redis.keys('device_info:*');

            for (const deviceKey of deviceKeys) {
                const deviceData = await this.redis.hgetall(deviceKey);

                if (deviceData && deviceData.lastActiveAt) {
                    const lastActiveAt = new Date(deviceData.lastActiveAt);

                    // If device hasn't been active for > 24 hours
                    if (lastActiveAt < cutoffTime) {
                        const deviceId = deviceData.deviceId;
                        const userId = deviceData.userId;

                        // Remove from user's device set
                        if (userId && deviceId) {
                            await this.redis.srem(`user_devices:${userId}`, deviceId);
                        }

                        // Delete device info
                        await this.redis.del(deviceKey);

                        cleanedCount++;
                        this.logger.debug(`Cleaned up expired device: ${deviceId}`);
                    }
                }
            }

            // Clean up empty user device sets
            const userDeviceKeys = await this.redis.keys('user_devices:*');
            for (const userKey of userDeviceKeys) {
                const deviceCount = await this.redis.scard(userKey);
                if (deviceCount === 0) {
                    await this.redis.del(userKey);
                }
            }

            this.logger.log(`Cleaned up ${cleanedCount} expired device connections`);

        } catch (error) {
            this.logger.error('Failed to cleanup expired connections:', error);
            throw error;
        }
    }

    /**
     * Get device info by device ID
     */
    async getDeviceInfo(deviceId: string): Promise<DeviceInfo | null> {
        try {
            const deviceData = await this.redis.hgetall(`device_info:${deviceId}`);

            if (!deviceData || !deviceData.deviceId) {
                return null;
            }

            return {
                deviceId: deviceData.deviceId,
                deviceType: deviceData.deviceType as 'mobile' | 'web' | 'desktop',
                platform: deviceData.platform as 'ios' | 'android' | 'web' | 'windows' | 'mac',
                userId: deviceData.userId,
                socketId: deviceData.socketId || '',
                lastActiveAt: new Date(deviceData.lastActiveAt),
            };

        } catch (error) {
            this.logger.error(`Failed to get device info for ${deviceId}:`, error);
            return null;
        }
    }

    /**
     * Update device socket ID when socket connects/disconnects
     */
    async updateDeviceSocketId(deviceId: string, socketId: string | null): Promise<void> {
        try {
            const exists = await this.redis.exists(`device_info:${deviceId}`);

            if (exists) {
                await this.redis.hset(`device_info:${deviceId}`, {
                    socketId: socketId || '',
                    lastActiveAt: new Date().toISOString(),
                });

                this.logger.debug(`Updated socket ID for device ${deviceId}: ${socketId || 'disconnected'}`);
            }

        } catch (error) {
            this.logger.error(`Failed to update socket ID for device ${deviceId}:`, error);
            throw error;
        }
    }

    /**
     * Get online device count for user
     */
    async getUserOnlineDeviceCount(userId: string): Promise<number> {
        try {
            const devices = await this.getUserDevices(userId);

            const onlineCount = devices.filter(device =>
                device.socketId &&
                device.socketId.trim() !== '' &&
                this.isDeviceRecentlyActive(device.lastActiveAt)
            ).length;

            return onlineCount;

        } catch (error) {
            this.logger.error(`Failed to get online device count for ${userId}:`, error);
            return 0;
        }
    }

    /**
     * Get all online users (for admin/monitoring purposes)
     */
    async getAllOnlineUsers(): Promise<string[]> {
        try {
            const userDeviceKeys = await this.redis.keys('user_devices:*');
            const onlineUsers: string[] = [];

            for (const userKey of userDeviceKeys) {
                const userId = userKey.replace('user_devices:', '');
                const isOnline = await this.isUserOnline(userId);

                if (isOnline) {
                    onlineUsers.push(userId);
                }
            }

            return onlineUsers;

        } catch (error) {
            this.logger.error('Failed to get all online users:', error);
            return [];
        }
    }
}
