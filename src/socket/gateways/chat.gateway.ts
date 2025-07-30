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
import { Inject, Injectable, Logger, UseGuards, forwardRef } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { SocketAuthService } from '../services/socket-auth.service';
import { MessageQueueService } from '../services/message-queue.service';
import { MessageOptimizationService } from '../services/message-optimization.service';
import { DeviceSyncService } from '../services/device-sync.service';
import { MessagesService } from '../../modules/messages/services/messages.service';
import { FilesService } from '../../modules/files/services/files.service';
import { ConversationsService } from '../../modules/conversations/services/conversations.service';
import { UsersService } from '../../modules/users/services/users.service';
import { UserContext } from '../../modules/messages/interfaces/message-service.interface';
import { CreateMessageDto, MessageResponseDto } from '../../modules/messages/dto';

// Constants for configuration
const DEFAULT_MESSAGE_TIMEOUT = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 3;
const DELIVERY_BATCH_SIZE = 50;

// Error constants
const ERROR_MESSAGES = {
    USER_NOT_AUTHENTICATED: 'User not authenticated',
    FILE_NOT_FOUND: 'File not found or access denied',
    INVALID_FILE_METADATA: 'Invalid file metadata',
    CONVERSATION_NOT_FOUND: 'Conversation not found',
    INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
    MESSAGE_PROCESSING_FAILED: 'Message processing failed',
} as const;

// Socket.IO Event DTOs
interface SendMessageDto {
    localId: string;
    conversationId: string;
    content: string;
    type: 'text' | 'image' | 'file' | 'audio' | 'video' | 'document';
    timestamp: number;

    // Option 1: Send fileId only (Secure, recommended)
    fileId?: string;

    // Option 2: Send complete metadata (Performance, less secure)
    fileMetadata?: {
        fileId: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
        downloadUrl: string;
        thumbnailUrl?: string;
        duration?: number; // For audio/video files
        dimensions?: { width: number; height: number }; // For images/videos
    };

    // Option 3: Multiple files support
    fileIds?: string[]; // For batch file approach (secure)
    filesMetadata?: Array<{
        fileId: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
        downloadUrl: string;
        thumbnailUrl?: string;
        duration?: number;
        dimensions?: { width: number; height: number };
    }>; // For batch files with metadata (performance)
}

interface BatchShareFilesDto {
    fileIds: string[];
    conversationId: string;
    message?: string;
    filesMetadata?: Array<{
        fileId: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
        downloadUrl: string;
        thumbnailUrl?: string;
        duration?: number;
        dimensions?: { width: number; height: number };
    }>;
}

interface QuickShareFileDto {
    fileId: string;
    conversationId: string;
    message?: string;
    fileMetadata: {
        fileName: string;
        fileSize: number;
        mimeType: string;
        downloadUrl: string;
        thumbnailUrl?: string;
        duration?: number;
        dimensions?: { width: number; height: number };
    };
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

interface ShareFileDto {
    fileId: string;
    conversationId: string;
    message?: string;
}

interface AuthDto {
    token: string;
    deviceId: string;
    deviceType: 'mobile' | 'web' | 'desktop';
    platform: 'ios' | 'android' | 'web' | 'windows' | 'mac';
}

/**
 * Chat Gateway - Real-time messaging with Socket.IO
 * 
 * Handles WebSocket connections, message broadcasting, file sharing,
 * and real-time communication features for the chat application.
 * 
 * Features:
 * - User authentication and authorization
 * - Real-time message broadcasting
 * - File sharing (single and batch)
 * - Message delivery and read receipts
 * - Device synchronization
 * - Conversation room management
 * 
 * @class ChatGateway
 * @implements {OnGatewayConnection, OnGatewayDisconnect}
 */
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
        private readonly filesService: FilesService,
        private readonly conversationsService: ConversationsService,
        private readonly usersService: UsersService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    /**
     * Handle client connection
     * 
     * Authenticates user, joins conversation rooms, delivers offline messages,
     * and syncs device state upon successful connection.
     * 
     * @param client - Socket client instance
     */
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
            this.logger.debug(`user conversations found`, conversations);
            this.logger.log(`User ${user.userId} joining ${conversations.length} conversations`);

            for (const conv of conversations) {
                await client.join(`conversation:${conv.id}`);
                this.logger.log(`User ${user.userId} joined conversation room: conversation:${conv.id}`);
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

    /**
     * Handle client disconnection
     * 
     * Cleans up user tracking, unregisters device connections,
     * and performs necessary cleanup operations.
     * 
     * @param client - Socket client instance
     */
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

    /**
     * Handle send message event
     * 
     * Processes text and file messages, validates permissions,
     * saves to database, and broadcasts to conversation participants.
     * Supports single files, multiple files, and batch operations.
     * 
     * @param client - Socket client instance  
     * @param data - Message data with content, type, and optional file information
     */
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

            // Create user context for service
            const userContext: UserContext = {
                userId: userId,
                deviceId: deviceInfo.deviceId,
                roles: await this.getUserRoles(userId)
            };

            this.logger.debug(`userContext`, userContext)

            // Convert Socket.IO DTO to Messages Service DTO
            const createMessageDto: CreateMessageDto = {
                localId: data.localId,
                conversationId: data.conversationId,
                content: data.content,
                type: data.type as any, // Convert to MessageType enum
                attachments: [], // TODO: Add attachment support
                mentions: [], // TODO: Add mention support
            };

            // Handle file messages - Support single and multiple files
            let filesMetadata: Array<any> = [];

            if (data.type !== 'text') {
                // Single file handling
                if (data.fileId) {
                    // Approach 1: Secure - Backend queries metadata for single file
                    const fileDetails = await this.filesService.getFile(data.fileId, userId);
                    if (!fileDetails) {
                        throw new Error('File not found or access denied');
                    }

                    const singleFileMetadata = {
                        fileId: data.fileId,
                        fileName: fileDetails.fileName,
                        fileSize: fileDetails.fileSize,
                        mimeType: fileDetails.mimeType,
                        downloadUrl: await this.filesService.generateDownloadUrl(
                            data.fileId,
                            userId,
                            { expiresIn: 24 * 60 * 60 }
                        ),
                        thumbnailUrl: fileDetails.thumbnailPath ? await this.filesService.generateDownloadUrl(
                            data.fileId,
                            userId,
                            { expiresIn: 24 * 60 * 60 }
                        ).then(url => `${url}&thumbnail=true`) : undefined,
                    };
                    filesMetadata = [singleFileMetadata];

                } else if (data.fileMetadata && this.validateFileMetadata(data.fileMetadata)) {
                    // Approach 2: Performance - Use provided metadata for single file
                    const hasAccess = await this.filesService.checkFileAccess(data.fileMetadata.fileId, userId);
                    if (!hasAccess) {
                        throw new Error('File not found or access denied');
                    }
                    filesMetadata = [data.fileMetadata];

                } else if (data.fileIds && data.fileIds.length > 0) {
                    // Approach 3: Batch files - Backend queries metadata for multiple files
                    for (const fileId of data.fileIds) {
                        const fileDetails = await this.filesService.getFile(fileId, userId);
                        if (!fileDetails) {
                            throw new Error(`File ${fileId} not found or access denied`);
                        }

                        const fileMetadata = {
                            fileId: fileId,
                            fileName: fileDetails.fileName,
                            fileSize: fileDetails.fileSize,
                            mimeType: fileDetails.mimeType,
                            downloadUrl: await this.filesService.generateDownloadUrl(
                                fileId,
                                userId,
                                { expiresIn: 24 * 60 * 60 }
                            ),
                            thumbnailUrl: fileDetails.thumbnailPath ? await this.filesService.generateDownloadUrl(
                                fileId,
                                userId,
                                { expiresIn: 24 * 60 * 60 }
                            ).then(url => `${url}&thumbnail=true`) : undefined,
                        };
                        filesMetadata.push(fileMetadata);
                    }

                } else if (data.filesMetadata && data.filesMetadata.length > 0) {
                    // Approach 4: Batch files with metadata - Performance approach
                    for (const fileMetadata of data.filesMetadata) {
                        if (!this.validateFileMetadata(fileMetadata)) {
                            throw new Error(`Invalid metadata for file ${fileMetadata.fileId}`);
                        }

                        const hasAccess = await this.filesService.checkFileAccess(fileMetadata.fileId, userId);
                        if (!hasAccess) {
                            throw new Error(`File ${fileMetadata.fileId} not found or access denied`);
                        }
                    }
                    filesMetadata = data.filesMetadata;
                } else {
                    throw new Error('File information required for file messages');
                }

                // Add file attachments to message
                createMessageDto.attachments = filesMetadata.map(fileMetadata => ({
                    fileId: fileMetadata.fileId,
                    fileName: fileMetadata.fileName,
                    fileSize: fileMetadata.fileSize,
                    mimeType: fileMetadata.mimeType,
                }));

                // Update content with file info if empty
                if (!data.content || data.content.trim() === '') {
                    if (filesMetadata.length === 1) {
                        // Single file
                        createMessageDto.content = this.generateFileContentMessage(
                            data.type,
                            filesMetadata[0].fileName
                        );
                    } else {
                        // Multiple files
                        createMessageDto.content = this.generateBatchFileContentMessage(
                            filesMetadata.length,
                            filesMetadata.map(f => f.fileName)
                        );
                    }
                }
            }

            this.logger.debug(`data will be send: `, createMessageDto);

            // Send immediate acknowledgment to sender
            client.emit('message_received', {
                localId: data.localId,
                serverId: 'pending',
                timestamp: Date.now(),
                status: 'received',
                processingTime: Date.now() - startTime,
            });

            this.logger.log(`Processing message from user ${userId} to conversation ${data.conversationId}`);

            // Use Messages Service to create message
            const message = await this.messagesService.sendMessage(createMessageDto, userContext);

            this.logger.log(`Message created successfully`, message);

            // Update acknowledgment with real server ID and message content
            client.emit('message_received', {
                localId: data.localId,
                serverId: message.id,
                content: message.content,
                messageType: message.type,
                timestamp: message.createdAt,
                status: 'processed',
                processingTime: Date.now() - startTime,
                // Include file info if present for sender's UI
                filesInfo: filesMetadata.length > 0 ? filesMetadata.map(file => ({
                    id: file.fileId,
                    fileName: file.fileName,
                    fileSize: file.fileSize,
                    mimeType: file.mimeType,
                    downloadUrl: file.downloadUrl,
                    thumbnailUrl: file.thumbnailUrl,
                    duration: file.duration,
                    dimensions: file.dimensions,
                })) : undefined,
            });

            // Broadcast to conversation participants
            const senderName = await this.getUserDisplayName(userId);
            const messageData: any = {
                id: message.id,
                conversationId: message.conversationId,
                senderId: message.senderId,
                senderName: senderName,
                content: message.content,
                messageType: message.type,
                timestamp: message.createdAt,
                localId: data.localId, // Echo back for sender
            };


            // Debug: Check room information
            const roomName = `conversation:${data.conversationId}`;
            const room = this.server?.sockets?.adapter?.rooms?.get(roomName);
            const roomSize = room ? room.size : 0;
            this.logger.log(`Broadcasting to room ${roomName} with ${roomSize} connected sockets`);

            if (room) {
                const socketIds = Array.from(room);
                this.logger.log(`Socket IDs in room: ${socketIds.join(', ')}`);
            } else {
                this.logger.warn(`Room ${roomName} not found or adapter not ready`);
            }            // Add file info for file messages
            if (data.type !== 'text' && filesMetadata.length > 0 && message.attachments && message.attachments.length > 0) {
                // Handle single or multiple files
                if (filesMetadata.length === 1) {
                    // Single file - backward compatibility
                    const fileMetadata = filesMetadata[0];
                    messageData.fileInfo = {
                        id: fileMetadata.fileId,
                        fileName: fileMetadata.fileName,
                        fileSize: fileMetadata.fileSize,
                        mimeType: fileMetadata.mimeType,
                        downloadUrl: fileMetadata.downloadUrl,
                        thumbnailUrl: fileMetadata.thumbnailUrl,
                        duration: fileMetadata.duration,
                        dimensions: fileMetadata.dimensions,
                    };
                } else {
                    // Multiple files - new structure
                    messageData.filesInfo = filesMetadata.map(fileMetadata => ({
                        id: fileMetadata.fileId,
                        fileName: fileMetadata.fileName,
                        fileSize: fileMetadata.fileSize,
                        mimeType: fileMetadata.mimeType,
                        downloadUrl: fileMetadata.downloadUrl,
                        thumbnailUrl: fileMetadata.thumbnailUrl,
                        duration: fileMetadata.duration,
                        dimensions: fileMetadata.dimensions,
                    }));

                    // Also keep first file in fileInfo for backward compatibility
                    messageData.fileInfo = messageData.filesInfo[0];
                }
            }

            // Broadcast to conversation participants (EXCLUDE sender to prevent duplicate)
            client.to(`conversation:${data.conversationId}`).emit('new_message', messageData);

            this.logger.log(`Message broadcasted: ${message.id} by ${userId} to conversation:${data.conversationId} (sender excluded)`);
            this.logger.log(`Broadcast data:`, JSON.stringify(messageData, null, 2));

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

    @SubscribeMessage('share_file')
    async handleShareFile(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: ShareFileDto,
    ) {
        const startTime = Date.now();

        try {
            const userId = this.socketToUser.get(client.id);
            const deviceInfo = this.socketToDevice.get(client.id);

            if (!userId || !deviceInfo) {
                throw new Error('User not authenticated');
            }

            // Verify file access and get file details
            const fileDetails = await this.filesService.getFile(data.fileId, userId);
            if (!fileDetails) {
                throw new Error('File not found or access denied');
            }

            // Generate download URL
            const downloadUrl = await this.filesService.generateDownloadUrl(
                data.fileId,
                userId,
                { expiresIn: 24 * 60 * 60 } // 24 hours
            );

            // Create user context for service
            const userContext: UserContext = {
                userId: userId,
                deviceId: deviceInfo.deviceId,
                roles: ['user']
            };

            // Determine message type from MIME type
            const messageType = this.getMessageTypeFromMimeType(fileDetails.mimeType);

            // Create file message
            const createMessageDto: CreateMessageDto = {
                localId: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                conversationId: data.conversationId,
                content: data.message || this.generateFileContentMessage(messageType, fileDetails.fileName),
                type: messageType as any,
                attachments: [{
                    fileId: data.fileId,
                    fileName: fileDetails.fileName,
                    fileSize: fileDetails.fileSize,
                    mimeType: fileDetails.mimeType,
                }],
                mentions: []
            };

            // Send message via Messages Service
            const message = await this.messagesService.sendMessage(createMessageDto, userContext);

            // Broadcast file message to conversation
            const senderName = await this.getUserDisplayName(userId);
            const messageData = {
                id: message.id,
                conversationId: message.conversationId,
                senderId: message.senderId,
                senderName: senderName,
                content: message.content,
                messageType: message.type,
                timestamp: message.createdAt,
                fileInfo: {
                    id: data.fileId,
                    fileName: fileDetails.fileName,
                    fileSize: fileDetails.fileSize,
                    mimeType: fileDetails.mimeType,
                    downloadUrl: downloadUrl,
                    // Generate thumbnail URL if thumbnail exists
                    thumbnailUrl: fileDetails.thumbnailPath ? await this.filesService.generateDownloadUrl(
                        data.fileId, // Use same fileId for thumbnail access
                        userId,
                        { expiresIn: 24 * 60 * 60 }
                    ).then(url => `${url}&thumbnail=true`) : undefined,
                }
            };

            this.server.to(`conversation:${data.conversationId}`).emit('new_file_message', messageData);

            // Send success response to sender
            client.emit('file_shared', {
                messageId: message.id,
                fileId: data.fileId,
                conversationId: data.conversationId,
                processingTime: Date.now() - startTime,
            });

            this.logger.log(`File shared: ${data.fileId} by ${userId} to conversation ${data.conversationId}`);

        } catch (error) {
            this.logger.error(`Share file error for socket ${client.id}:`, error);

            client.emit('share_file_error', {
                fileId: data.fileId,
                conversationId: data.conversationId,
                error: error.message,
                processingTime: Date.now() - startTime,
            });
        }
    }

    @SubscribeMessage('quick_share_file')
    async handleQuickShareFile(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: QuickShareFileDto,
    ) {
        const startTime = Date.now();

        try {
            const userId = this.socketToUser.get(client.id);
            const deviceInfo = this.socketToDevice.get(client.id);

            if (!userId || !deviceInfo) {
                throw new Error('User not authenticated');
            }

            // Validate file metadata
            if (!this.validateFileMetadata(data.fileMetadata)) {
                throw new Error('Invalid file metadata');
            }

            // Verify file ownership (lightweight check)
            const hasAccess = await this.filesService.checkFileAccess(data.fileId, userId);
            if (!hasAccess) {
                throw new Error('File not found or access denied');
            }

            // Create user context for service
            const userContext: UserContext = {
                userId: userId,
                deviceId: deviceInfo.deviceId,
                roles: ['user']
            };

            // Determine message type from MIME type
            const messageType = this.getMessageTypeFromMimeType(data.fileMetadata.mimeType);

            // Create file message
            const createMessageDto: CreateMessageDto = {
                localId: `quickfile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                conversationId: data.conversationId,
                content: data.message || this.generateFileContentMessage(messageType, data.fileMetadata.fileName),
                type: messageType as any,
                attachments: [{
                    fileId: data.fileId,
                    fileName: data.fileMetadata.fileName,
                    fileSize: data.fileMetadata.fileSize,
                    mimeType: data.fileMetadata.mimeType,
                }],
                mentions: []
            };

            // Send message via Messages Service
            const message = await this.messagesService.sendMessage(createMessageDto, userContext);

            // Broadcast file message to conversation (using provided metadata)
            const senderName = await this.getUserDisplayName(userId);
            const messageData = {
                id: message.id,
                conversationId: message.conversationId,
                senderId: message.senderId,
                senderName: senderName,
                content: message.content,
                messageType: message.type,
                timestamp: message.createdAt,
                fileInfo: {
                    id: data.fileId,
                    fileName: data.fileMetadata.fileName,
                    fileSize: data.fileMetadata.fileSize,
                    mimeType: data.fileMetadata.mimeType,
                    downloadUrl: data.fileMetadata.downloadUrl,
                    thumbnailUrl: data.fileMetadata.thumbnailUrl,
                    duration: data.fileMetadata.duration,
                    dimensions: data.fileMetadata.dimensions,
                }
            };

            this.server.to(`conversation:${data.conversationId}`).emit('new_file_message', messageData);

            // Send success response to sender
            client.emit('quick_file_shared', {
                messageId: message.id,
                fileId: data.fileId,
                conversationId: data.conversationId,
                processingTime: Date.now() - startTime,
            });

            this.logger.log(`Quick file shared: ${data.fileId} by ${userId} to conversation ${data.conversationId}`);

        } catch (error) {
            this.logger.error(`Quick share file error for socket ${client.id}:`, error);

            client.emit('quick_share_file_error', {
                fileId: data.fileId,
                conversationId: data.conversationId,
                error: error.message,
                processingTime: Date.now() - startTime,
            });
        }
    }

    @SubscribeMessage('join_conversations')
    async handleJoinConversations(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: JoinConversationsDto,
    ) {
        try {
            const userId = this.socketToUser.get(client.id);
            if (!userId) {
                this.logger.warn(`Join conversations failed: User not authenticated - socket ${client.id}`);
                return;
            }

            this.logger.log(`User ${userId} attempting to join conversations: ${data.conversationIds.join(', ')}`);

            for (const convId of data.conversationIds) {
                // Verify permission
                const hasPermission = await this.checkConversationPermission(userId, convId);
                if (hasPermission) {
                    await client.join(`conversation:${convId}`);
                    this.logger.log(`User ${userId} successfully joined conversation:${convId}`);
                } else {
                    this.logger.warn(`User ${userId} denied access to conversation ${convId}`);
                }
            }

        } catch (error) {
            this.logger.error(`Join conversations error:`, error);
        }
    }

    @SubscribeMessage('batch_share_files')
    async handleBatchShareFiles(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: BatchShareFilesDto,
    ) {
        const startTime = Date.now();

        try {
            const userId = this.socketToUser.get(client.id);
            const deviceInfo = this.socketToDevice.get(client.id);

            if (!userId || !deviceInfo) {
                throw new Error('User not authenticated');
            }

            if (!data.fileIds || data.fileIds.length === 0) {
                throw new Error('At least one file ID is required');
            }

            let filesMetadata: Array<any> = [];

            if (data.filesMetadata && data.filesMetadata.length === data.fileIds.length) {
                // Use provided metadata but verify ownership
                for (const fileMetadata of data.filesMetadata) {
                    if (!this.validateFileMetadata(fileMetadata)) {
                        throw new Error(`Invalid metadata for file ${fileMetadata.fileId}`);
                    }

                    const hasAccess = await this.filesService.checkFileAccess(fileMetadata.fileId, userId);
                    if (!hasAccess) {
                        throw new Error(`File ${fileMetadata.fileId} not found or access denied`);
                    }
                }
                filesMetadata = data.filesMetadata;
            } else {
                // Query metadata for all files
                for (const fileId of data.fileIds) {
                    const fileDetails = await this.filesService.getFile(fileId, userId);
                    if (!fileDetails) {
                        throw new Error(`File ${fileId} not found or access denied`);
                    }

                    const downloadUrl = await this.filesService.generateDownloadUrl(
                        fileId,
                        userId,
                        { expiresIn: 24 * 60 * 60 }
                    );

                    const fileMetadata = {
                        fileId: fileId,
                        fileName: fileDetails.fileName,
                        fileSize: fileDetails.fileSize,
                        mimeType: fileDetails.mimeType,
                        downloadUrl: downloadUrl,
                        thumbnailUrl: fileDetails.thumbnailPath ? await this.filesService.generateDownloadUrl(
                            fileId,
                            userId,
                            { expiresIn: 24 * 60 * 60 }
                        ).then(url => `${url}&thumbnail=true`) : undefined,
                    };
                    filesMetadata.push(fileMetadata);
                }
            }

            // Create user context for service
            const userContext: UserContext = {
                userId: userId,
                deviceId: deviceInfo.deviceId,
                roles: ['user']
            };

            // Determine predominant message type from files
            const messageType = this.getPredominantMessageType(filesMetadata.map(f => f.mimeType));

            // Create batch file message
            const createMessageDto: CreateMessageDto = {
                localId: `batchfile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                conversationId: data.conversationId,
                content: data.message || this.generateBatchFileContentMessage(
                    filesMetadata.length,
                    filesMetadata.map(f => f.fileName)
                ),
                type: messageType as any,
                attachments: filesMetadata.map(fileMetadata => ({
                    fileId: fileMetadata.fileId,
                    fileName: fileMetadata.fileName,
                    fileSize: fileMetadata.fileSize,
                    mimeType: fileMetadata.mimeType,
                })),
                mentions: []
            };

            // Send message via Messages Service
            const message = await this.messagesService.sendMessage(createMessageDto, userContext);

            // Broadcast batch file message to conversation
            const senderName = await this.getUserDisplayName(userId);
            const messageData = {
                id: message.id,
                conversationId: message.conversationId,
                senderId: message.senderId,
                senderName: senderName,
                content: message.content,
                messageType: message.type,
                timestamp: message.createdAt,
                filesInfo: filesMetadata.map(fileMetadata => ({
                    id: fileMetadata.fileId,
                    fileName: fileMetadata.fileName,
                    fileSize: fileMetadata.fileSize,
                    mimeType: fileMetadata.mimeType,
                    downloadUrl: fileMetadata.downloadUrl,
                    thumbnailUrl: fileMetadata.thumbnailUrl,
                    duration: fileMetadata.duration,
                    dimensions: fileMetadata.dimensions,
                })),
                // Keep first file as fileInfo for backward compatibility
                fileInfo: {
                    id: filesMetadata[0].fileId,
                    fileName: filesMetadata[0].fileName,
                    fileSize: filesMetadata[0].fileSize,
                    mimeType: filesMetadata[0].mimeType,
                    downloadUrl: filesMetadata[0].downloadUrl,
                    thumbnailUrl: filesMetadata[0].thumbnailUrl,
                }
            };

            this.server.to(`conversation:${data.conversationId}`).emit('new_batch_files_message', messageData);

            // Send success response to sender
            client.emit('batch_files_shared', {
                messageId: message.id,
                fileIds: data.fileIds,
                conversationId: data.conversationId,
                filesCount: filesMetadata.length,
                processingTime: Date.now() - startTime,
            });

            this.logger.log(`Batch files shared: ${data.fileIds.length} files by ${userId} to conversation ${data.conversationId}`);

        } catch (error) {
            this.logger.error(`Batch share files error for socket ${client.id}:`, error);

            client.emit('batch_share_files_error', {
                fileIds: data.fileIds,
                conversationId: data.conversationId,
                error: error.message,
                processingTime: Date.now() - startTime,
            });
        }
    }
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
        try {
            const result = await this.conversationsService.getUserConversations(userId, {
                limit: 100, // Get all conversations for joining rooms
                offset: 0,
                type: 'all',
                status: 'all',
                sortBy: 'updated'
            });
            return result.conversations;
        } catch (error) {
            this.logger.error(`Failed to get user conversations for ${userId}:`, error);
            return [];
        }
    }

    async getUserConversationIds(userId: string): Promise<string[]> {
        try {
            const conversations = await this.getUserConversations(userId);
            return conversations.map(conv => conv.id);
        } catch (error) {
            this.logger.error(`Failed to get user conversation IDs for ${userId}:`, error);
            return [];
        }
    }

    async checkConversationPermission(userId: string, conversationId: string): Promise<boolean> {
        try {
            // Allow test conversations for development/testing
            if (conversationId.startsWith('test_')) {
                this.logger.log(`Allowing test conversation access: ${conversationId} for user ${userId}`);
                return true;
            }

            const conversations = await this.getUserConversations(userId);
            return conversations.some(conv => conv.id === conversationId);
        } catch (error) {
            this.logger.error(`Failed to check conversation permission for user ${userId} in conversation ${conversationId}:`, error);

            // Allow test conversations even if there's an error
            if (conversationId.startsWith('test_')) {
                return true;
            }

            return false;
        }
    }

    /**
     * Generate unique message ID
     * Format: msg_{timestamp}_{randomString}
     * @returns Promise<string> Unique message identifier
     */
    async generateMessageId(): Promise<string> {
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 11);
        return `msg_${timestamp}_${randomString}`;
    }

    async createMessageInDB(data: any): Promise<any> {
        // TODO: Implement with MessagesService
        return data;
    }

    /**
     * Get all participants of a conversation
     * @param conversationId - The conversation identifier
     * @param requestingUserId - The user ID making the request
     * @returns Promise<string[]> Array of user IDs participating in the conversation
     */
    async getConversationParticipants(conversationId: string, requestingUserId?: string): Promise<string[]> {
        try {
            // Use the first available user from connected users if no requesting user provided
            const userId = requestingUserId || this.getFirstConnectedUserId();
            if (!userId) {
                this.logger.warn(`No user available to fetch conversation ${conversationId} participants`);
                return [];
            }

            const conversation = await this.conversationsService.getConversationById(conversationId, userId);
            if (!conversation) {
                this.logger.warn(`Conversation ${conversationId} not found`);
                return [];
            }

            return conversation.participants?.map(participant => participant.userId) || [];
        } catch (error) {
            this.logger.error(`Failed to get conversation participants for ${conversationId}:`, error);
            return [];
        }
    }

    /**
     * Get first connected user ID for internal operations
     * @returns string | null First available connected user ID
     */
    private getFirstConnectedUserId(): string | null {
        const firstUserId = this.connectedUsers.keys().next().value;
        return firstUserId || null;
    }

    /**
     * Get device ID for a specific user
     * @param userId - The user identifier
     * @returns string | null Device ID if user is connected
     */
    private getDeviceIdForUser(userId: string): string | null {
        const userSockets = this.connectedUsers.get(userId);
        if (!userSockets || userSockets.size === 0) {
            return null;
        }

        // Get the first socket ID for this user
        const firstSocketId = userSockets.values().next().value;
        const deviceInfo = this.socketToDevice.get(firstSocketId);

        return deviceInfo?.deviceId || null;
    }

    /**
     * Get user display name for messages
     * @param userId - The user identifier
     * @returns Promise<string> User display name or fallback
     */
    private async getUserDisplayName(userId: string): Promise<string> {
        try {
            const user = await this.usersService.findById(userId);
            if (!user) {
                this.logger.warn(`User ${userId} not found for display name`);
                return 'Unknown User';
            }

            return user.fullName || user.username || 'User';
        } catch (error) {
            this.logger.error(`Failed to get display name for user ${userId}:`, error);
            return 'User';
        }
    }

    /**
     * Get user roles for context
     * @param userId - The user identifier
     * @returns Promise<string[]> Array of user roles
     */
    private async getUserRoles(userId: string): Promise<string[]> {
        try {
            const user = await this.usersService.findById(userId);
            if (!user) {
                return ['user'];
            }

            // TODO: Implement role system when available
            return ['user'];
        } catch (error) {
            this.logger.error(`Failed to get roles for user ${userId}:`, error);
            return ['user'];
        }
    }

    /**
     * Update delivery status for online participants
     * @param messageId - The message identifier
     * @param participants - Array of participant user IDs
     */
    async updateDeliveryStatusForOnlineUsers(messageId: string, participants: string[]): Promise<void> {
        try {
            const deliveryUpdates: Array<{
                messageId: string;
                userId: string;
                status: 'delivered' | 'read';
                timestamp: number;
            }> = [];

            const currentTimestamp = Date.now();

            for (const userId of participants) {
                if (this.isUserOnline(userId)) {
                    deliveryUpdates.push({
                        messageId,
                        userId,
                        status: 'delivered' as const,
                        timestamp: currentTimestamp
                    });
                }
            }

            if (deliveryUpdates.length > 0) {
                // Batch update delivery status through optimization service
                for (const update of deliveryUpdates) {
                    await this.optimizationService.addDeliveryUpdate(messageId, update);
                }

                this.logger.debug(`Updated delivery status for ${deliveryUpdates.length} online users for message ${messageId}`);
            }
        } catch (error) {
            this.logger.error(`Failed to update delivery status for message ${messageId}:`, error);
        }
    }

    /**
     * Update read status for messages
     * @param messageIds - Array of message identifiers
     * @param userId - The user identifier
     * @param readAt - Timestamp when messages were read
     */
    async updateMessagesReadStatus(messageIds: string[], userId: string, readAt: number): Promise<void> {
        try {
            if (!messageIds || messageIds.length === 0) {
                this.logger.warn('No message IDs provided for read status update');
                return;
            }

            // Create user context for Messages Service
            const userContext: UserContext = {
                userId,
                deviceId: this.getDeviceIdForUser(userId) || 'unknown',
                roles: ['user']
            };

            // Update read status in database through Messages Service
            for (const messageId of messageIds) {
                await this.messagesService.markAsRead(messageId, userContext);
            }

            this.logger.debug(`Updated read status for ${messageIds.length} messages by user ${userId}`);
        } catch (error) {
            this.logger.error(`Failed to update read status for messages ${messageIds.join(', ')} by user ${userId}:`, error);
        }
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
    }    // ================= PUBLIC API METHODS =================

    /**
     * Send message to specific user
     * 
     * @param userId - Target user identifier
     * @param event - Event name to emit
     * @param data - Data payload to send
     */
    sendToUser(userId: string, event: string, data: any): void {
        this.server.to(`user:${userId}`).emit(event, data);
    }

    /**
     * Send message to conversation participants
     * 
     * @param conversationId - Target conversation identifier
     * @param event - Event name to emit
     * @param data - Data payload to send
     */
    sendToConversation(conversationId: string, event: string, data: any): void {
        this.server.to(`conversation:${conversationId}`).emit(event, data);
    }

    /**
     * Check if user is currently online
     * 
     * @param userId - User identifier to check
     * @returns boolean indicating online status
     */
    isUserOnline(userId: string): boolean {
        return this.connectedUsers.has(userId);
    }

    /**
     * Get number of active socket connections for user
     * 
     * @param userId - User identifier
     * @returns number of active connections
     */
    getUserSocketCount(userId: string): number {
        return this.connectedUsers.get(userId)?.size || 0;
    }

    // ================= PRIVATE HELPER METHODS =================

    /**
     * Generate appropriate content message based on file type
     */
    private generateFileContentMessage(type: string, fileName: string): string {
        const fileEmojis = {
            'image': '🖼️',
            'audio': '🎵',
            'video': '🎥',
            'document': '📄',
            'file': '📎'
        };

        const emoji = fileEmojis[type] || fileEmojis['file'];
        return `${emoji} ${fileName}`;
    }

    /**
     * Generate content message for batch files
     */
    private generateBatchFileContentMessage(filesCount: number, fileNames: string[]): string {
        if (filesCount === 1) {
            return `📎 ${fileNames[0]}`;
        }

        const fileTypes = this.categorizeFiles(fileNames);
        const typeDescriptions: string[] = [];

        if (fileTypes.images > 0) {
            typeDescriptions.push(`${fileTypes.images} ${fileTypes.images === 1 ? 'hình ảnh' : 'hình ảnh'}`);
        }
        if (fileTypes.videos > 0) {
            typeDescriptions.push(`${fileTypes.videos} ${fileTypes.videos === 1 ? 'video' : 'video'}`);
        }
        if (fileTypes.audios > 0) {
            typeDescriptions.push(`${fileTypes.audios} ${fileTypes.audios === 1 ? 'âm thanh' : 'âm thanh'}`);
        }
        if (fileTypes.documents > 0) {
            typeDescriptions.push(`${fileTypes.documents} ${fileTypes.documents === 1 ? 'tài liệu' : 'tài liệu'}`);
        }
        if (fileTypes.others > 0) {
            typeDescriptions.push(`${fileTypes.others} ${fileTypes.others === 1 ? 'tệp khác' : 'tệp khác'}`);
        }

        if (typeDescriptions.length === 0) {
            return `📎 ${filesCount} tệp`;
        }

        return `📎 ${typeDescriptions.join(', ')}`;
    }

    /**
     * Categorize files by type for batch content message
     */
    private categorizeFiles(fileNames: string[]): {
        images: number;
        videos: number;
        audios: number;
        documents: number;
        others: number;
    } {
        const categories = {
            images: 0,
            videos: 0,
            audios: 0,
            documents: 0,
            others: 0
        };

        fileNames.forEach(fileName => {
            const extension = fileName.toLowerCase().split('.').pop() || '';

            if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(extension)) {
                categories.images++;
            } else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(extension)) {
                categories.videos++;
            } else if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(extension)) {
                categories.audios++;
            } else if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(extension)) {
                categories.documents++;
            } else {
                categories.others++;
            }
        });

        return categories;
    }

    /**
     * Get predominant message type from multiple MIME types
     */
    private getPredominantMessageType(mimeTypes: string[]): string {
        const typeCounts = {
            image: 0,
            video: 0,
            audio: 0,
            document: 0,
            file: 0
        };

        mimeTypes.forEach(mimeType => {
            const type = this.getMessageTypeFromMimeType(mimeType);
            typeCounts[type]++;
        });

        // Return the most common type, defaulting to 'file' if tied
        let maxCount = 0;
        let predominantType = 'file';

        Object.entries(typeCounts).forEach(([type, count]) => {
            if (count > maxCount) {
                maxCount = count;
                predominantType = type;
            }
        });

        // If it's mixed files, return 'file'
        const nonZeroTypes = Object.values(typeCounts).filter(count => count > 0).length;
        if (nonZeroTypes > 2) {
            return 'file';
        }

        return predominantType;
    }

    /**
     * Validate file metadata structure
     */
    private validateFileMetadata(fileMetadata: any): boolean {
        if (!fileMetadata) return false;

        const requiredFields = ['fileId', 'fileName', 'fileSize', 'mimeType', 'downloadUrl'];
        return requiredFields.every(field => fileMetadata[field] !== undefined);
    }

    /**
     * Determine message type from MIME type
     */
    private getMessageTypeFromMimeType(mimeType: string): string {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('audio/')) return 'audio';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return 'document';
        return 'file';
    }
}
