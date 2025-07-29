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
import { Injectable, Logger, UseGuards, ValidationPipe, UsePipes } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import * as crypto from 'crypto';

// Files Module Services
import { ChunkUploadService } from '../../modules/files/services/chunk-upload.service';
import { FilesService } from '../../modules/files/services/files.service';
import { FileValidationService } from '../../modules/files/services/file-validation.service';

// Socket Services
import { SocketAuthService } from '../services/socket-auth.service';

// DTOs
import {
    InitiateUploadDto,
    UploadChunkDto,
    CompleteUploadDto,
    CancelUploadDto,
    UploadSmallFileDto,
    UploadProgressDto,
    PingDto,
} from '../dto/file-upload.dto';

// Types
interface UserAuthInfo {
    userId: string;
    socketId: string;
    connectedAt: Date;
}

interface ActiveUploadSession {
    uploadId: string;
    sessionId: string;
    userId: string;
    fileName: string;
    totalChunks: number;
    completedChunks: number;
    startedAt: Date;
    lastActivity: Date;
}

interface FileUploadResult {
    fileId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    downloadUrl: string;
}

// Rate limiting interface
interface RateLimitInfo {
    uploadCount: number;
    lastUpload: Date;
    resetTime: Date;
}

@Injectable()
@WebSocketGateway({
    namespace: '/file-upload',
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000, // 60 seconds ping timeout
    pingInterval: 25000, // 25 seconds ping interval
    maxHttpBufferSize: 10e6, // 10MB max buffer size for large payloads
    allowEIO3: true, // Allow Engine.IO v3 for compatibility
})
export class FileUploadGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(FileUploadGateway.name);

    // Constants
    private readonly GRACE_PERIOD_MS = 30000; // 30 seconds
    private readonly MAX_UPLOADS_PER_USER = 5; // Maximum concurrent uploads per user
    private readonly RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
    private readonly MAX_UPLOADS_PER_MINUTE = 10; // Max uploads per minute per user
    private readonly MAX_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB max chunk size
    private readonly MAX_SMALL_FILE_SIZE = 10 * 1024 * 1024; // 10MB max small file size

    // Enhanced tracking maps
    private readonly socketUploads = new Map<string, Set<string>>(); // socketId -> Set<sessionId>
    private readonly socketToUser = new Map<string, UserAuthInfo>(); // socketId -> UserAuthInfo
    private readonly activeUploads = new Map<string, ActiveUploadSession>(); // sessionId -> ActiveUploadSession
    private readonly userRateLimit = new Map<string, RateLimitInfo>(); // userId -> RateLimitInfo

    constructor(
        private readonly socketAuthService: SocketAuthService,
        private readonly chunkUploadService: ChunkUploadService,
        private readonly filesService: FilesService,
        private readonly fileValidationService: FileValidationService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    /**
     * Handle client connection with enhanced validation
     */
    async handleConnection(client: Socket): Promise<void> {
        const startTime = Date.now();
        this.logger.log(`File upload client connecting: ${client.id}`);

        try {
            // Get auth data from handshake
            const authData = client.handshake.auth;

            if (!authData?.token) {
                this.logger.warn(`No auth token for file upload socket ${client.id}`);
                client.emit('connection_error', {
                    error: 'Authentication token required',
                    code: 'AUTH_TOKEN_MISSING',
                    timestamp: new Date().toISOString(),
                });
                client.disconnect();
                return;
            }

            // Authenticate user
            const user = await this.socketAuthService.authenticateSocket(authData.token);
            if (!user) {
                this.logger.warn(`File upload authentication failed for socket ${client.id}`);
                client.emit('connection_error', {
                    error: 'Authentication failed',
                    code: 'AUTH_FAILED',
                    timestamp: new Date().toISOString(),
                });
                client.disconnect();
                return;
            }

            // Check for rate limiting
            const rateLimitCheck = this.checkRateLimit(user.userId);
            if (!rateLimitCheck.allowed) {
                this.logger.warn(`Rate limit exceeded for user ${user.userId}`);
                client.emit('connection_error', {
                    error: 'Rate limit exceeded',
                    code: 'RATE_LIMIT_EXCEEDED',
                    retryAfter: rateLimitCheck.retryAfter,
                    timestamp: new Date().toISOString(),
                });
                client.disconnect();
                return;
            }

            // Store enhanced user mapping
            const userInfo: UserAuthInfo = {
                userId: user.userId,
                socketId: client.id,
                connectedAt: new Date(),
            };

            this.socketToUser.set(client.id, userInfo);
            this.socketUploads.set(client.id, new Set());

            // Join user to personal room for file upload notifications
            await client.join(`file-upload:user:${user.userId}`);

            // Send connection success
            client.emit('connection_established', {
                userId: user.userId,
                socketId: client.id,
                maxConcurrentUploads: this.MAX_UPLOADS_PER_USER,
                maxChunkSize: this.MAX_CHUNK_SIZE,
                maxSmallFileSize: this.MAX_SMALL_FILE_SIZE,
                connectionTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
            });

            this.logger.log(`File upload client connected: ${client.id} (user: ${user.userId}) in ${Date.now() - startTime}ms`);

            // Check for any active upload sessions for this user that might have been disconnected
            setTimeout(() => {
                this.notifyActiveUploadSessions(client, user.userId);
            }, 1000);

        } catch (error) {
            this.logger.error(`File upload connection error for socket ${client.id}:`, error);
            client.emit('connection_error', {
                error: 'Internal server error during connection',
                code: 'CONNECTION_ERROR',
                timestamp: new Date().toISOString(),
            });
            client.disconnect();
        }
    }

    /**
     * Handle client disconnection with enhanced cleanup
     */
    async handleDisconnect(client: Socket): Promise<void> {
        const userInfo = this.socketToUser.get(client.id);
        const activeSessions = this.socketUploads.get(client.id);

        this.logger.log(`File upload client disconnected: ${client.id} ${userInfo ? `(user: ${userInfo.userId})` : ''}`);

        if (activeSessions && activeSessions.size > 0) {
            this.logger.log(`Client ${client.id} has ${activeSessions.size} active upload sessions`);

            // Don't immediately cancel uploads on disconnect - give grace period for reconnection
            setTimeout(async () => {
                // Check if user has reconnected (has active sockets)
                const userHasActiveSocket = userInfo ? this.isUserConnectedToFileUpload(userInfo.userId) : false;

                if (!userHasActiveSocket && userInfo) {
                    this.logger.log(`Grace period expired for user ${userInfo.userId}, cancelling ${activeSessions.size} upload sessions`);

                    // Cancel active uploads only if user hasn't reconnected
                    for (const sessionId of activeSessions) {
                        try {
                            await this.chunkUploadService.cancelUpload(sessionId, userInfo.userId);
                            this.activeUploads.delete(sessionId);
                            this.logger.log(`Cancelled upload session ${sessionId} for user ${userInfo.userId} after grace period`);
                        } catch (error) {
                            this.logger.error(`Failed to cancel upload session ${sessionId}:`, error);
                        }
                    }
                } else if (userInfo) {
                    this.logger.log(`User ${userInfo.userId} has reconnected, keeping upload sessions active`);
                }
            }, this.GRACE_PERIOD_MS);
        }

        // Cleanup socket mappings
        this.socketToUser.delete(client.id);
        this.socketUploads.delete(client.id);
    }

    /**
     * Check rate limiting for user
     */
    private checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
        const now = new Date();
        const userLimit = this.userRateLimit.get(userId);

        if (!userLimit) {
            // First upload for this user
            this.userRateLimit.set(userId, {
                uploadCount: 1,
                lastUpload: now,
                resetTime: new Date(now.getTime() + this.RATE_LIMIT_WINDOW_MS),
            });
            return { allowed: true };
        }

        // Check if reset time has passed
        if (now > userLimit.resetTime) {
            this.userRateLimit.set(userId, {
                uploadCount: 1,
                lastUpload: now,
                resetTime: new Date(now.getTime() + this.RATE_LIMIT_WINDOW_MS),
            });
            return { allowed: true };
        }

        // Check current count
        if (userLimit.uploadCount >= this.MAX_UPLOADS_PER_MINUTE) {
            return {
                allowed: false,
                retryAfter: Math.ceil((userLimit.resetTime.getTime() - now.getTime()) / 1000),
            };
        }

        // Increment count
        userLimit.uploadCount++;
        userLimit.lastUpload = now;
        this.userRateLimit.set(userId, userLimit);

        return { allowed: true };
    }

    /**
     * Notify client about active upload sessions
     */
    private async notifyActiveUploadSessions(client: Socket, userId: string): Promise<void> {
        try {
            const activeSessions: ActiveUploadSession[] = [];

            for (const [sessionId, session] of this.activeUploads) {
                if (session.userId === userId) {
                    activeSessions.push(session);
                }
            }

            if (activeSessions.length > 0) {
                client.emit('active_upload_sessions', {
                    sessions: activeSessions.map(session => ({
                        uploadId: session.uploadId,
                        sessionId: session.sessionId,
                        fileName: session.fileName,
                        totalChunks: session.totalChunks,
                        completedChunks: session.completedChunks,
                        startedAt: session.startedAt.toISOString(),
                        lastActivity: session.lastActivity.toISOString(),
                    })),
                    message: 'Upload connection restored. Active uploads can continue.',
                    timestamp: new Date().toISOString(),
                });
            } else {
                client.emit('connection_restored', {
                    userId: userId,
                    message: 'Upload connection restored. No active uploads found.',
                    timestamp: new Date().toISOString(),
                });
            }
        } catch (error) {
            this.logger.error(`Error notifying active upload sessions for user ${userId}:`, error);
        }
    }

    /**
     * Validate user authentication for socket operations
     */
    private validateUserAuth(client: Socket): UserAuthInfo | null {
        const userInfo = this.socketToUser.get(client.id);
        if (!userInfo) {
            client.emit('authentication_error', {
                error: 'User not authenticated',
                code: 'AUTH_REQUIRED',
                timestamp: new Date().toISOString(),
            });
            return null;
        }
        return userInfo;
    }

    /**
     * Check concurrent upload limit for user
     */
    private checkConcurrentUploadLimit(userId: string): boolean {
        let activeCount = 0;
        for (const [_, session] of this.activeUploads) {
            if (session.userId === userId) {
                activeCount++;
            }
        }
        return activeCount < this.MAX_UPLOADS_PER_USER;
    }

    /**
     * Initiate chunk upload session with enhanced validation
     */
    @SubscribeMessage('initiate_upload')
    @UsePipes(new ValidationPipe({ transform: true }))
    async handleInitiateUpload(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: InitiateUploadDto,
    ): Promise<void> {
        const startTime = Date.now();

        try {
            const userInfo = this.validateUserAuth(client);
            if (!userInfo) return;

            // Check concurrent upload limit
            if (!this.checkConcurrentUploadLimit(userInfo.userId)) {
                client.emit('upload_error', {
                    uploadId: data.uploadId,
                    error: 'Maximum concurrent uploads reached',
                    code: 'CONCURRENT_LIMIT_EXCEEDED',
                    maxAllowed: this.MAX_UPLOADS_PER_USER,
                    processingTime: Date.now() - startTime,
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            // Enhanced file validation with chunk upload specific checks
            const validationResult = await this.fileValidationService.validateFile({
                originalName: data.fileName,
                size: data.fileSize,
                mimeType: data.mimeType,
            });

            if (!validationResult.isValid) {
                client.emit('upload_error', {
                    uploadId: data.uploadId,
                    error: 'File validation failed',
                    code: 'VALIDATION_FAILED',
                    details: validationResult.errors,
                    processingTime: Date.now() - startTime,
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            // Create chunk upload session
            const session = await this.chunkUploadService.initiateChunkUpload(
                data.fileName,
                data.fileSize,
                data.mimeType,
                userInfo.userId,
            );

            // Track this session
            this.socketUploads.get(client.id)?.add(session.uploadId);
            this.activeUploads.set(session.uploadId, {
                uploadId: data.uploadId,
                sessionId: session.uploadId,
                userId: userInfo.userId,
                fileName: data.fileName,
                totalChunks: session.totalChunks,
                completedChunks: 0,
                startedAt: new Date(),
                lastActivity: new Date(),
            });

            // Send success response
            client.emit('upload_initiated', {
                uploadId: data.uploadId,
                sessionId: session.uploadId,
                totalChunks: session.totalChunks,
                chunkSize: session.chunkSize,
                maxConcurrentUploads: this.MAX_UPLOADS_PER_USER,
                processingTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
            });

            this.logger.log(`Upload initiated: ${session.uploadId} for user ${userInfo.userId} (${data.fileName}) - ${session.totalChunks} chunks`);

        } catch (error) {
            this.logger.error(`Initiate upload error for socket ${client.id}:`, error);

            client.emit('upload_error', {
                uploadId: data.uploadId,
                error: error.message || 'Internal server error',
                code: 'INITIATE_ERROR',
                processingTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Upload file chunk with enhanced validation and error handling
     */
    @SubscribeMessage('upload_chunk')
    @UsePipes(new ValidationPipe({ transform: true }))
    async handleUploadChunk(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: UploadChunkDto,
    ): Promise<void> {
        const startTime = Date.now();

        try {
            const userInfo = this.validateUserAuth(client);
            if (!userInfo) return;

            // Enhanced validation
            if (!data.sessionId || !data.chunkData || data.chunkIndex < 0) {
                client.emit('chunk_error', {
                    uploadId: data.uploadId,
                    sessionId: data.sessionId,
                    chunkIndex: data.chunkIndex,
                    error: 'Invalid chunk data',
                    code: 'INVALID_CHUNK_DATA',
                    processingTime: Date.now() - startTime,
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            this.logger.log(`Uploading chunk ${data.chunkIndex} for session ${data.sessionId}`);

            // Convert base64 to buffer with size validation
            let chunkBuffer: Buffer;
            try {
                chunkBuffer = Buffer.from(data.chunkData, 'base64');
            } catch (error) {
                client.emit('chunk_error', {
                    uploadId: data.uploadId,
                    sessionId: data.sessionId,
                    chunkIndex: data.chunkIndex,
                    error: 'Invalid base64 data',
                    code: 'INVALID_BASE64',
                    processingTime: Date.now() - startTime,
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            // Validate chunk size
            if (chunkBuffer.length > this.MAX_CHUNK_SIZE) {
                client.emit('chunk_error', {
                    uploadId: data.uploadId,
                    sessionId: data.sessionId,
                    chunkIndex: data.chunkIndex,
                    error: 'Chunk size exceeds maximum allowed',
                    code: 'CHUNK_TOO_LARGE',
                    maxSize: this.MAX_CHUNK_SIZE,
                    actualSize: chunkBuffer.length,
                    processingTime: Date.now() - startTime,
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            // Generate checksum for chunk
            const checksum = crypto.createHash('sha256').update(chunkBuffer).digest('hex');

            this.logger.log(`Chunk ${data.chunkIndex}: size=${chunkBuffer.length}, checksum=${checksum.substring(0, 8)}...`);

            // Upload chunk
            const result = await this.chunkUploadService.uploadChunk(
                data.sessionId,
                data.chunkIndex,
                chunkBuffer,
                checksum,
                userInfo.userId,
            );

            // Update active upload tracking
            const activeUpload = this.activeUploads.get(data.sessionId);
            if (activeUpload) {
                activeUpload.completedChunks = result.completedChunks;
                activeUpload.lastActivity = new Date();
            }

            // Send chunk acknowledgment
            client.emit('chunk_uploaded', {
                uploadId: data.uploadId,
                sessionId: data.sessionId,
                chunkIndex: data.chunkIndex,
                uploadedChunks: result.completedChunks,
                totalChunks: result.totalChunks,
                progress: result.percentage,
                processingTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
            });

            // Emit progress update to all user's devices
            if (this.server && this.server.sockets) {
                this.server.to(`file-upload:user:${userInfo.userId}`).emit('upload_progress', {
                    uploadId: data.uploadId,
                    sessionId: data.sessionId,
                    progress: result.percentage,
                    completedChunks: result.completedChunks,
                    totalChunks: result.totalChunks,
                    isComplete: result.isComplete,
                    timestamp: new Date().toISOString(),
                });
            }

            this.logger.log(`Chunk uploaded: ${data.sessionId} chunk ${data.chunkIndex} (${result.percentage}%)`);

        } catch (error) {
            this.logger.error(`Upload chunk error for socket ${client.id}:`, error);

            client.emit('chunk_error', {
                uploadId: data.uploadId,
                sessionId: data.sessionId,
                chunkIndex: data.chunkIndex,
                error: error.message || 'Internal server error',
                code: 'UPLOAD_ERROR',
                processingTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Complete upload and create file record with enhanced validation
     */
    @SubscribeMessage('complete_upload')
    @UsePipes(new ValidationPipe({ transform: true }))
    async handleCompleteUpload(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: CompleteUploadDto,
    ): Promise<void> {
        const startTime = Date.now();

        try {
            const userInfo = this.validateUserAuth(client);
            if (!userInfo) return;

            // Validate required data
            if (!data.sessionId || !data.uploadId) {
                client.emit('upload_error', {
                    uploadId: data.uploadId,
                    sessionId: data.sessionId,
                    error: 'Missing sessionId or uploadId',
                    code: 'MISSING_REQUIRED_DATA',
                    processingTime: Date.now() - startTime,
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            this.logger.log(`Completing upload for session: ${data.sessionId}, uploadId: ${data.uploadId}, user: ${userInfo.userId}`);

            // Complete chunk upload - this assembles chunks and creates the final file
            const uploadResult = await this.chunkUploadService.completeChunkUpload(
                data.sessionId,
                undefined, // no final checksum validation for now
                userInfo.userId,
            );

            // Remove from active uploads
            this.socketUploads.get(client.id)?.delete(data.sessionId);
            this.activeUploads.delete(data.sessionId);

            // Send completion response
            client.emit('upload_completed', {
                uploadId: data.uploadId,
                sessionId: data.sessionId,
                file: {
                    id: uploadResult.fileId,
                    fileName: uploadResult.fileName,
                    fileSize: uploadResult.fileSize,
                    mimeType: uploadResult.mimeType,
                    downloadUrl: uploadResult.downloadUrl,
                    previewUrl: uploadResult.downloadUrl,
                },
                processingTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
            });

            // Emit to all user devices
            if (this.server && this.server.sockets) {
                this.server.to(`file-upload:user:${userInfo.userId}`).emit('file_uploaded', {
                    uploadId: data.uploadId,
                    file: {
                        id: uploadResult.fileId,
                        fileName: uploadResult.fileName,
                        fileSize: uploadResult.fileSize,
                        mimeType: uploadResult.mimeType,
                        downloadUrl: uploadResult.downloadUrl,
                        previewUrl: uploadResult.downloadUrl,
                    },
                    conversationId: data.conversationId,
                    timestamp: new Date().toISOString(),
                });
            }

            // Emit event for other services
            this.eventEmitter.emit('file.upload.completed', {
                fileId: uploadResult.fileId,
                userId: userInfo.userId,
                conversationId: data.conversationId,
                fileName: uploadResult.fileName,
                uploadMethod: 'websocket_chunked',
                timestamp: new Date().toISOString(),
            });

            this.logger.log(`Upload completed: ${data.sessionId} -> file ${uploadResult.fileId} (${uploadResult.fileName})`);

        } catch (error) {
            this.logger.error(`Complete upload error for socket ${client.id}:`, error);

            client.emit('upload_error', {
                uploadId: data.uploadId,
                sessionId: data.sessionId,
                error: error.message || 'Internal server error',
                code: 'COMPLETE_ERROR',
                processingTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Cancel upload with enhanced cleanup
     */
    @SubscribeMessage('cancel_upload')
    @UsePipes(new ValidationPipe({ transform: true }))
    async handleCancelUpload(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: CancelUploadDto,
    ): Promise<void> {
        try {
            const userInfo = this.validateUserAuth(client);
            if (!userInfo) return;

            // Cancel upload session
            await this.chunkUploadService.cancelUpload(data.sessionId, userInfo.userId);

            // Remove from active uploads
            this.socketUploads.get(client.id)?.delete(data.sessionId);
            this.activeUploads.delete(data.sessionId);

            // Send cancellation response
            client.emit('upload_cancelled', {
                uploadId: data.uploadId,
                sessionId: data.sessionId,
                reason: data.reason || 'Cancelled by user',
                timestamp: new Date().toISOString(),
            });

            // Emit to all user devices
            if (this.server && this.server.sockets) {
                this.server.to(`file-upload:user:${userInfo.userId}`).emit('upload_cancelled', {
                    uploadId: data.uploadId,
                    sessionId: data.sessionId,
                    reason: data.reason || 'Cancelled by user',
                    timestamp: new Date().toISOString(),
                });
            }

            this.logger.log(`Upload cancelled: ${data.sessionId} by user ${userInfo.userId}`);

        } catch (error) {
            this.logger.error(`Cancel upload error for socket ${client.id}:`, error);

            client.emit('upload_error', {
                uploadId: data.uploadId,
                sessionId: data.sessionId,
                error: error.message || 'Internal server error',
                code: 'CANCEL_ERROR',
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Get upload progress with enhanced data
     */
    @SubscribeMessage('get_upload_progress')
    @UsePipes(new ValidationPipe({ transform: true }))
    async handleGetUploadProgress(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: UploadProgressDto,
    ): Promise<void> {
        try {
            const userInfo = this.validateUserAuth(client);
            if (!userInfo) return;

            // Get progress from service
            const progress = await this.chunkUploadService.getUploadProgress(data.sessionId, userInfo.userId);

            // Get additional session info
            const activeUpload = this.activeUploads.get(data.sessionId);

            // Send progress response
            client.emit('upload_progress_response', {
                uploadId: data.uploadId,
                sessionId: data.sessionId,
                progress: progress.percentage,
                completedChunks: progress.completedChunks,
                totalChunks: progress.totalChunks,
                isComplete: progress.isComplete,
                failedChunks: progress.failedChunks,
                ...(activeUpload && {
                    fileName: activeUpload.fileName,
                    startedAt: activeUpload.startedAt.toISOString(),
                    lastActivity: activeUpload.lastActivity.toISOString(),
                }),
                timestamp: new Date().toISOString(),
            });

        } catch (error) {
            this.logger.error(`Get upload progress error for socket ${client.id}:`, error);

            client.emit('upload_error', {
                uploadId: data.uploadId,
                sessionId: data.sessionId,
                error: error.message || 'Internal server error',
                code: 'PROGRESS_ERROR',
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Handle small file upload (single message) with enhanced validation
     */
    @SubscribeMessage('upload_small_file')
    @UsePipes(new ValidationPipe({ transform: true }))
    async handleUploadSmallFile(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: UploadSmallFileDto,
    ): Promise<void> {
        const startTime = Date.now();

        try {
            const userInfo = this.validateUserAuth(client);
            if (!userInfo) return;

            this.logger.log(`Small file upload started for socket ${client.id}, file: ${data.fileName}`);

            // Validate file data
            if (!data.fileName || !data.fileData || !data.uploadId) {
                client.emit('upload_error', {
                    uploadId: data.uploadId,
                    error: 'Missing required file data',
                    code: 'MISSING_FILE_DATA',
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            // Convert base64 to buffer
            let fileBuffer: Buffer;
            try {
                fileBuffer = Buffer.from(data.fileData, 'base64');
            } catch (error) {
                client.emit('upload_error', {
                    uploadId: data.uploadId,
                    error: 'Invalid base64 file data',
                    code: 'INVALID_BASE64',
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            // Validate file size
            if (fileBuffer.length !== data.fileSize) {
                client.emit('upload_error', {
                    uploadId: data.uploadId,
                    error: 'File size mismatch',
                    code: 'SIZE_MISMATCH',
                    expected: data.fileSize,
                    actual: fileBuffer.length,
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            // Check max file size
            if (fileBuffer.length > this.MAX_SMALL_FILE_SIZE) {
                client.emit('upload_error', {
                    uploadId: data.uploadId,
                    error: 'File too large for small file upload',
                    code: 'FILE_TOO_LARGE',
                    maxSize: this.MAX_SMALL_FILE_SIZE,
                    actualSize: fileBuffer.length,
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            // Validate file type
            const validationResult = await this.fileValidationService.validateFile({
                originalname: data.fileName,
                mimetype: data.mimeType,
                size: data.fileSize,
                buffer: fileBuffer,
            } as any);

            if (!validationResult.isValid) {
                client.emit('upload_error', {
                    uploadId: data.uploadId,
                    error: 'File validation failed',
                    code: 'VALIDATION_FAILED',
                    details: validationResult.errors,
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            // Create file directly using FilesService
            const fileResult = await this.filesService.uploadFile({
                originalName: data.fileName,
                mimeType: data.mimeType,
                size: data.fileSize,
                buffer: fileBuffer,
            }, userInfo.userId);

            this.logger.log(`Small file upload completed for socket ${client.id}: ${fileResult.fileId}`);

            // Emit success event
            client.emit('small_file_uploaded', {
                uploadId: data.uploadId,
                file: {
                    _id: fileResult.fileId,
                    filename: fileResult.fileName,
                    mimeType: fileResult.mimeType,
                    size: fileResult.fileSize,
                    downloadUrl: fileResult.downloadUrl,
                },
                message: 'Small file uploaded successfully',
                processingTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
            });

            // Emit to file integration service if conversation provided
            if (data.conversationId) {
                this.eventEmitter.emit('file.upload.completed', {
                    fileId: fileResult.fileId,
                    userId: userInfo.userId,
                    conversationId: data.conversationId,
                    fileName: data.fileName,
                    uploadMethod: 'websocket_single',
                    timestamp: new Date().toISOString(),
                });
            }

        } catch (error) {
            this.logger.error(`Small file upload error for socket ${client.id}:`, error);

            client.emit('upload_error', {
                uploadId: data.uploadId,
                error: error.message || 'Internal server error',
                code: 'SMALL_FILE_ERROR',
                processingTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Handle ping for connection health check
     */
    @SubscribeMessage('ping')
    @UsePipes(new ValidationPipe({ transform: true }))
    async handlePing(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: PingDto,
    ): Promise<void> {
        try {
            // Send pong response with original timestamp
            client.emit('pong', {
                timestamp: data.timestamp,
                serverTime: Date.now(),
                latency: Date.now() - data.timestamp,
            });
        } catch (error) {
            this.logger.error(`Ping error for socket ${client.id}:`, error);
        }
    }

    // ================= EVENT HANDLERS FOR FILE OPTIMIZATION =================

    /**
     * Handle bulk file processing events
     */
    @OnEvent('file.bulk.processing')
    handleBulkFileProcessing(payload: {
        userId: string;
        files: Array<{ id: string; fileName: string; status: string }>;
        timestamp: number;
    }): void {
        try {
            if (!this.server || !this.server.sockets) {
                this.logger.warn(`Server not available when sending bulk file processing status to user ${payload.userId}`);
                return;
            }

            this.server.to(`file-upload:user:${payload.userId}`).emit('bulk_file_status', {
                files: payload.files,
                timestamp: payload.timestamp,
            });

            this.logger.log(`Bulk file processing status sent to user ${payload.userId}: ${payload.files.length} files`);
        } catch (error) {
            this.logger.error('Failed to send bulk file processing status:', error);
        }
    }

    /**
     * Handle file conversion events
     */
    @OnEvent('file.conversion.status')
    handleFileConversion(payload: {
        userId: string;
        fileId: string;
        status: 'started' | 'completed' | 'failed';
        progress?: number;
        error?: string;
        timestamp: number;
    }): void {
        try {
            if (!this.server || !this.server.sockets) {
                this.logger.warn(`Server not available when sending file conversion status to user ${payload.userId}`);
                return;
            }

            this.server.to(`file-upload:user:${payload.userId}`).emit('file_conversion_status', {
                fileId: payload.fileId,
                status: payload.status,
                progress: payload.progress,
                error: payload.error,
                timestamp: payload.timestamp,
            });

            this.logger.log(`File conversion status sent to user ${payload.userId}: ${payload.fileId} -> ${payload.status}`);
        } catch (error) {
            this.logger.error('Failed to send file conversion status:', error);
        }
    }

    // ================= PUBLIC METHODS FOR OTHER SERVICES =================

    /**
     * Send file upload notification to user
     */
    sendFileUploadNotification(userId: string, event: string, data: any): void {
        try {
            if (!this.server || !this.server.sockets) {
                this.logger.warn(`Server not available when sending notification to user ${userId}`);
                return;
            }

            this.server.to(`file-upload:user:${userId}`).emit(event, {
                ...data,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            this.logger.error(`Error sending file upload notification to user ${userId}:`, error);
        }
    }

    /**
     * Check if user is connected to file upload namespace
     */
    isUserConnectedToFileUpload(userId: string): boolean {
        try {
            // Check if server and adapter are available
            if (!this.server || !this.server.sockets || !this.server.sockets.adapter) {
                this.logger.warn(`Server or adapter not available when checking user connection for ${userId}`);
                return false;
            }

            const room = this.server.sockets.adapter.rooms.get(`file-upload:user:${userId}`);
            return room ? room.size > 0 : false;
        } catch (error) {
            this.logger.error(`Error checking user connection for ${userId}:`, error);
            return false;
        }
    }

    /**
     * Get active upload count for user
     */
    getUserActiveUploads(userId: string): number {
        let count = 0;
        for (const [socketId, uploads] of this.socketUploads) {
            const userInfo = this.socketToUser.get(socketId);
            if (userInfo?.userId === userId) {
                count += uploads.size;
            }
        }
        return count;
    }
}
