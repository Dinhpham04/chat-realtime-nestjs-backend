import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, UseGuards } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { SocketAuthService } from '../services/socket-auth.service';
import { MessageQueueService } from '../services/message-queue.service';
import { MessageOptimizationService } from '../services/message-optimization.service';
import { DeviceSyncService } from '../services/device-sync.service';
import { MessagesService } from '../../modules/messages/services/messages.service';
import { UserContext } from '../../modules/messages/interfaces/message-service.interface';
import { CreateMessageDto, MessageResponseDto } from '../../modules/messages/dto';

// Socket.IO Event DTOs
interface SendMessageDto {
    localId: string;
    conversationId: string;
    content: string;
    type: 'text' | 'image' | 'file' | 'audio' | 'video';
    timestamp: number;
}

interface DeliveryDto {
    messageId: string;
    conversationId: string;
    userId: string;
    deliveredAt: number;
}

interface ReadReceiptDto {
    conversationId: string;
    messageIds: string[];
    userId: string;
    readAt: number;
}

interface JoinConversationsDto {
    conversationIds: string[];
}

interface AuthDto {
    token: string;
    deviceId: string;
    deviceType: 'mobile' | 'web' | 'desktop';
    platform: 'ios' | 'android' | 'web' | 'windows' | 'mac';
}

@Injectable()
@WebSocketGateway({
    namespace: '/chat',
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'], // Fallback support like Zalo
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(ChatGateway.name);

    // Connected users tracking
    private readonly connectedUsers = new Map<string, Set<string>>(); // userId -> Set<socketId>
    private readonly socketToUser = new Map<string, string>(); // socketId -> userId
    private readonly socketToDevice = new Map<string, any>(); // socketId -> deviceInfo

    constructor(
        private readonly socketAuthService: SocketAuthService,
        private readonly messageQueueService: MessageQueueService,
        private readonly optimizationService: MessageOptimizationService,
        private readonly deviceSyncService: DeviceSyncService,
        private readonly messagesService: MessagesService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    // Auto-handled connection event
    async handleConnection(client: Socket) {
        this.logger.log(`Client attempting to connect: ${client.id}`);

        try {
            // Get auth data from handshake
            const authData = client.handshake.auth as AuthDto;

            if (!authData?.token) {
                this.logger.warn(`No auth token provided for socket ${client.id}`);
                client.disconnect();
                return;
            }

            // Authenticate user using Auth Service
            const user = await this.socketAuthService.authenticateSocket(authData.token);
            if (!user) {
                this.logger.warn(`Authentication failed for socket ${client.id}`);
                client.disconnect();
                return;
            }

            // Store connection info
            this.socketToUser.set(client.id, user.userId);
            this.socketToDevice.set(client.id, {
                deviceId: authData.deviceId,
                deviceType: authData.deviceType,
                platform: authData.platform,
                userId: user.userId,
                socketId: client.id,
            });

            // Register device connection in Redis
            await this.socketAuthService.registerDeviceConnection({
                deviceId: authData.deviceId,
                deviceType: authData.deviceType,
                platform: authData.platform,
                userId: user.userId,
                socketId: client.id,
            });

            // Track user connections
            if (!this.connectedUsers.has(user.userId)) {
                this.connectedUsers.set(user.userId, new Set());
            }
            this.connectedUsers.get(user.userId)!.add(client.id);

            // Join user to personal room
            await client.join(`user:${user.userId}`);

            // Join user's conversations
            const conversations = await this.getUserConversations(user.userId);
            for (const conv of conversations) {
                await client.join(`conversation:${conv.id}`);
            }

            // Deliver offline messages
            await this.messageQueueService.deliverQueuedMessages(user.userId, client);

            // Sync device state
            await this.deviceSyncService.syncDeviceOnConnect(user.userId, authData.deviceId, client);

            this.logger.log(`User ${user.userId} connected from ${authData.deviceType} (${client.id})`);

        } catch (error) {
            this.logger.error(`Connection error for socket ${client.id}:`, error);
            client.disconnect();
        }
    }

    // Auto-handled disconnection
    async handleDisconnect(client: Socket) {
        const userId = this.socketToUser.get(client.id);
        const deviceInfo = this.socketToDevice.get(client.id);

        if (userId) {
            // Remove from tracking
            this.connectedUsers.get(userId)?.delete(client.id);
            if (this.connectedUsers.get(userId)?.size === 0) {
                this.connectedUsers.delete(userId);
            }

            // Unregister device connection from Redis
            if (deviceInfo) {
                await this.socketAuthService.unregisterDeviceConnection(
                    deviceInfo.deviceId,
                    userId
                );
            }
        }

        // Cleanup
        this.socketToUser.delete(client.id);
        this.socketToDevice.delete(client.id);

        this.logger.log(`Client disconnected: ${client.id} ${userId ? `(user: ${userId})` : ''}`);
    }

    @SubscribeMessage('send_message')
    async handleSendMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: SendMessageDto,
    ) {
        const startTime = Date.now();

        try {
            const userId = this.socketToUser.get(client.id);
            const deviceInfo = this.socketToDevice.get(client.id);

            if (!userId || !deviceInfo) {
                throw new Error('User not authenticated');
            }

            // Create user context for service (simplified without conversationMemberships)
            const userContext: UserContext = {
                userId: userId,
                deviceId: deviceInfo.deviceId,
                roles: ['user'] // TODO: Get from user info
            };

            // Convert Socket.IO DTO to Messages Service DTO
            const createMessageDto: CreateMessageDto = {
                localId: data.localId,
                conversationId: data.conversationId,
                content: data.content,
                type: data.type as any, // Convert to MessageType enum
                attachments: [], // TODO: Add attachment support
                mentions: [] // TODO: Add mention support
            };

            // Send immediate acknowledgment to sender
            client.emit('message_received', {
                localId: data.localId,
                serverId: 'pending',
                timestamp: Date.now(),
                status: 'received',
                processingTime: Date.now() - startTime,
            });

            // Use Messages Service to create message
            const message = await this.messagesService.sendMessage(createMessageDto, userContext);

            // Update acknowledgment with real server ID
            client.emit('message_received', {
                localId: data.localId,
                serverId: message.id,
                timestamp: message.createdAt,
                status: 'processed',
                processingTime: Date.now() - startTime,
            });

            // Broadcast to conversation participants
            this.server.to(`conversation:${data.conversationId}`).emit('new_message', {
                id: message.id,
                conversationId: message.conversationId,
                senderId: message.senderId,
                senderName: 'User', // TODO: Get from user service
                content: message.content,
                messageType: message.type,
                timestamp: message.createdAt,
                localId: data.localId // Echo back for sender
            });

            this.logger.log(`Message sent: ${message.id} by ${userId} to conversation ${data.conversationId}`);

        } catch (error) {
            this.logger.error(`Send message error for socket ${client.id}:`, error);

            // Notify sender of error
            client.emit('message_error', {
                localId: data.localId,
                error: error.message,
                status: 'failed',
                processingTime: Date.now() - startTime,
            });
        }
    }

    @SubscribeMessage('message_delivered')
    async handleMessageDelivered(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: DeliveryDto,
    ) {
        try {
            const userId = this.socketToUser.get(client.id);
            if (!userId) return;

            // Add to delivery batch (optimization)
            await this.optimizationService.addDeliveryUpdate(data.conversationId, {
                messageId: data.messageId,
                userId: userId,
                status: 'delivered',
                timestamp: data.deliveredAt,
            });

        } catch (error) {
            this.logger.error(`Delivery update error:`, error);
        }
    }

    @SubscribeMessage('mark_as_read')
    async handleMarkAsRead(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: ReadReceiptDto,
    ) {
        try {
            const userId = this.socketToUser.get(client.id);
            const deviceInfo = this.socketToDevice.get(client.id);

            if (!userId || !deviceInfo) return;

            // Update read status in database
            await this.updateMessagesReadStatus(data.messageIds, userId, data.readAt);

            // Sync to other devices of same user
            await this.deviceSyncService.syncReadStatusToOtherDevices(
                userId,
                deviceInfo.deviceId,
                data.messageIds,
                data.readAt,
            );

            // Add to read receipt batch
            await this.optimizationService.addReadReceipt(
                data.conversationId,
                data.messageIds,
                userId,
            );

        } catch (error) {
            this.logger.error(`Read receipt error:`, error);
        }
    }

    @SubscribeMessage('join_conversations')
    async handleJoinConversations(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: JoinConversationsDto,
    ) {
        try {
            const userId = this.socketToUser.get(client.id);
            if (!userId) return;

            for (const convId of data.conversationIds) {
                // Verify permission
                const hasPermission = await this.checkConversationPermission(userId, convId);
                if (hasPermission) {
                    await client.join(`conversation:${convId}`);
                }
            }

        } catch (error) {
            this.logger.error(`Join conversations error:`, error);
        }
    }

    @SubscribeMessage('leave_conversations')
    async handleLeaveConversations(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: JoinConversationsDto,
    ) {
        try {
            for (const convId of data.conversationIds) {
                await client.leave(`conversation:${convId}`);
            }
        } catch (error) {
            this.logger.error(`Leave conversations error:`, error);
        }
    }

    // Helper methods
    async getUserConversations(userId: string): Promise<any[]> {
        // TODO: Implement with ConversationsService
        return [];
    }

    async getUserConversationIds(userId: string): Promise<string[]> {
        // TODO: Implement with ConversationsService
        return ['conv_123', 'conv_456']; // Mock data for now
    }

    async checkConversationPermission(userId: string, conversationId: string): Promise<boolean> {
        // TODO: Implement permission check
        return true;
    }

    async generateMessageId(): Promise<string> {
        // TODO: Implement message ID generation
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async createMessageInDB(data: any): Promise<any> {
        // TODO: Implement with MessagesService
        return data;
    }

    async getConversationParticipants(conversationId: string): Promise<string[]> {
        // TODO: Implement with ConversationsService
        return [];
    }

    async updateDeliveryStatusForOnlineUsers(messageId: string, participants: string[]): Promise<void> {
        // TODO: Implement delivery status update
    }

    async updateMessagesReadStatus(messageIds: string[], userId: string, readAt: number): Promise<void> {
        // TODO: Implement read status update
    }

    // ================= EVENT HANDLERS FOR OPTIMIZATION SERVICE =================

    /**
     * Handle delivery updates batch from MessageOptimizationService
     */
    @OnEvent('delivery.updates.batch')
    handleDeliveryUpdatesBatch(payload: {
        conversationId: string;
        updates: Array<{ messageId: string; userId: string; status: string; timestamp: number }>;
        timestamp: number;
    }): void {
        try {
            this.server.to(`conversation:${payload.conversationId}`).emit('delivery_updates_batch', {
                updates: payload.updates,
                timestamp: payload.timestamp
            });

            this.logger.log(`Broadcasted ${payload.updates.length} delivery updates to conversation ${payload.conversationId}`);
        } catch (error) {
            this.logger.error('Failed to broadcast delivery updates batch:', error);
        }
    }

    /**
     * Handle read receipts batch from MessageOptimizationService
     */
    @OnEvent('read.receipts.batch')
    handleReadReceiptsBatch(payload: {
        conversationId: string;
        userId: string;
        messageIds: string[];
        timestamp: number;
    }): void {
        try {
            this.server.to(`conversation:${payload.conversationId}`).emit('read_receipts_batch', {
                userId: payload.userId,
                messageIds: payload.messageIds,
                timestamp: payload.timestamp
            });

            this.logger.log(`Broadcasted ${payload.messageIds.length} read receipts for user ${payload.userId} in conversation ${payload.conversationId}`);
        } catch (error) {
            this.logger.error('Failed to broadcast read receipts batch:', error);
        }
    }

    /**
     * Handle compressed message sending from MessageOptimizationService
     */
    @OnEvent('message.compressed.send')
    handleCompressedMessage(payload: {
        roomName: string;
        event: string;
        data: any;
        compressed: boolean;
        timestamp: number;
    }): void {
        try {
            if (payload.compressed) {
                this.server.to(payload.roomName).compress(true).emit(payload.event, payload.data);
            } else {
                this.server.to(payload.roomName).emit(payload.event, payload.data);
            }

            this.logger.log(`Sent ${payload.compressed ? 'compressed' : 'regular'} message to room ${payload.roomName}`);
        } catch (error) {
            this.logger.error('Failed to send compressed message:', error);
        }
    }

    /**
     * Handle room optimization from MessageOptimizationService
     */
    @OnEvent('rooms.optimize')
    handleRoomOptimization(payload: {
        timestamp: number;
        cleanupEmptyRooms: boolean;
        patterns: string[];
    }): void {
        try {
            if (!payload.cleanupEmptyRooms) return;

            const rooms = this.server.sockets.adapter.rooms;
            let cleanedCount = 0;

            for (const [roomName, room] of rooms) {
                // Check if room matches patterns and is empty
                const matchesPattern = payload.patterns.some(pattern => roomName.startsWith(pattern));

                if (matchesPattern && room.size === 0) {
                    // Note: Socket.IO automatically cleans empty rooms, but we can log for monitoring
                    this.logger.debug(`Empty room detected for cleanup: ${roomName}`);
                    cleanedCount++;
                }
            }

            this.logger.log(`Room optimization completed: ${cleanedCount} empty rooms detected`);
        } catch (error) {
            this.logger.error('Failed to optimize rooms:', error);
        }
    }

    /**
     * Handle device read sync from DeviceSyncService
     */
    @OnEvent('device.read.sync')
    handleDeviceReadSync(payload: {
        socketId: string;
        messageIds: string[];
        readAt: number;
        syncedFrom: string;
        targetDeviceId: string;
    }): void {
        try {
            this.server.to(payload.socketId).emit('messages_read_sync', {
                messageIds: payload.messageIds,
                readAt: payload.readAt,
                syncedFrom: payload.syncedFrom,
                timestamp: Date.now()
            });

            this.logger.log(`Synced read status for ${payload.messageIds.length} messages to device ${payload.targetDeviceId}`);
        } catch (error) {
            this.logger.error('Failed to sync read status to device:', error);
        }
    }    // Public methods for other services
    sendToUser(userId: string, event: string, data: any): void {
        this.server.to(`user:${userId}`).emit(event, data);
    }

    sendToConversation(conversationId: string, event: string, data: any): void {
        this.server.to(`conversation:${conversationId}`).emit(event, data);
    }

    isUserOnline(userId: string): boolean {
        return this.connectedUsers.has(userId);
    }

    getUserSocketCount(userId: string): number {
        return this.connectedUsers.get(userId)?.size || 0;
    }
}
