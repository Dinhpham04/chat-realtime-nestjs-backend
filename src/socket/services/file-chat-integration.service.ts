import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ChatGateway } from '../gateways/chat.gateway';
import { FileUploadGateway } from '../gateways/file-upload.gateway';

export interface FileMessageData {
    messageId: string;
    conversationId: string;
    senderId: string;
    senderName: string;
    fileId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    downloadUrl: string;
    previewUrl?: string;
    timestamp: number;
}

export interface FileUploadProgressData {
    userId: string;
    conversationId?: string;
    uploadId: string;
    sessionId: string;
    progress: number;
    fileName: string;
    fileSize: number;
}

/**
 * Service to integrate file uploads with chat messaging
 * Handles real-time notifications for file sharing in conversations
 */
@Injectable()
export class FileChatIntegrationService {
    private readonly logger = new Logger(FileChatIntegrationService.name);

    constructor(
        @Inject(forwardRef(() => ChatGateway))
        private readonly chatGateway: ChatGateway,
        private readonly fileUploadGateway: FileUploadGateway,
    ) { }

    /**
     * Notify conversation participants about a new file message
     */
    async notifyFileMessage(data: FileMessageData): Promise<void> {
        try {
            // Send to conversation participants via chat gateway
            this.chatGateway.sendToConversation(data.conversationId, 'new_file_message', {
                id: data.messageId,
                conversationId: data.conversationId,
                senderId: data.senderId,
                senderName: data.senderName,
                messageType: 'file',
                fileInfo: {
                    id: data.fileId,
                    fileName: data.fileName,
                    fileSize: data.fileSize,
                    mimeType: data.mimeType,
                    downloadUrl: data.downloadUrl,
                    previewUrl: data.previewUrl,
                },
                timestamp: data.timestamp,
            });

            this.logger.log(`File message notification sent to conversation ${data.conversationId}: ${data.fileName}`);
        } catch (error) {
            this.logger.error('Failed to notify file message:', error);
        }
    }

    /**
     * Share upload progress with conversation participants (for awareness)
     */
    async shareUploadProgress(data: FileUploadProgressData): Promise<void> {
        try {
            if (!data.conversationId) return;

            // Only share progress for larger files to avoid spam
            if (data.fileSize < 1024 * 1024) return; // 1MB threshold

            // Share progress at certain milestones
            const milestones = [25, 50, 75, 90, 100];
            if (!milestones.includes(Math.floor(data.progress))) return;

            this.chatGateway.sendToConversation(data.conversationId, 'file_upload_progress', {
                userId: data.userId,
                fileName: data.fileName,
                fileSize: data.fileSize,
                progress: data.progress,
                uploadId: data.uploadId,
            });

            this.logger.log(`Upload progress shared with conversation ${data.conversationId}: ${data.fileName} ${data.progress}%`);
        } catch (error) {
            this.logger.error('Failed to share upload progress:', error);
        }
    }

    /**
     * Check if user is online for file notifications
     */
    isUserOnlineForFiles(userId: string): boolean {
        return this.fileUploadGateway.isUserConnectedToFileUpload(userId) ||
            this.chatGateway.isUserOnline(userId);
    }

    /**
     * Send file-related notification to user
     */
    sendFileNotificationToUser(userId: string, event: string, data: any): void {
        try {
            // Try file upload gateway first (more specific)
            if (this.fileUploadGateway.isUserConnectedToFileUpload(userId)) {
                this.fileUploadGateway.sendFileUploadNotification(userId, event, data);
            } else {
                // Fallback to chat gateway
                this.chatGateway.sendToUser(userId, event, data);
            }

            this.logger.log(`File notification sent to user ${userId}: ${event}`);
        } catch (error) {
            this.logger.error(`Failed to send file notification to user ${userId}:`, error);
        }
    }

    // ================= EVENT HANDLERS =================

    /**
     * Handle file upload completion from file upload gateway
     */
    @OnEvent('file.upload.completed')
    handleFileUploadCompleted(payload: {
        userId: string;
        fileId: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
        downloadUrl: string;
        previewUrl?: string;
        conversationId?: string;
        uploadId: string;
    }): void {
        try {
            if (payload.conversationId) {
                // Notify conversation that file is ready for sharing
                this.chatGateway.sendToConversation(payload.conversationId, 'file_ready_for_sharing', {
                    fileId: payload.fileId,
                    fileName: payload.fileName,
                    fileSize: payload.fileSize,
                    mimeType: payload.mimeType,
                    uploadedBy: payload.userId,
                    uploadId: payload.uploadId,
                });
            }

            this.logger.log(`File upload completed notification handled: ${payload.fileName} by user ${payload.userId}`);
        } catch (error) {
            this.logger.error('Failed to handle file upload completion:', error);
        }
    }

    /**
     * Handle file processing status updates
     */
    @OnEvent('file.processing.status')
    handleFileProcessingStatus(payload: {
        userId: string;
        fileId: string;
        status: 'processing' | 'completed' | 'failed';
        progress?: number;
        error?: string;
        conversationId?: string;
    }): void {
        try {
            // Notify user about processing status
            this.sendFileNotificationToUser(payload.userId, 'file_processing_status', {
                fileId: payload.fileId,
                status: payload.status,
                progress: payload.progress,
                error: payload.error,
            });

            // If file is in a conversation, notify participants about availability
            if (payload.conversationId && payload.status === 'completed') {
                this.chatGateway.sendToConversation(payload.conversationId, 'file_processing_completed', {
                    fileId: payload.fileId,
                    status: 'ready',
                });
            }

            this.logger.log(`File processing status handled: ${payload.fileId} -> ${payload.status}`);
        } catch (error) {
            this.logger.error('Failed to handle file processing status:', error);
        }
    }

    /**
     * Handle virus scan results
     */
    @OnEvent('file.virus.scan')
    handleVirusScanResult(payload: {
        userId: string;
        fileId: string;
        status: 'clean' | 'infected' | 'error';
        details?: string;
        conversationId?: string;
    }): void {
        try {
            // Always notify the uploader
            this.sendFileNotificationToUser(payload.userId, 'file_virus_scan_result', {
                fileId: payload.fileId,
                status: payload.status,
                details: payload.details,
            });

            // If infected, notify conversation participants
            if (payload.conversationId && payload.status === 'infected') {
                this.chatGateway.sendToConversation(payload.conversationId, 'file_security_alert', {
                    fileId: payload.fileId,
                    status: 'blocked',
                    reason: 'Virus detected',
                    uploadedBy: payload.userId,
                });
            }

            this.logger.log(`Virus scan result handled: ${payload.fileId} -> ${payload.status}`);
        } catch (error) {
            this.logger.error('Failed to handle virus scan result:', error);
        }
    }

    /**
     * Handle file download events for analytics
     */
    @OnEvent('file.download')
    handleFileDownload(payload: {
        fileId: string;
        downloadedBy: string;
        downloadedFrom?: string; // IP or location
        conversationId?: string;
        uploadedBy: string;
    }): void {
        try {
            // Notify file owner about download (optional, based on privacy settings)
            // This could be configurable per user
            this.sendFileNotificationToUser(payload.uploadedBy, 'file_download_notification', {
                fileId: payload.fileId,
                downloadedBy: payload.downloadedBy,
                downloadedFrom: payload.downloadedFrom,
                timestamp: Date.now(),
            });

            this.logger.log(`File download tracked: ${payload.fileId} by user ${payload.downloadedBy}`);
        } catch (error) {
            this.logger.error('Failed to handle file download event:', error);
        }
    }
}
