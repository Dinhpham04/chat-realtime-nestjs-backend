import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';

export interface CachedMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'audio' | 'video';
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
}

export interface UserSession {
  userId: string;
  deviceId: string;
  socketId?: string;
  loginTime: Date;
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class RedisCacheService {
  constructor(@Inject("IOREDIS_CLIENT") private readonly redis: Redis) { }

  // =============================================
  // Message Caching
  // =============================================

  /**
   * Cache recent messages for conversation
   */
  async cacheRecentMessages(conversationId: string, messages: CachedMessage[]): Promise<void> {
    const pipeline = this.redis.pipeline();

    // Clear existing cache
    pipeline.del(`messages:${conversationId}`);

    // Add messages to sorted set (by timestamp)
    messages.forEach(message => {
      pipeline.zadd(
        `messages:${conversationId}`,
        message.timestamp.getTime(),
        JSON.stringify(message)
      );
    });

    // Set expiration (24 hours)
    pipeline.expire(`messages:${conversationId}`, 86400);

    await pipeline.exec();
  }

  /**
   * Add new message to cache
   */
  async addMessageToCache(message: CachedMessage): Promise<void> {
    await this.redis.zadd(
      `messages:${message.conversationId}`,
      message.timestamp.getTime(),
      JSON.stringify(message)
    );

    // Maintain only last 100 messages in cache
    await this.redis.zremrangebyrank(`messages:${message.conversationId}`, 0, -101);

    // Extend expiration
    await this.redis.expire(`messages:${message.conversationId}`, 86400);
  }

  /**
   * Get cached messages for conversation
   */
  async getCachedMessages(conversationId: string, limit: number = 50): Promise<CachedMessage[]> {
    const messageStrings = await this.redis.zrevrange(
      `messages:${conversationId}`,
      0,
      limit - 1
    );

    return messageStrings.map(str => JSON.parse(str));
  }

  /**
   * Update message status in cache
   */
  async updateMessageStatus(
    conversationId: string,
    messageId: string,
    status: 'sent' | 'delivered' | 'read'
  ): Promise<void> {
    const messageStrings = await this.redis.zrange(`messages:${conversationId}`, 0, -1);

    for (const messageStr of messageStrings) {
      const message = JSON.parse(messageStr);
      if (message.id === messageId) {
        message.status = status;

        // Remove old entry and add updated one
        await this.redis.zrem(`messages:${conversationId}`, messageStr);
        await this.redis.zadd(
          `messages:${conversationId}`,
          message.timestamp.getTime(),
          JSON.stringify(message)
        );
        break;
      }
    }
  }

  /**
   * Clear message cache for conversation
   */
  async clearMessageCache(conversationId: string): Promise<void> {
    await this.redis.del(`messages:${conversationId}`);
  }

  // =============================================
  // Session Management
  // =============================================

  /**
   * Create user session
   */
  async createSession(session: UserSession): Promise<void> {
    const sessionKey = `session:${session.userId}:${session.deviceId}`;

    await this.redis.setex(sessionKey, 3600, JSON.stringify(session)); // 1 hour TTL

    // Add to user's active sessions
    await this.redis.sadd(`sessions:${session.userId}`, sessionKey);
    await this.redis.expire(`sessions:${session.userId}`, 3600);
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(userId: string, deviceId: string): Promise<void> {
    const sessionKey = `session:${userId}:${deviceId}`;
    const sessionData = await this.redis.get(sessionKey);

    if (sessionData) {
      const session: UserSession = JSON.parse(sessionData);
      session.lastActivity = new Date();

      await this.redis.setex(sessionKey, 3600, JSON.stringify(session));
    }
  }

  /**
   * Get user session
   */
  async getSession(userId: string, deviceId: string): Promise<UserSession | null> {
    const sessionKey = `session:${userId}:${deviceId}`;
    const data = await this.redis.get(sessionKey);

    if (!data) return null;

    return JSON.parse(data);
  }

  /**
   * Get all user sessions
   */
  async getUserSessions(userId: string): Promise<UserSession[]> {
    const sessionKeys = await this.redis.smembers(`sessions:${userId}`);
    const sessions: UserSession[] = [];

    for (const sessionKey of sessionKeys) {
      const data = await this.redis.get(sessionKey);
      if (data) {
        sessions.push(JSON.parse(data));
      }
    }

    return sessions;
  }

  /**
   * Remove session
   */
  async removeSession(userId: string, deviceId: string): Promise<void> {
    const sessionKey = `session:${userId}:${deviceId}`;

    await this.redis.del(sessionKey);
    await this.redis.srem(`sessions:${userId}`, sessionKey);
  }

  /**
   * Remove all user sessions
   */
  async removeAllUserSessions(userId: string): Promise<void> {
    const sessionKeys = await this.redis.smembers(`sessions:${userId}`);

    if (sessionKeys.length > 0) {
      await this.redis.del(...sessionKeys);
      await this.redis.del(`sessions:${userId}`);
    }
  }

  // =============================================
  // Friend Lists Caching
  // =============================================

  /**
   * Cache user's friend list
   */
  async cacheFriendList(userId: string, friendIds: string[]): Promise<void> {
    const friendKey = `friends:${userId}`;

    // Clear existing and add new
    await this.redis.del(friendKey);
    if (friendIds.length > 0) {
      await this.redis.sadd(friendKey, ...friendIds);
    }

    // Set expiration (2 hours)
    await this.redis.expire(friendKey, 7200);
  }

  /**
   * Add friend to cache
   */
  async addFriendToCache(userId: string, friendId: string): Promise<void> {
    await this.redis.sadd(`friends:${userId}`, friendId);
    await this.redis.expire(`friends:${userId}`, 7200);
  }

  /**
   * Remove friend from cache
   */
  async removeFriendFromCache(userId: string, friendId: string): Promise<void> {
    await this.redis.srem(`friends:${userId}`, friendId);
  }

  /**
   * Get cached friend list
   */
  async getCachedFriendList(userId: string): Promise<string[]> {
    return await this.redis.smembers(`friends:${userId}`);
  }

  /**
   * Check if users are friends (cached)
   */
  async areFriendsCached(userId: string, friendId: string): Promise<boolean | null> {
    const exists = await this.redis.exists(`friends:${userId}`);
    if (!exists) return null; // Cache miss

    const result = await this.redis.sismember(`friends:${userId}`, friendId);
    return result === 1;
  }

  // =============================================
  // Notification Queues
  // =============================================

  /**
   * Queue push notification
   */
  async queuePushNotification(notification: {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, any>;
    priority?: 'high' | 'normal';
  }): Promise<void> {
    const notificationData = {
      ...notification,
      timestamp: new Date(),
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    // Add to user's notification queue
    await this.redis.lpush(
      `notifications:${notification.userId}`,
      JSON.stringify(notificationData)
    );

    // Maintain only last 100 notifications
    await this.redis.ltrim(`notifications:${notification.userId}`, 0, 99);

    // Add to global processing queue
    const priority = notification.priority === 'high' ? 'high' : 'normal';
    await this.redis.lpush(`notification_queue:${priority}`, JSON.stringify(notificationData));
  }

  /**
   * Get pending notifications for user
   */
  async getPendingNotifications(userId: string, limit: number = 20): Promise<any[]> {
    const notificationStrings = await this.redis.lrange(
      `notifications:${userId}`,
      0,
      limit - 1
    );

    return notificationStrings.map(str => JSON.parse(str));
  }

  /**
   * Process notification queue
   */
  async processNotificationQueue(priority: 'high' | 'normal' = 'normal'): Promise<any[]> {
    const notifications: any[] = [];

    // Get up to 10 notifications
    for (let i = 0; i < 10; i++) {
      const notificationStr = await this.redis.rpop(`notification_queue:${priority}`);
      if (!notificationStr) break;

      notifications.push(JSON.parse(notificationStr));
    }

    return notifications;
  }

  // =============================================
  // Rate Limiting
  // =============================================

  /**
   * Check rate limit for user action
   */
  async checkRateLimit(
    userId: string,
    action: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `rate_limit:${userId}:${action}`;
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);

    // Remove old entries
    await this.redis.zremrangebyscore(key, 0, windowStart);

    // Count current requests
    const currentCount = await this.redis.zcard(key);

    if (currentCount >= maxRequests) {
      const oldestRequest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const resetTime = oldestRequest.length > 0
        ? parseInt(oldestRequest[1]) + (windowSeconds * 1000)
        : now + (windowSeconds * 1000);

      return {
        allowed: false,
        remaining: 0,
        resetTime,
      };
    }

    // Add current request
    await this.redis.zadd(key, now, `${now}_${Math.random()}`);
    await this.redis.expire(key, windowSeconds);

    return {
      allowed: true,
      remaining: maxRequests - currentCount - 1,
      resetTime: now + (windowSeconds * 1000),
    };
  }

  // =============================================
  // Health Check
  // =============================================

  /**
   * Health check for Redis connection
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number }> {
    const start = Date.now();

    try {
      await this.redis.ping();
      const latency = Date.now() - start;

      return {
        status: 'healthy',
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
      };
    }
  }

  // =============================================
  // Generic Cache Methods for Friends Module
  // =============================================

  /**
   * Set cache with expiration
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, value);
    } else {
      await this.redis.set(key, value);
    }
  }

  /**
   * Get cache value
   */
  async get(key: string): Promise<string | null> {
    return await this.redis.get(key);
  }

  /**
   * Delete cache key
   */
  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Check if user is online via Redis
   */
  async isUserOnline(userId: string): Promise<boolean> {
    const sessionKey = `user:${userId}:sessions`;
    const sessions = await this.redis.hgetall(sessionKey);
    return Object.keys(sessions).length > 0;
  }

  /**
   * Set user online status
   */
  async setUserOnline(userId: string, socketId: string): Promise<void> {
    const sessionKey = `user:${userId}:sessions`;
    const onlineKey = `user:${userId}:online`;

    await this.redis.hset(sessionKey, socketId, Date.now().toString());
    await this.redis.set(onlineKey, 'true', 'EX', 300); // 5 minutes TTL
  }

  /**
   * Set user offline
   */
  async setUserOffline(userId: string, socketId?: string): Promise<void> {
    const sessionKey = `user:${userId}:sessions`;
    const onlineKey = `user:${userId}:online`;

    if (socketId) {
      await this.redis.hdel(sessionKey, socketId);
    }

    // Check if any sessions remain
    const remainingSessions = await this.redis.hgetall(sessionKey);
    if (Object.keys(remainingSessions).length === 0) {
      await this.redis.del(onlineKey);
    }
  }
}
