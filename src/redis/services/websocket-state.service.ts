import { Injectable } from '@nestjs/common';
import { RealTimeStateService } from './realtime-state.service';
import { RedisCacheService } from './redis-cache.service';
import { ActivityStatus } from '../../modules/users/enums';

export interface WebSocketEvent {
  type: string;
  data: any;
  userId?: string;
  conversationId?: string;
  timestamp: Date;
}

export interface ConnectedUser {
  userId: string;
  deviceId: string;
  socketId: string;
  connectedAt: Date;
}

@Injectable()
export class WebSocketStateService {
  private connectedUsers = new Map<string, ConnectedUser>(); // socketId -> user info
  private userSockets = new Map<string, Set<string>>(); // userId -> set of socketIds

  constructor(
    private readonly realTimeState: RealTimeStateService,
    private readonly cacheService: RedisCacheService,
  ) { }

  // =============================================
  // Connection Management
  // =============================================

  /**
   * Handle user connection
   */
  async handleUserConnect(
    socketId: string,
    userId: string,
    deviceId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    // Store connection info
    const connectedUser: ConnectedUser = {
      userId,
      deviceId,
      socketId,
      connectedAt: new Date(),
    };

    this.connectedUsers.set(socketId, connectedUser);

    // Add to user's socket set
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);

    // Update Redis state
    await this.realTimeState.setUserOnline(userId, deviceId, socketId);

    // Create session
    await this.cacheService.createSession({
      userId,
      deviceId,
      socketId,
      loginTime: new Date(),
      lastActivity: new Date(),
      ipAddress,
      userAgent,
    });

    console.log(`User ${userId} connected with socket ${socketId}`);
  }

  /**
   * Handle user disconnection
   */
  async handleUserDisconnect(socketId: string): Promise<void> {
    const connectedUser = this.connectedUsers.get(socketId);

    if (!connectedUser) return;

    const { userId, deviceId } = connectedUser;

    // Remove from local maps
    this.connectedUsers.delete(socketId);

    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(socketId);

      // If no more sockets for this user, set offline
      if (userSocketSet.size === 0) {
        this.userSockets.delete(userId);
        await this.realTimeState.setUserOffline(userId, deviceId, socketId);
        await this.cacheService.removeSession(userId, deviceId);
      }
    }

    console.log(`User ${userId} disconnected from socket ${socketId}`);
  }

  /**
   * Update user activity
   */
  async updateUserActivity(socketId: string): Promise<void> {
    const connectedUser = this.connectedUsers.get(socketId);

    if (!connectedUser) return;

    const { userId, deviceId } = connectedUser;

    // Extend session in Redis
    await this.realTimeState.extendUserSession(userId, deviceId);
    await this.cacheService.updateSessionActivity(userId, deviceId);
  }

  /**
   * Get connected user by socket
   */
  getConnectedUser(socketId: string): ConnectedUser | undefined {
    return this.connectedUsers.get(socketId);
  }

  /**
   * Get user's socket IDs
   */
  getUserSockets(userId: string): string[] {
    const socketSet = this.userSockets.get(userId);
    return socketSet ? Array.from(socketSet) : [];
  }

  /**
   * Get all connected users
   */
  getAllConnectedUsers(): ConnectedUser[] {
    return Array.from(this.connectedUsers.values());
  }

  // =============================================
  // Status Management
  // =============================================

  /**
   * Update user status
   */
  async updateUserStatus(userId: string, status: ActivityStatus): Promise<void> {
    await this.realTimeState.updateUserStatus(userId, status);

    // Notify friends about status change
    const friendIds = await this.cacheService.getCachedFriendList(userId);

    const statusEvent: WebSocketEvent = {
      type: 'user_status_changed',
      data: { userId, status, timestamp: new Date() },
      timestamp: new Date(),
    };

    // Send to friends who are online
    for (const friendId of friendIds) {
      const friendSockets = this.getUserSockets(friendId);
      for (const socketId of friendSockets) {
        // In real implementation, you would emit to the socket
        console.log(`Sending status update to friend ${friendId} via socket ${socketId}`);
      }
    }
  }

  // =============================================
  // Typing Indicators
  // =============================================

  /**
   * Handle user typing
   */
  async handleUserTyping(
    userId: string,
    conversationId: string,
    isTyping: boolean,
  ): Promise<void> {
    if (isTyping) {
      await this.realTimeState.setUserTyping(userId, conversationId);
    } else {
      await this.realTimeState.stopUserTyping(userId, conversationId);
    }

    // Get other users in conversation
    const activeUsers = await this.realTimeState.getActiveUsersInConversation(conversationId);

    const typingEvent: WebSocketEvent = {
      type: isTyping ? 'user_typing_start' : 'user_typing_stop',
      data: { userId, conversationId, timestamp: new Date() },
      conversationId,
      timestamp: new Date(),
    };

    // Notify other users in conversation
    for (const activeUserId of activeUsers) {
      if (activeUserId !== userId) {
        const userSockets = this.getUserSockets(activeUserId);
        for (const socketId of userSockets) {
          console.log(`Sending typing indicator to user ${activeUserId} via socket ${socketId}`);
        }
      }
    }
  }

  /**
   * Get typing users in conversation
   */
  async getTypingUsers(conversationId: string): Promise<string[]> {
    return await this.realTimeState.getTypingUsers(conversationId);
  }

  // =============================================
  // Message Events
  // =============================================

  /**
   * Handle new message
   */
  async handleNewMessage(message: {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    type: string;
    timestamp: Date;
  }): Promise<void> {
    // Cache the message
    await this.cacheService.addMessageToCache({
      ...message,
      status: 'sent',
      type: message.type as any,
    });

    // Get users in conversation
    const activeUsers = await this.realTimeState.getActiveUsersInConversation(
      message.conversationId,
    );

    const messageEvent: WebSocketEvent = {
      type: 'new_message',
      data: message,
      conversationId: message.conversationId,
      timestamp: new Date(),
    };

    // Send to all users in conversation
    for (const userId of activeUsers) {
      const userSockets = this.getUserSockets(userId);
      for (const socketId of userSockets) {
        console.log(`Sending message to user ${userId} via socket ${socketId}`);
      }

      // Queue push notification if user is not actively in conversation
      if (userId !== message.senderId) {
        const activeConversation = await this.realTimeState.getUserActiveConversation(userId);
        if (activeConversation !== message.conversationId) {
          await this.cacheService.queuePushNotification({
            userId,
            title: 'New Message',
            body: message.content,
            data: {
              conversationId: message.conversationId,
              messageId: message.id,
            },
            priority: 'high',
          });
        }
      }
    }
  }

  /**
   * Handle message status update
   */
  async handleMessageStatusUpdate(
    messageId: string,
    conversationId: string,
    status: 'delivered' | 'read',
    userId: string,
  ): Promise<void> {
    // Update cache
    await this.cacheService.updateMessageStatus(conversationId, messageId, status);

    const statusEvent: WebSocketEvent = {
      type: 'message_status_updated',
      data: { messageId, conversationId, status, userId, timestamp: new Date() },
      conversationId,
      timestamp: new Date(),
    };

    // Send to sender
    const activeUsers = await this.realTimeState.getActiveUsersInConversation(conversationId);
    for (const activeUserId of activeUsers) {
      const userSockets = this.getUserSockets(activeUserId);
      for (const socketId of userSockets) {
        console.log(`Sending message status to user ${activeUserId} via socket ${socketId}`);
      }
    }
  }

  // =============================================
  // Conversation Management
  // =============================================

  /**
   * Join conversation
   */
  async joinConversation(userId: string, conversationId: string): Promise<void> {
    await this.realTimeState.addUserToConversation(userId, conversationId);

    // Load recent messages from cache
    const recentMessages = await this.cacheService.getCachedMessages(conversationId, 50);

    const userSockets = this.getUserSockets(userId);
    for (const socketId of userSockets) {
      console.log(`Sending recent messages to user ${userId} via socket ${socketId}`, {
        messages: recentMessages,
      });
    }
  }

  /**
   * Leave conversation
   */
  async leaveConversation(userId: string, conversationId: string): Promise<void> {
    await this.realTimeState.removeUserFromConversation(userId, conversationId);

    // Stop typing if user was typing
    await this.realTimeState.stopUserTyping(userId, conversationId);
  }

  // =============================================
  // Broadcast Methods
  // =============================================

  /**
   * Broadcast to user's devices
   */
  async broadcastToUser(userId: string, event: WebSocketEvent): Promise<void> {
    const userSockets = this.getUserSockets(userId);
    for (const socketId of userSockets) {
      console.log(`Broadcasting to user ${userId} via socket ${socketId}`, event);
    }
  }

  /**
   * Broadcast to conversation
   */
  async broadcastToConversation(conversationId: string, event: WebSocketEvent): Promise<void> {
    const activeUsers = await this.realTimeState.getActiveUsersInConversation(conversationId);

    for (const userId of activeUsers) {
      await this.broadcastToUser(userId, event);
    }
  }

  /**
   * Broadcast to friends
   */
  async broadcastToFriends(userId: string, event: WebSocketEvent): Promise<void> {
    const friendIds = await this.cacheService.getCachedFriendList(userId);

    for (const friendId of friendIds) {
      const isOnline = await this.realTimeState.isUserOnline(friendId);
      if (isOnline) {
        await this.broadcastToUser(friendId, event);
      }
    }
  }

  // =============================================
  // Statistics
  // =============================================

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    uniqueUsers: number;
    averageSocketsPerUser: number;
  } {
    const totalConnections = this.connectedUsers.size;
    const uniqueUsers = this.userSockets.size;
    const averageSocketsPerUser = uniqueUsers > 0 ? totalConnections / uniqueUsers : 0;

    return {
      totalConnections,
      uniqueUsers,
      averageSocketsPerUser,
    };
  }
}
