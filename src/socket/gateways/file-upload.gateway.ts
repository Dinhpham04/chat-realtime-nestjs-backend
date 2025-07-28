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

// Files Module Services
import { ChunkUploadService } from '../../modules/files/services/chunk-upload.service';
import { FilesService } from '../../modules/files/services/files.service';
import { FileValidationService } from '../../modules/files/services/file-validation.service';

// Socket Services
import { SocketAuthService } from '../services/socket-auth.service';

// DTOs for File Upload Events
interface InitiateUploadDto {
    fileName: string;
    fileSize: number;
    mimeType: string;
    chunkSize?: number;
    conversationId?: string;
    uploadId: string; // Client-generated ID for tracking
}

interface UploadChunkDto {
    sessionId: string;
    chunkIndex: number;
    chunkData: string; // Base64 encoded chunk data
    uploadId: string;
}

interface CompleteUploadDto {
    sessionId: string;
    uploadId: string;
    fileName: string;
    conversationId?: string;
}

interface CancelUploadDto {
    sessionId: string;
    uploadId: string;
    reason?: string;
}

interface UploadSmallFileDto {
    fileName: string;
    fileSize: number;
    mimeType: string;
    fileData: string; // Base64 encoded file data
    conversationId?: string;
    uploadId: string;
}

interface UploadProgressDto {
    sessionId: string;
    uploadId: string;
}

@Injectable()
@WebSocketGateway({
    namespace: '/file-upload',
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
})
export class FileUploadGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(FileUploadGateway.name);

    // Track active uploads per socket
    private readonly socketUploads = new Map<string, Set<string>>(); // socketId -> Set<sessionId>
    private readonly socketToUser = new Map<string, string>(); // socketId -> userId

    constructor(
        private readonly socketAuthService: SocketAuthService,
        private readonly chunkUploadService: ChunkUploadService,
        private readonly filesService: FilesService,
        private readonly fileValidationService: FileValidationService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    /**
     * Handle client connection
     */
    async handleConnection(client: Socket) {
        this.logger.log(`File upload client connecting: ${client.id}`);

        try {
            // Get auth data from handshake
            const authData = client.handshake.auth;

            if (!authData?.token) {
                this.logger.warn(`No auth token for file upload socket ${client.id}`);
                client.disconnect();
                return;
            }

            // Authenticate user
            const user = await this.socketAuthService.authenticateSocket(authData.token);
            if (!user) {
                this.logger.warn(`File upload authentication failed for socket ${client.id}`);
                client.disconnect();
                return;
            }

            // Store user mapping
            this.socketToUser.set(client.id, user.userId);
            this.socketUploads.set(client.id, new Set());

            // Join user to personal room for file upload notifications
            await client.join(`file-upload:user:${user.userId}`);

            this.logger.log(`File upload client connected: ${client.id} (user: ${user.userId})`);

        } catch (error) {
            this.logger.error(`File upload connection error for socket ${client.id}:`, error);
            client.disconnect();
        }
    }

    /**
     * Handle client disconnection
     */
    async handleDisconnect(client: Socket) {
        const userId = this.socketToUser.get(client.id);
        const activeSessions = this.socketUploads.get(client.id);

        if (activeSessions && activeSessions.size > 0) {
            // Cancel active uploads for disconnected client
            for (const sessionId of activeSessions) {
                try {
                    await this.chunkUploadService.cancelUpload(sessionId, userId!);
                    this.logger.log(`Cancelled upload session ${sessionId} for disconnected client ${client.id}`);
                } catch (error) {
                    this.logger.error(`Failed to cancel upload session ${sessionId}:`, error);
                }
            }
        }

        // Cleanup
        this.socketToUser.delete(client.id);
        this.socketUploads.delete(client.id);

        this.logger.log(`File upload client disconnected: ${client.id} ${userId ? `(user: ${userId})` : ''}`);
    }

    /**
     * Initiate chunk upload session
     */
    @SubscribeMessage('initiate_upload')
    async handleInitiateUpload(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: InitiateUploadDto,
    ) {
        const startTime = Date.now();

        try {
            const userId = this.socketToUser.get(client.id);
            if (!userId) {
                throw new Error('User not authenticated');
            }

            // Validate file
            const validationResult = await this.fileValidationService.validateFile({
                originalName: data.fileName,
                size: data.fileSize,
                mimeType: data.mimeType,
            });

            if (!validationResult.isValid) {
                client.emit('upload_error', {
                    uploadId: data.uploadId,
                    error: 'File validation failed',
                    details: validationResult.errors,
                    processingTime: Date.now() - startTime,
                });
                return;
            }

            // Create chunk upload session
            const session = await this.chunkUploadService.initiateChunkUpload(
                data.fileName,
                data.fileSize,
                data.mimeType,
                userId,
            );

            // Track this session for the socket
            this.socketUploads.get(client.id)?.add(session.uploadId);

            // Send success response
            client.emit('upload_initiated', {
                uploadId: data.uploadId,
                sessionId: session.uploadId,
                totalChunks: session.totalChunks,
                chunkSize: session.chunkSize,
                processingTime: Date.now() - startTime,
            });

            this.logger.log(`Upload initiated: ${session.uploadId} for user ${userId} (${data.fileName})`);

        } catch (error) {
            this.logger.error(`Initiate upload error for socket ${client.id}:`, error);

            client.emit('upload_error', {
                uploadId: data.uploadId,
                error: error.message,
                processingTime: Date.now() - startTime,
            });
        }
    }

    /**
     * Upload file chunk
     */
    @SubscribeMessage('upload_chunk')
    async handleUploadChunk(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: UploadChunkDto,
    ) {
        const startTime = Date.now();

        try {
            const userId = this.socketToUser.get(client.id);
            if (!userId) {
                throw new Error('User not authenticated');
            }

            // Convert base64 to buffer
            const chunkBuffer = Buffer.from(data.chunkData, 'base64');

            // Generate checksum for chunk
            const crypto = require('crypto');
            const checksum = crypto.createHash('sha256').update(chunkBuffer).digest('hex');

            // Upload chunk
            const result = await this.chunkUploadService.uploadChunk(
                data.sessionId,
                data.chunkIndex,
                chunkBuffer,
                checksum,
                userId,
            );

            // Send chunk acknowledgment
            client.emit('chunk_uploaded', {
                uploadId: data.uploadId,
                sessionId: data.sessionId,
                chunkIndex: data.chunkIndex,
                uploadedChunks: result.completedChunks,
                totalChunks: result.totalChunks,
                progress: result.percentage,
                processingTime: Date.now() - startTime,
            });

            // Emit progress update to all user's devices
            this.server.to(`file-upload:user:${userId}`).emit('upload_progress', {
                uploadId: data.uploadId,
                sessionId: data.sessionId,
                progress: result.percentage,
                completedChunks: result.completedChunks,
                totalChunks: result.totalChunks,
                isComplete: result.isComplete,
            });

            this.logger.log(`Chunk uploaded: ${data.sessionId} chunk ${data.chunkIndex} (${result.percentage}%)`);

        } catch (error) {
            this.logger.error(`Upload chunk error for socket ${client.id}:`, error);

            client.emit('chunk_error', {
                uploadId: data.uploadId,
                sessionId: data.sessionId,
                chunkIndex: data.chunkIndex,
                error: error.message,
                processingTime: Date.now() - startTime,
            });
        }
    }

    /**
     * Complete upload and create file record
     */
    @SubscribeMessage('complete_upload')
    async handleCompleteUpload(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: CompleteUploadDto,
    ) {
        const startTime = Date.now();

        try {
            const userId = this.socketToUser.get(client.id);
            if (!userId) {
                throw new Error('User not authenticated');
            }

            // Complete chunk upload - this assembles chunks and creates the final file
            const uploadResult = await this.chunkUploadService.completeChunkUpload(
                data.sessionId,
                undefined, // no final checksum validation for now
                userId,
            );

            // Remove from active uploads
            this.socketUploads.get(client.id)?.delete(data.sessionId);

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
            });

            // Emit to all user devices
            this.server.to(`file-upload:user:${userId}`).emit('file_uploaded', {
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
            });

            this.logger.log(`Upload completed: ${data.sessionId} -> file ${uploadResult.fileId} (${uploadResult.fileName})`);

        } catch (error) {
            this.logger.error(`Complete upload error for socket ${client.id}:`, error);

            client.emit('upload_error', {
                uploadId: data.uploadId,
                sessionId: data.sessionId,
                error: error.message,
                processingTime: Date.now() - startTime,
            });
        }
    }

    /**
     * Cancel upload
     */
    @SubscribeMessage('cancel_upload')
    async handleCancelUpload(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: CancelUploadDto,
    ) {
        try {
            const userId = this.socketToUser.get(client.id);
            if (!userId) {
                throw new Error('User not authenticated');
            }

            // Cancel upload session
            await this.chunkUploadService.cancelUpload(data.sessionId, userId);

            // Remove from active uploads
            this.socketUploads.get(client.id)?.delete(data.sessionId);

            // Send cancellation response
            client.emit('upload_cancelled', {
                uploadId: data.uploadId,
                sessionId: data.sessionId,
                reason: data.reason || 'Cancelled by user',
            });

            // Emit to all user devices
            this.server.to(`file-upload:user:${userId}`).emit('upload_cancelled', {
                uploadId: data.uploadId,
                sessionId: data.sessionId,
                reason: data.reason || 'Cancelled by user',
            });

            this.logger.log(`Upload cancelled: ${data.sessionId} by user ${userId}`);

        } catch (error) {
            this.logger.error(`Cancel upload error for socket ${client.id}:`, error);

            client.emit('upload_error', {
                uploadId: data.uploadId,
                sessionId: data.sessionId,
                error: error.message,
            });
        }
    }

    /**
     * Get upload progress
     */
    @SubscribeMessage('get_upload_progress')
    async handleGetUploadProgress(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: UploadProgressDto,
    ) {
        try {
            const userId = this.socketToUser.get(client.id);
            if (!userId) {
                throw new Error('User not authenticated');
            }

            // Get progress from service
            const progress = await this.chunkUploadService.getUploadProgress(data.sessionId, userId);

            // Send progress response
            client.emit('upload_progress_response', {
                uploadId: data.uploadId,
                sessionId: data.sessionId,
                progress: progress.percentage,
                completedChunks: progress.completedChunks,
                totalChunks: progress.totalChunks,
                isComplete: progress.isComplete,
                failedChunks: progress.failedChunks,
            });

        } catch (error) {
            this.logger.error(`Get upload progress error for socket ${client.id}:`, error);

            client.emit('upload_error', {
                uploadId: data.uploadId,
                sessionId: data.sessionId,
                error: error.message,
            });
        }
    }

    /**
     * Handle small file upload (single message)
     */
    @SubscribeMessage('upload_small_file')
    async handleUploadSmallFile(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: UploadSmallFileDto,
    ) {
        try {
            const userId = this.socketToUser.get(client.id);
            if (!userId) {
                throw new Error('User not authenticated');
            }

            this.logger.log(`Small file upload started for socket ${client.id}, file: ${data.fileName}`);

            // Validate file data
            if (!data.fileName || !data.fileData || !data.uploadId) {
                throw new Error('Missing required file data');
            }

            // Convert base64 to buffer
            const fileBuffer = Buffer.from(data.fileData, 'base64');

            // Validate file size
            if (fileBuffer.length !== data.fileSize) {
                throw new Error('File size mismatch');
            }

            // Validate file type
            await this.fileValidationService.validateFile({
                originalname: data.fileName,
                mimetype: data.mimeType,
                size: data.fileSize,
                buffer: fileBuffer,
            } as any);

            // Create file directly using FilesService
            const fileResult = await this.filesService.uploadFile({
                originalName: data.fileName,
                mimeType: data.mimeType,
                size: data.fileSize,
                buffer: fileBuffer,
            }, userId);

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
            });

            // Emit to file integration service if conversation provided
            if (data.conversationId) {
                this.eventEmitter.emit('file.upload.completed', {
                    fileId: fileResult.fileId,
                    userId: userId,
                    conversationId: data.conversationId,
                    fileName: data.fileName,
                    uploadMethod: 'websocket_single',
                });
            }

        } catch (error) {
            this.logger.error(`Small file upload error for socket ${client.id}:`, error);

            client.emit('upload_error', {
                uploadId: data.uploadId,
                error: error.message,
            });
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
        this.server.to(`file-upload:user:${userId}`).emit(event, data);
    }

    /**
     * Check if user is connected to file upload namespace
     */
    isUserConnectedToFileUpload(userId: string): boolean {
        const room = this.server.sockets.adapter.rooms.get(`file-upload:user:${userId}`);
        return room ? room.size > 0 : false;
    }

    /**
     * Get active upload count for user
     */
    getUserActiveUploads(userId: string): number {
        let count = 0;
        for (const [socketId, uploads] of this.socketUploads) {
            if (this.socketToUser.get(socketId) === userId) {
                count += uploads.size;
            }
        }
        return count;
    }
}
