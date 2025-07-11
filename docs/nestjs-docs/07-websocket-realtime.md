# 7. WebSocket & Real-time Communication

## Tổng quan về Real-time Communication

### WebSocket vs HTTP
```
HTTP Request-Response:
Client ──────► Server
       ◄────── Response
       
WebSocket Connection:
Client ◄────► Server (Bidirectional, persistent)
```

### Real-time Features trong Chat App
- **Instant Messaging**: Tin nhắn real-time
- **Typing Indicators**: Hiển thị khi user đang type
- **Online Status**: User online/offline status
- **Message Delivery Status**: Sent, delivered, read receipts
- **Live Notifications**: Push notifications real-time
- **Voice/Video Calls**: Real-time communication

### Technology Stack
- **Socket.IO**: WebSocket library với fallback
- **NestJS WebSocket Gateway**: Built-in WebSocket support
- **Redis Adapter**: Scale WebSocket across multiple servers
- **JWT Authentication**: Secure WebSocket connections

---

## 1. Socket.IO Setup với NestJS

### Cài đặt packages
```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
npm install -D @types/socket.io
```

### WebSocket Gateway
```typescript
// gateways/chat.gateway.ts
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsGuard } from '../auth/guards/ws.guard';
import { User } from '../auth/decorators/user.decorator';
import { ChatService } from '../chat/chat.service';
import { UsersService } from '../users/users.service';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/chat', // Namespace cho chat
})
export class ChatGateway 
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(
    private readonly chatService: ChatService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract JWT token từ handshake
      const token = this.extractTokenFromHandshake(client);
      
      if (!token) {
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = this.jwtService.verify(token);
      const user = await this.usersService.findOne(payload.sub);

      if (!user || !user.isActive) {
        client.disconnect();
        return;
      }

      // Attach user info to socket
      client.user = {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
      };

      // Store connection
      this.connectedUsers.set(user._id.toString(), client.id);

      // Update user online status
      await this.usersService.updateOnlineStatus(user._id.toString(), true);

      // Join user to personal room (for private messages)
      client.join(`user:${user._id}`);

      // Get user's conversations và join rooms
      const conversations = await this.chatService.getUserConversations(user._id.toString());
      conversations.forEach(conv => {
        client.join(`conversation:${conv._id}`);
      });

      // Broadcast user online status
      this.server.emit('userOnline', {
        userId: user._id,
        username: user.username,
        timestamp: new Date(),
      });

      this.logger.log(`User ${user.username} connected with socket ${client.id}`);
    } catch (error) {
      this.logger.error('Connection error:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.user) {
      // Remove from connected users
      this.connectedUsers.delete(client.user.id);

      // Update user offline status
      await this.usersService.updateOnlineStatus(client.user.id, false);

      // Broadcast user offline status
      this.server.emit('userOffline', {
        userId: client.user.id,
        username: client.user.username,
        timestamp: new Date(),
      });

      this.logger.log(`User ${client.user.username} disconnected`);
    }
  }

  private extractTokenFromHandshake(client: Socket): string | null {
    // Extract token từ query params hoặc headers
    const token = client.handshake.auth?.token || 
                 client.handshake.headers?.authorization?.replace('Bearer ', '');
    return token || null;
  }

  // ========================= MESSAGE EVENTS =========================

  @UseGuards(WsGuard)
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: {
      conversationId: string;
      content: string;
      messageType?: 'text' | 'image' | 'file' | 'voice';
      replyTo?: string;
    },
  ) {
    try {
      const { conversationId, content, messageType = 'text', replyTo } = data;

      // Validate conversation access
      const conversation = await this.chatService.getConversation(conversationId);
      if (!conversation || !conversation.participants.includes(client.user.id)) {
        client.emit('error', { message: 'Access denied to conversation' });
        return;
      }

      // Create message
      const message = await this.chatService.createMessage({
        conversationId,
        senderId: client.user.id,
        content,
        messageType,
        replyTo,
      });

      // Emit to conversation room
      this.server.to(`conversation:${conversationId}`).emit('newMessage', {
        message,
        conversation: {
          id: conversation._id,
          name: conversation.name,
          type: conversation.type,
        },
      });

      // Send push notifications to offline users
      const offlineParticipants = conversation.participants.filter(
        participantId => participantId !== client.user.id && 
                        !this.connectedUsers.has(participantId)
      );

      if (offlineParticipants.length > 0) {
        // Trigger push notification service
        await this.chatService.sendPushNotifications(
          offlineParticipants,
          message,
          conversation,
        );
      }

      this.logger.log(`Message sent in conversation ${conversationId} by ${client.user.username}`);
    } catch (error) {
      this.logger.error('Send message error:', error);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  @UseGuards(WsGuard)
  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    const { conversationId, isTyping } = data;

    // Broadcast typing status to conversation (except sender)
    client.to(`conversation:${conversationId}`).emit('userTyping', {
      userId: client.user.id,
      username: client.user.username,
      conversationId,
      isTyping,
      timestamp: new Date(),
    });
  }

  @UseGuards(WsGuard)
  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; messageId: string },
  ) {
    try {
      const { conversationId, messageId } = data;

      await this.chatService.markMessageAsRead(messageId, client.user.id);

      // Broadcast read receipt
      this.server.to(`conversation:${conversationId}`).emit('messageRead', {
        messageId,
        readBy: client.user.id,
        readAt: new Date(),
      });
    } catch (error) {
      this.logger.error('Mark as read error:', error);
    }
  }

  // ========================= CONVERSATION EVENTS =========================

  @UseGuards(WsGuard)
  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    const { conversationId } = data;

    // Validate access
    const conversation = await this.chatService.getConversation(conversationId);
    if (!conversation || !conversation.participants.includes(client.user.id)) {
      client.emit('error', { message: 'Access denied to conversation' });
      return;
    }

    client.join(`conversation:${conversationId}`);
    
    client.emit('joinedConversation', {
      conversationId,
      message: 'Successfully joined conversation',
    });
  }

  @UseGuards(WsGuard)
  @SubscribeMessage('leaveConversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    const { conversationId } = data;
    
    client.leave(`conversation:${conversationId}`);
    
    client.emit('leftConversation', {
      conversationId,
      message: 'Successfully left conversation',
    });
  }

  @UseGuards(WsGuard)
  @SubscribeMessage('createConversation')
  async handleCreateConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: {
      name?: string;
      type: 'private' | 'group';
      participantIds: string[];
    },
  ) {
    try {
      const { name, type, participantIds } = data;

      // Add creator to participants
      const allParticipants = [...new Set([client.user.id, ...participantIds])];

      const conversation = await this.chatService.createConversation({
        name,
        type,
        participants: allParticipants,
        createdBy: client.user.id,
      });

      // Add all participants to conversation room
      allParticipants.forEach(participantId => {
        const socketId = this.connectedUsers.get(participantId);
        if (socketId) {
          this.server.to(socketId).socketsJoin(`conversation:${conversation._id}`);
        }
      });

      // Broadcast new conversation to all participants
      this.server.to(`conversation:${conversation._id}`).emit('newConversation', {
        conversation,
        createdBy: {
          id: client.user.id,
          username: client.user.username,
        },
      });

      this.logger.log(`Conversation ${conversation._id} created by ${client.user.username}`);
    } catch (error) {
      this.logger.error('Create conversation error:', error);
      client.emit('error', { message: 'Failed to create conversation' });
    }
  }

  // ========================= UTILITY METHODS =========================

  /**
   * Send message to specific user
   */
  sendToUser(userId: string, event: string, data: any) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  /**
   * Send message to conversation
   */
  sendToConversation(conversationId: string, event: string, data: any) {
    this.server.to(`conversation:${conversationId}`).emit(event, data);
  }

  /**
   * Get online users count
   */
  getOnlineUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  /**
   * Get all online users
   */
  getOnlineUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }
}
```

### WebSocket Guard cho Authentication
```typescript
// auth/guards/ws.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class WsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    
    // Check if user is authenticated (set in handleConnection)
    return !!(client as any).user;
  }
}
```

---

## 2. Chat Service cho WebSocket

```typescript
// chat/chat.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from '../schemas/message.schema';
import { Conversation, ConversationDocument } from '../schemas/conversation.schema';
import { NotificationService } from '../notification/notification.service';

export interface CreateMessageDto {
  conversationId: string;
  senderId: string;
  content: string;
  messageType?: 'text' | 'image' | 'file' | 'voice';
  replyTo?: string;
}

export interface CreateConversationDto {
  name?: string;
  type: 'private' | 'group';
  participants: string[];
  createdBy: string;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    private notificationService: NotificationService,
  ) {}

  // ========================= CONVERSATION METHODS =========================

  async createConversation(data: CreateConversationDto): Promise<ConversationDocument> {
    // Validate participants
    if (data.participants.length < 2) {
      throw new ForbiddenException('Conversation must have at least 2 participants');
    }

    // For private conversations, check if already exists
    if (data.type === 'private' && data.participants.length === 2) {
      const existingConversation = await this.conversationModel.findOne({
        type: 'private',
        participants: { $all: data.participants, $size: 2 },
      });

      if (existingConversation) {
        return existingConversation;
      }
    }

    const conversation = new this.conversationModel({
      name: data.name,
      type: data.type,
      participants: data.participants.map(id => new Types.ObjectId(id)),
      createdBy: new Types.ObjectId(data.createdBy),
      lastActivity: new Date(),
    });

    return conversation.save();
  }

  async getConversation(conversationId: string): Promise<ConversationDocument> {
    const conversation = await this.conversationModel
      .findById(conversationId)
      .populate('participants', 'username email avatar isOnline lastSeen')
      .populate('lastMessage')
      .populate('createdBy', 'username email avatar')
      .exec();

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  async getUserConversations(userId: string): Promise<ConversationDocument[]> {
    return this.conversationModel
      .find({
        participants: new Types.ObjectId(userId),
      })
      .populate('participants', 'username email avatar isOnline lastSeen')
      .populate('lastMessage')
      .sort({ lastActivity: -1 })
      .exec();
  }

  async addParticipantToConversation(
    conversationId: string,
    participantId: string,
    addedBy: string,
  ): Promise<ConversationDocument> {
    const conversation = await this.getConversation(conversationId);

    if (conversation.type === 'private') {
      throw new ForbiddenException('Cannot add participants to private conversation');
    }

    if (!conversation.participants.some(p => p._id.toString() === addedBy)) {
      throw new ForbiddenException('Only participants can add others');
    }

    if (conversation.participants.some(p => p._id.toString() === participantId)) {
      throw new ForbiddenException('User is already a participant');
    }

    conversation.participants.push(new Types.ObjectId(participantId));
    conversation.lastActivity = new Date();

    return conversation.save();
  }

  async removeParticipantFromConversation(
    conversationId: string,
    participantId: string,
    removedBy: string,
  ): Promise<ConversationDocument> {
    const conversation = await this.getConversation(conversationId);

    if (conversation.type === 'private') {
      throw new ForbiddenException('Cannot remove participants from private conversation');
    }

    // Check permissions (admin or self-removal)
    const isAdmin = conversation.createdBy.toString() === removedBy;
    const isSelfRemoval = participantId === removedBy;

    if (!isAdmin && !isSelfRemoval) {
      throw new ForbiddenException('Insufficient permissions');
    }

    conversation.participants = conversation.participants.filter(
      p => p._id.toString() !== participantId
    );
    conversation.lastActivity = new Date();

    return conversation.save();
  }

  // ========================= MESSAGE METHODS =========================

  async createMessage(data: CreateMessageDto): Promise<MessageDocument> {
    // Validate conversation access
    const conversation = await this.getConversation(data.conversationId);
    if (!conversation.participants.some(p => p._id.toString() === data.senderId)) {
      throw new ForbiddenException('Access denied to conversation');
    }

    const message = new this.messageModel({
      conversationId: new Types.ObjectId(data.conversationId),
      senderId: new Types.ObjectId(data.senderId),
      content: data.content,
      messageType: data.messageType || 'text',
      replyTo: data.replyTo ? new Types.ObjectId(data.replyTo) : undefined,
      timestamp: new Date(),
      deliveryStatus: 'sent',
    });

    const savedMessage = await message.save();

    // Update conversation last message and activity
    await this.conversationModel.findByIdAndUpdate(data.conversationId, {
      lastMessage: savedMessage._id,
      lastActivity: new Date(),
    });

    // Populate sender info
    await savedMessage.populate('senderId', 'username email avatar');
    if (savedMessage.replyTo) {
      await savedMessage.populate('replyTo');
    }

    return savedMessage;
  }

  async getConversationMessages(
    conversationId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{
    messages: MessageDocument[];
    totalPages: number;
    currentPage: number;
    hasMore: boolean;
  }> {
    const skip = (page - 1) * limit;

    const [messages, totalCount] = await Promise.all([
      this.messageModel
        .find({ conversationId: new Types.ObjectId(conversationId) })
        .populate('senderId', 'username email avatar')
        .populate('replyTo')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.messageModel.countDocuments({ conversationId: new Types.ObjectId(conversationId) }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    return {
      messages: messages.reverse(), // Return in chronological order
      totalPages,
      currentPage: page,
      hasMore,
    };
  }

  async markMessageAsRead(messageId: string, readBy: string): Promise<void> {
    await this.messageModel.findByIdAndUpdate(
      messageId,
      {
        $addToSet: { readBy: new Types.ObjectId(readBy) },
        deliveryStatus: 'read',
      },
    );
  }

  async markConversationAsRead(conversationId: string, userId: string): Promise<void> {
    await this.messageModel.updateMany(
      {
        conversationId: new Types.ObjectId(conversationId),
        senderId: { $ne: new Types.ObjectId(userId) },
        readBy: { $ne: new Types.ObjectId(userId) },
      },
      {
        $addToSet: { readBy: new Types.ObjectId(userId) },
      },
    );
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messageModel.findById(messageId);

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId.toString() !== userId) {
      throw new ForbiddenException('Can only delete your own messages');
    }

    // Soft delete - mark as deleted but keep in database
    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();
  }

  async editMessage(
    messageId: string,
    userId: string,
    newContent: string,
  ): Promise<MessageDocument> {
    const message = await this.messageModel.findById(messageId);

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId.toString() !== userId) {
      throw new ForbiddenException('Can only edit your own messages');
    }

    if (message.isDeleted) {
      throw new ForbiddenException('Cannot edit deleted message');
    }

    // Check if message is too old to edit (e.g., 15 minutes)
    const editTimeLimit = 15 * 60 * 1000; // 15 minutes
    const timeSinceCreation = Date.now() - message.timestamp.getTime();
    if (timeSinceCreation > editTimeLimit) {
      throw new ForbiddenException('Message is too old to edit');
    }

    message.content = newContent;
    message.isEdited = true;
    message.editedAt = new Date();

    return message.save();
  }

  // ========================= NOTIFICATION METHODS =========================

  async sendPushNotifications(
    userIds: string[],
    message: MessageDocument,
    conversation: ConversationDocument,
  ): Promise<void> {
    for (const userId of userIds) {
      await this.notificationService.sendPushNotification(userId, {
        title: conversation.type === 'private' 
          ? `New message from ${message.senderId.username}`
          : `New message in ${conversation.name}`,
        body: message.content,
        data: {
          type: 'new_message',
          conversationId: conversation._id.toString(),
          messageId: message._id.toString(),
        },
      });
    }
  }

  // ========================= UTILITY METHODS =========================

  async getUnreadMessageCount(conversationId: string, userId: string): Promise<number> {
    return this.messageModel.countDocuments({
      conversationId: new Types.ObjectId(conversationId),
      senderId: { $ne: new Types.ObjectId(userId) },
      readBy: { $ne: new Types.ObjectId(userId) },
      isDeleted: { $ne: true },
    });
  }

  async getUserUnreadCount(userId: string): Promise<number> {
    const conversations = await this.getUserConversations(userId);
    let totalUnread = 0;

    for (const conversation of conversations) {
      const unread = await this.getUnreadMessageCount(conversation._id.toString(), userId);
      totalUnread += unread;
    }

    return totalUnread;
  }

  async searchMessages(
    conversationId: string,
    query: string,
    userId: string,
  ): Promise<MessageDocument[]> {
    // Verify user has access to conversation
    const conversation = await this.getConversation(conversationId);
    if (!conversation.participants.some(p => p._id.toString() === userId)) {
      throw new ForbiddenException('Access denied to conversation');
    }

    return this.messageModel
      .find({
        conversationId: new Types.ObjectId(conversationId),
        content: { $regex: query, $options: 'i' },
        isDeleted: { $ne: true },
      })
      .populate('senderId', 'username email avatar')
      .sort({ timestamp: -1 })
      .limit(50)
      .exec();
  }
}
```

---

## 3. Message và Conversation Schemas

### Message Schema
```typescript
// schemas/message.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  _id: Types.ObjectId;

  @Prop({ 
    type: Types.ObjectId, 
    ref: 'Conversation', 
    required: true,
    index: true 
  })
  conversationId: Types.ObjectId;

  @Prop({ 
    type: Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  })
  senderId: Types.ObjectId;

  @Prop({ 
    required: true,
    maxlength: 10000 // Max message length
  })
  content: string;

  @Prop({
    type: String,
    enum: ['text', 'image', 'file', 'voice', 'video', 'location'],
    default: 'text'
  })
  messageType: string;

  @Prop({ 
    type: Types.ObjectId, 
    ref: 'Message',
    default: null 
  })
  replyTo?: Types.ObjectId;

  @Prop({ 
    required: true,
    default: Date.now,
    index: true 
  })
  timestamp: Date;

  @Prop({
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  })
  deliveryStatus: string;

  @Prop([{ 
    type: Types.ObjectId, 
    ref: 'User' 
  }])
  readBy: Types.ObjectId[];

  @Prop({ 
    default: false 
  })
  isEdited: boolean;

  @Prop()
  editedAt?: Date;

  @Prop({ 
    default: false 
  })
  isDeleted: boolean;

  @Prop()
  deletedAt?: Date;

  // File attachment properties
  @Prop()
  fileUrl?: string;

  @Prop()
  fileName?: string;

  @Prop()
  fileSize?: number;

  @Prop()
  mimeType?: string;

  // Voice message properties
  @Prop()
  duration?: number; // in seconds

  // Location properties
  @Prop()
  latitude?: number;

  @Prop()
  longitude?: number;

  @Prop()
  locationName?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Indexes
MessageSchema.index({ conversationId: 1, timestamp: -1 });
MessageSchema.index({ senderId: 1, timestamp: -1 });
MessageSchema.index({ content: 'text' }); // Text search index
```

### Conversation Schema
```typescript
// schemas/conversation.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true })
export class Conversation {
  _id: Types.ObjectId;

  @Prop({ 
    maxlength: 100 
  })
  name?: string;

  @Prop({
    type: String,
    enum: ['private', 'group'],
    required: true
  })
  type: string;

  @Prop([{ 
    type: Types.ObjectId, 
    ref: 'User',
    required: true 
  }])
  participants: Types.ObjectId[];

  @Prop({ 
    type: Types.ObjectId, 
    ref: 'User', 
    required: true 
  })
  createdBy: Types.ObjectId;

  @Prop({ 
    type: Types.ObjectId, 
    ref: 'Message' 
  })
  lastMessage?: Types.ObjectId;

  @Prop({ 
    required: true,
    default: Date.now,
    index: true 
  })
  lastActivity: Date;

  @Prop()
  avatar?: string;

  @Prop({ 
    maxlength: 500 
  })
  description?: string;

  // Group conversation settings
  @Prop([{ 
    type: Types.ObjectId, 
    ref: 'User' 
  }])
  admins?: Types.ObjectId[];

  @Prop({ 
    default: false 
  })
  isArchived: boolean;

  @Prop()
  archivedAt?: Date;

  @Prop({ 
    default: false 
  })
  isMuted: boolean;

  @Prop()
  mutedUntil?: Date;

  // Privacy settings
  @Prop({
    type: String,
    enum: ['public', 'private', 'invite-only'],
    default: 'private'
  })
  privacy: string;

  @Prop()
  inviteCode?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Indexes
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ lastActivity: -1 });
ConversationSchema.index({ type: 1, participants: 1 });
```

---

## 4. Redis Adapter cho Scaling

### Redis Adapter Setup
```typescript
// Install package
// npm install @socket.io/redis-adapter redis

// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Redis adapter cho WebSocket scaling
  const pubClient = createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
  });
  
  const subClient = pubClient.duplicate();

  await Promise.all([
    pubClient.connect(),
    subClient.connect(),
  ]);

  // Apply adapter to Socket.IO server
  const socketServer = app.get('SOCKET_SERVER');
  socketServer.adapter(createAdapter(pubClient, subClient));

  await app.listen(3000);
}
bootstrap();
```

### Redis Service cho WebSocket State
```typescript
// redis/redis-websocket.service.ts
import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class RedisWebSocketService {
  constructor(private redisService: RedisService) {}

  // Store user online status
  async setUserOnline(userId: string, socketId: string): Promise<void> {
    await this.redisService.set(`user:online:${userId}`, socketId, 24 * 60 * 60); // 24h TTL
    await this.redisService.sadd('online_users', userId);
  }

  async setUserOffline(userId: string): Promise<void> {
    await this.redisService.del(`user:online:${userId}`);
    await this.redisService.srem('online_users', userId);
  }

  async isUserOnline(userId: string): Promise<boolean> {
    return this.redisService.exists(`user:online:${userId}`);
  }

  async getOnlineUsers(): Promise<string[]> {
    return this.redisService.smembers('online_users');
  }

  // Store typing status
  async setUserTyping(conversationId: string, userId: string): Promise<void> {
    await this.redisService.setex(`typing:${conversationId}:${userId}`, 10, 'true'); // 10s TTL
  }

  async removeUserTyping(conversationId: string, userId: string): Promise<void> {
    await this.redisService.del(`typing:${conversationId}:${userId}`);
  }

  async getTypingUsers(conversationId: string): Promise<string[]> {
    const keys = await this.redisService.keys(`typing:${conversationId}:*`);
    return keys.map(key => key.split(':')[2]);
  }

  // Store message delivery status
  async setMessageDelivered(messageId: string, userId: string): Promise<void> {
    await this.redisService.sadd(`delivered:${messageId}`, userId);
  }

  async setMessageRead(messageId: string, userId: string): Promise<void> {
    await this.redisService.sadd(`read:${messageId}`, userId);
  }

  // Cache conversation participants
  async cacheConversationParticipants(conversationId: string, participantIds: string[]): Promise<void> {
    await this.redisService.sadd(`conversation:${conversationId}:participants`, ...participantIds);
    await this.redisService.expire(`conversation:${conversationId}:participants`, 60 * 60); // 1h TTL
  }

  async getConversationParticipants(conversationId: string): Promise<string[]> {
    return this.redisService.smembers(`conversation:${conversationId}:participants`);
  }
}
```

---

## 5. File Upload cho Messages

### File Upload Service
```typescript
// upload/upload.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import * as multer from 'multer';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private s3: AWS.S3;

  constructor(private configService: ConfigService) {
    this.s3 = new AWS.S3({
      accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      region: this.configService.get('AWS_REGION'),
    });
  }

  // Upload file to S3
  async uploadFile(file: Express.Multer.File, userId: string): Promise<{
    url: string;
    key: string;
    size: number;
    mimeType: string;
  }> {
    // Validate file
    this.validateFile(file);

    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const key = `chat-uploads/${userId}/${fileName}`;

    try {
      const uploadResult = await this.s3.upload({
        Bucket: this.configService.get('AWS_S3_BUCKET'),
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentDisposition: 'inline',
        CacheControl: 'max-age=31536000', // 1 year
      }).promise();

      return {
        url: uploadResult.Location,
        key: key,
        size: file.size,
        mimeType: file.mimetype,
      };
    } catch (error) {
      throw new BadRequestException('Failed to upload file');
    }
  }

  // Upload voice message
  async uploadVoiceMessage(file: Express.Multer.File, userId: string, duration: number): Promise<{
    url: string;
    key: string;
    size: number;
    duration: number;
  }> {
    // Validate voice file
    if (!file.mimetype.startsWith('audio/')) {
      throw new BadRequestException('File must be an audio file');
    }

    const result = await this.uploadFile(file, userId);
    
    return {
      ...result,
      duration,
    };
  }

  // Validate uploaded file
  private validateFile(file: Express.Multer.File): void {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'video/mp4',
      'video/webm',
    ];

    if (file.size > maxSize) {
      throw new BadRequestException('File size must be less than 50MB');
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }
  }

  // Delete file from S3
  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3.deleteObject({
        Bucket: this.configService.get('AWS_S3_BUCKET'),
        Key: key,
      }).promise();
    } catch (error) {
      // Log error but don't throw - file might already be deleted
      console.error('Failed to delete file:', error);
    }
  }

  // Generate presigned URL for direct upload
  async generatePresignedUrl(fileName: string, mimeType: string, userId: string): Promise<{
    uploadUrl: string;
    key: string;
    expires: number;
  }> {
    const fileExtension = path.extname(fileName);
    const key = `chat-uploads/${userId}/${uuidv4()}${fileExtension}`;
    const expires = 60 * 15; // 15 minutes

    const uploadUrl = this.s3.getSignedUrl('putObject', {
      Bucket: this.configService.get('AWS_S3_BUCKET'),
      Key: key,
      ContentType: mimeType,
      Expires: expires,
    });

    return {
      uploadUrl,
      key,
      expires,
    };
  }
}
```

### File Upload Controller
```typescript
// upload/upload.controller.ts
import { 
  Controller, 
  Post, 
  UseInterceptors, 
  UploadedFile, 
  UseGuards,
  Body,
  BadRequestException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/decorators/user.decorator';
import { UploadService } from './upload.service';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post('file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @User('id') userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.uploadService.uploadFile(file, userId);
  }

  @Post('voice')
  @UseInterceptors(FileInterceptor('voice'))
  async uploadVoice(
    @UploadedFile() file: Express.Multer.File,
    @Body('duration') duration: string,
    @User('id') userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No voice file uploaded');
    }

    const durationSeconds = parseFloat(duration);
    if (isNaN(durationSeconds) || durationSeconds <= 0) {
      throw new BadRequestException('Invalid duration');
    }

    return this.uploadService.uploadVoiceMessage(file, userId, durationSeconds);
  }

  @Post('presigned-url')
  async generatePresignedUrl(
    @Body() body: { fileName: string; mimeType: string },
    @User('id') userId: string,
  ) {
    return this.uploadService.generatePresignedUrl(
      body.fileName,
      body.mimeType,
      userId,
    );
  }
}
```

---

## 6. Real-time Events Reference

### Client-side Event Handling
```typescript
// Frontend (React/Vue/Angular) example
import { io, Socket } from 'socket.io-client';

class ChatSocketService {
  private socket: Socket;

  connect(token: string) {
    this.socket = io('ws://localhost:3000/chat', {
      auth: { token },
      transports: ['websocket'],
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to chat server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from chat server');
    });

    // Message events
    this.socket.on('newMessage', (data) => {
      this.handleNewMessage(data);
    });

    this.socket.on('messageRead', (data) => {
      this.handleMessageRead(data);
    });

    // Typing events
    this.socket.on('userTyping', (data) => {
      this.handleUserTyping(data);
    });

    // User status events
    this.socket.on('userOnline', (data) => {
      this.handleUserOnline(data);
    });

    this.socket.on('userOffline', (data) => {
      this.handleUserOffline(data);
    });

    // Conversation events
    this.socket.on('newConversation', (data) => {
      this.handleNewConversation(data);
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  // Send message
  sendMessage(conversationId: string, content: string, messageType: string = 'text') {
    this.socket.emit('sendMessage', {
      conversationId,
      content,
      messageType,
    });
  }

  // Send typing indicator
  sendTyping(conversationId: string, isTyping: boolean) {
    this.socket.emit('typing', {
      conversationId,
      isTyping,
    });
  }

  // Mark message as read
  markAsRead(conversationId: string, messageId: string) {
    this.socket.emit('markAsRead', {
      conversationId,
      messageId,
    });
  }

  // Join conversation
  joinConversation(conversationId: string) {
    this.socket.emit('joinConversation', { conversationId });
  }

  // Leave conversation
  leaveConversation(conversationId: string) {
    this.socket.emit('leaveConversation', { conversationId });
  }

  // Create conversation
  createConversation(name: string, type: 'private' | 'group', participantIds: string[]) {
    this.socket.emit('createConversation', {
      name,
      type,
      participantIds,
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  private handleNewMessage(data: any) {
    // Update UI với message mới
    console.log('New message:', data);
  }

  private handleMessageRead(data: any) {
    // Update read status
    console.log('Message read:', data);
  }

  private handleUserTyping(data: any) {
    // Show typing indicator
    console.log('User typing:', data);
  }

  private handleUserOnline(data: any) {
    // Update user online status
    console.log('User online:', data);
  }

  private handleUserOffline(data: any) {
    // Update user offline status
    console.log('User offline:', data);
  }

  private handleNewConversation(data: any) {
    // Add new conversation to list
    console.log('New conversation:', data);
  }
}

export default ChatSocketService;
```

---

## 7. Testing WebSocket

### WebSocket Testing Setup
```typescript
// Install packages
// npm install -D socket.io-client @types/socket.io-client

// test/websocket/chat.gateway.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Socket, io } from 'socket.io-client';
import { AppModule } from '../src/app.module';

describe('ChatGateway (e2e)', () => {
  let app: INestApplication;
  let clientSocket: Socket;
  let serverAddress: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0); // Random port

    const server = app.getHttpServer();
    const address = server.address();
    serverAddress = `http://localhost:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach((done) => {
    // Create client socket
    clientSocket = io(`${serverAddress}/chat`, {
      auth: { token: 'valid-jwt-token' },
      transports: ['websocket'],
    });

    clientSocket.on('connect', done);
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Connection', () => {
    it('should connect successfully with valid token', (done) => {
      expect(clientSocket.connected).toBe(true);
      done();
    });

    it('should disconnect with invalid token', (done) => {
      const invalidClient = io(`${serverAddress}/chat`, {
        auth: { token: 'invalid-token' },
        transports: ['websocket'],
      });

      invalidClient.on('disconnect', () => {
        expect(invalidClient.connected).toBe(false);
        done();
      });
    });
  });

  describe('Send Message', () => {
    it('should send and receive message', (done) => {
      const messageData = {
        conversationId: 'test-conversation-id',
        content: 'Test message',
        messageType: 'text',
      };

      // Listen for new message
      clientSocket.on('newMessage', (data) => {
        expect(data.message.content).toBe(messageData.content);
        done();
      });

      // Send message
      clientSocket.emit('sendMessage', messageData);
    });

    it('should handle message validation errors', (done) => {
      // Send invalid message
      clientSocket.emit('sendMessage', {
        conversationId: '', // Invalid
        content: '',
      });

      clientSocket.on('error', (error) => {
        expect(error.message).toBeDefined();
        done();
      });
    });
  });

  describe('Typing Indicator', () => {
    it('should broadcast typing status', (done) => {
      const typingData = {
        conversationId: 'test-conversation-id',
        isTyping: true,
      };

      clientSocket.on('userTyping', (data) => {
        expect(data.isTyping).toBe(true);
        expect(data.conversationId).toBe(typingData.conversationId);
        done();
      });

      clientSocket.emit('typing', typingData);
    });
  });

  describe('Join/Leave Conversation', () => {
    it('should join conversation successfully', (done) => {
      const conversationId = 'test-conversation-id';

      clientSocket.on('joinedConversation', (data) => {
        expect(data.conversationId).toBe(conversationId);
        done();
      });

      clientSocket.emit('joinConversation', { conversationId });
    });

    it('should leave conversation successfully', (done) => {
      const conversationId = 'test-conversation-id';

      clientSocket.on('leftConversation', (data) => {
        expect(data.conversationId).toBe(conversationId);
        done();
      });

      clientSocket.emit('leaveConversation', { conversationId });
    });
  });
});
```

### Performance Testing
```typescript
// test/performance/websocket-load.test.ts
import { io, Socket } from 'socket.io-client';

describe('WebSocket Load Testing', () => {
  const SERVER_URL = 'http://localhost:3000/chat';
  const NUM_CLIENTS = 100;
  const MESSAGES_PER_CLIENT = 10;
  
  let clients: Socket[] = [];

  beforeAll(() => {
    // Setup multiple clients
    for (let i = 0; i < NUM_CLIENTS; i++) {
      const client = io(SERVER_URL, {
        auth: { token: `test-token-${i}` },
        transports: ['websocket'],
      });
      clients.push(client);
    }
  });

  afterAll(() => {
    // Cleanup
    clients.forEach(client => client.disconnect());
  });

  it('should handle multiple concurrent connections', async () => {
    const connections = await Promise.all(
      clients.map(client => 
        new Promise((resolve) => {
          client.on('connect', resolve);
        })
      )
    );

    expect(connections).toHaveLength(NUM_CLIENTS);
  });

  it('should handle message broadcasting load', async () => {
    const conversationId = 'load-test-conversation';
    let messagesReceived = 0;
    const totalMessages = NUM_CLIENTS * MESSAGES_PER_CLIENT;

    // Setup message listeners
    clients.forEach(client => {
      client.on('newMessage', () => {
        messagesReceived++;
      });
    });

    // Send messages concurrently
    const messagePromises = clients.map((client, index) => {
      return Promise.all(
        Array.from({ length: MESSAGES_PER_CLIENT }, (_, msgIndex) =>
          new Promise((resolve) => {
            client.emit('sendMessage', {
              conversationId,
              content: `Message ${msgIndex} from client ${index}`,
              messageType: 'text',
            });
            resolve(true);
          })
        )
      );
    });

    await Promise.all(messagePromises);

    // Wait for all messages to be received
    await new Promise((resolve) => {
      const checkMessages = () => {
        if (messagesReceived >= totalMessages) {
          resolve(true);
        } else {
          setTimeout(checkMessages, 100);
        }
      };
      checkMessages();
    });

    expect(messagesReceived).toBeGreaterThanOrEqual(totalMessages);
  }, 30000); // 30 second timeout
});
```

---

**Kết luận**: WebSocket enables true real-time communication trong chat app. Socket.IO provides robust WebSocket với fallback mechanisms. Redis adapter allows horizontal scaling across multiple servers. Proper authentication, error handling, và performance testing đảm bảo production-ready chat system.

**Tiếp theo: Testing & Quality Assurance strategies**
