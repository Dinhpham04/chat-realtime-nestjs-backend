import Redis from 'ioredis';
import { ActivityStatus } from '../../modules/users/enums';
import { Inject, Injectable } from '@nestjs/common';

export interface UserPresence {
  userId: string;
  status: ActivityStatus;
  lastSeen: Date;
  deviceId?: string;
  socketId?: string;
}

export interface TypingStatus {
  userId: string;
  conversationId: string;
  isTyping: boolean;
  timestamp: Date;
}

@Injectable()
export class RealTimeStateService {
  constructor(
    @Inject('IOREDIS_CLIENT') private readonly redis: Redis
  ) { }

  // =============================================
  // User Presence Management
  // =============================================

  /**
   * Set user online status
   */
  async setUserOnline(userId: string, deviceId: string, socketId?: string): Promise<void> {
    const presence: UserPresence = {
      userId,
      status: ActivityStatus.ONLINE,
      lastSeen: new Date(),
      deviceId,
      socketId,
    };

    const pipeline = this.redis.pipeline();

    // Set user presence with TTL (5 minutes)
    pipeline.setex(`presence:${userId}`, 300, JSON.stringify(presence));

    // Add to online users set
    pipeline.sadd('online:users', userId);

    // Set device-specific presence
    pipeline.setex(`presence:${userId}:${deviceId}`, 300, JSON.stringify(presence));

    // Map socket to user (if provided)
    if (socketId) {
      pipeline.setex(`socket:${socketId}`, 300, userId);
    }

    await pipeline.exec();
  }

  /**
   * Set user offline
   */
  async setUserOffline(userId: string, deviceId?: string, socketId?: string): Promise<void> {
    const pipeline = this.redis.pipeline();

    // Update presence with offline status
    const presence: UserPresence = {
      userId,
      status: ActivityStatus.OFFLINE,
      lastSeen: new Date(),
      deviceId,
    };

    pipeline.setex(`presence:${userId}`, 3600, JSON.stringify(presence)); // Keep for 1 hour

    // Remove from online users set
    pipeline.srem('online:users', userId);

    // Remove device-specific presence
    if (deviceId) {
      pipeline.del(`presence:${userId}:${deviceId}`);
    }

    // Remove socket mapping
    if (socketId) {
      pipeline.del(`socket:${socketId}`);
    }

    await pipeline.exec();
  }

  /**
   * Update user activity status
   */
  async updateUserStatus(userId: string, status: ActivityStatus): Promise<void> {
    const currentPresence = await this.getUserPresence(userId);
    if (currentPresence) {
      currentPresence.status = status;
      currentPresence.lastSeen = new Date();

      await this.redis.setex(`presence:${userId}`, 300, JSON.stringify(currentPresence));
    }
  }

  /**
   * Get user presence
   */
  async getUserPresence(userId: string): Promise<UserPresence | null> {
    const data = await this.redis.get(`presence:${userId}`);
    if (!data) return null;

    return JSON.parse(data);
  }

  /**
   * Get multiple users presence
   */
  async getUsersPresence(userIds: string[]): Promise<Map<string, UserPresence>> {
    const pipeline = this.redis.pipeline();
    userIds.forEach(userId => {
      pipeline.get(`presence:${userId}`);
    });

    const results = await pipeline.exec();
    const presenceMap = new Map<string, UserPresence>();

    results?.forEach((result, index) => {
      if (result && result[1]) {
        const presence = JSON.parse(result[1] as string);
        presenceMap.set(userIds[index], presence);
      }
    });

    return presenceMap;
  }

  /**
   * Get all online users
   */
  async getOnlineUsers(): Promise<string[]> {
    return await this.redis.smembers('online:users');
  }

  /**
   * Check if user is online
   */
  async isUserOnline(userId: string): Promise<boolean> {
    const result = await this.redis.sismember('online:users', userId);
    return result === 1;
  }

  /**
   * Get user by socket ID
   */
  async getUserBySocketId(socketId: string): Promise<string | null> {
    return await this.redis.get(`socket:${socketId}`);
  }

  // =============================================
  // Typing Indicators
  // =============================================

  /**
   * Set user typing in conversation
   */
  async setUserTyping(userId: string, conversationId: string): Promise<void> {
    const typingStatus: TypingStatus = {
      userId,
      conversationId,
      isTyping: true,
      timestamp: new Date(),
    };

    // Set with 10 seconds TTL
    await this.redis.setex(
      `typing:${conversationId}:${userId}`,
      10,
      JSON.stringify(typingStatus)
    );

    // Add to typing users set for this conversation
    await this.redis.sadd(`typing:${conversationId}:users`, userId);
    await this.redis.expire(`typing:${conversationId}:users`, 10);
  }

  /**
   * Stop user typing
   */
  async stopUserTyping(userId: string, conversationId: string): Promise<void> {
    await this.redis.del(`typing:${conversationId}:${userId}`);
    await this.redis.srem(`typing:${conversationId}:users`, userId);
  }

  /**
   * Get typing users in conversation
   */
  async getTypingUsers(conversationId: string): Promise<string[]> {
    return await this.redis.smembers(`typing:${conversationId}:users`);
  }

  /**
   * Check if user is typing
   */
  async isUserTyping(userId: string, conversationId: string): Promise<boolean> {
    const data = await this.redis.get(`typing:${conversationId}:${userId}`);
    return !!data;
  }

  // =============================================
  // Active Conversations
  // =============================================

  /**
   * Add user to active conversation
   */
  async addUserToConversation(userId: string, conversationId: string): Promise<void> {
    await this.redis.sadd(`conversation:${conversationId}:active`, userId);
    await this.redis.setex(`user:${userId}:active_conversation`, 3600, conversationId);
  }

  /**
   * Remove user from conversation
   */
  async removeUserFromConversation(userId: string, conversationId: string): Promise<void> {
    await this.redis.srem(`conversation:${conversationId}:active`, userId);
    await this.redis.del(`user:${userId}:active_conversation`);
  }

  /**
   * Get active users in conversation
   */
  async getActiveUsersInConversation(conversationId: string): Promise<string[]> {
    return await this.redis.smembers(`conversation:${conversationId}:active`);
  }

  /**
   * Get user's active conversation
   */
  async getUserActiveConversation(userId: string): Promise<string | null> {
    return await this.redis.get(`user:${userId}:active_conversation`);
  }

  // =============================================
  // Utility Methods
  // =============================================

  /**
   * Extend user session TTL (heartbeat)
   */
  async extendUserSession(userId: string, deviceId?: string): Promise<void> {
    const pipeline = this.redis.pipeline();

    pipeline.expire(`presence:${userId}`, 300);

    if (deviceId) {
      pipeline.expire(`presence:${userId}:${deviceId}`, 300);
    }

    await pipeline.exec();
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    // This would be called by a cron job
    const onlineUsers = await this.getOnlineUsers();

    for (const userId of onlineUsers) {
      const presence = await this.getUserPresence(userId);
      if (!presence) {
        // Remove from online set if no presence data
        await this.redis.srem('online:users', userId);
      }
    }
  }

  /**
   * Get real-time stats
   */
  async getStats(): Promise<{
    onlineUsers: number;
    totalPresenceKeys: number;
    activeConversations: number;
  }> {
    const pipeline = this.redis.pipeline();

    pipeline.scard('online:users');
    pipeline.eval(`return #redis.call('keys', 'presence:*')`, 0);
    pipeline.eval(`return #redis.call('keys', 'conversation:*:active')`, 0);

    const results = await pipeline.exec();

    return {
      onlineUsers: (results?.[0]?.[1] as number) || 0,
      totalPresenceKeys: (results?.[1]?.[1] as number) || 0,
      activeConversations: (results?.[2]?.[1] as number) || 0,
    };
  }
}
