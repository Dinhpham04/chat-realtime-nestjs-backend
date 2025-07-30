# Socket File Messaging Implementation Guide

## Kiến trúc File Messaging theo Senior Developer Standards

### 📋 Tổng quan

Hệ thống file messaging được thiết kế theo nguyên tắc **Separation of Concerns**:

- **File Upload**: HTTP API (RESTful) - `/files` endpoints
- **Message Sending**: WebSocket - Chat Gateway events
- **File Metadata**: Truyền từ HTTP response sang WebSocket events

---

## 🚀 Luồng xử lý File Messages

### 1. Upload File qua HTTP API

```typescript
// Client gửi file qua HTTP POST
POST /files/upload
Content-Type: multipart/form-data

// Server response với metadata
{
    "fileId": "uuid-v4",
    "fileName": "document.pdf",
    "fileSize": 1024000,
    "mimeType": "application/pdf",
    "downloadUrl": "https://api.com/files/download?token=...",
    "thumbnailUrl": "https://api.com/files/download?token=...&thumbnail=true",
    "isNew": true,
    "dimensions": { "width": 800, "height": 600 }, // For images/videos
    "duration": 120 // For audio/video (seconds)
}
```

### 2. Gửi Message với File Metadata qua WebSocket

#### Option A: Regular Message với File
```typescript
socket.emit('send_message', {
    localId: 'local_123',
    conversationId: 'conv_456',
    content: 'Check out this document!', // Optional text
    type: 'document', // 'image' | 'audio' | 'video' | 'document' | 'file'
    timestamp: Date.now(),
    fileMetadata: {
        fileId: 'uuid-from-upload',
        fileName: 'document.pdf',
        fileSize: 1024000,
        mimeType: 'application/pdf',
        downloadUrl: 'https://...',
        thumbnailUrl: 'https://...', // Optional
        duration: 120, // Optional for audio/video
        dimensions: { width: 800, height: 600 } // Optional for images
    }
});
```

#### Option B: Quick Share File (Optimized)
```typescript
socket.emit('quick_share_file', {
    fileId: 'uuid-from-upload',
    conversationId: 'conv_456',
    message: 'Optional caption', // Optional
    fileMetadata: {
        fileName: 'document.pdf',
        fileSize: 1024000,
        mimeType: 'application/pdf',
        downloadUrl: 'https://...',
        thumbnailUrl: 'https://...',
        duration: 120,
        dimensions: { width: 800, height: 600 }
    }
});
```

---

## 📱 Client Implementation Examples

### React/TypeScript Client

```typescript
class FileMessageService {
    private socket: Socket;

    async sendFileMessage(
        file: File, 
        conversationId: string, 
        message?: string
    ): Promise<void> {
        try {
            // 1. Upload file via HTTP
            const uploadResult = await this.uploadFile(file);
            
            // 2. Send message via WebSocket
            const messageType = this.determineMessageType(uploadResult.mimeType);
            
            this.socket.emit('send_message', {
                localId: `msg_${Date.now()}_${Math.random()}`,
                conversationId,
                content: message || '',
                type: messageType,
                timestamp: Date.now(),
                fileMetadata: {
                    fileId: uploadResult.fileId,
                    fileName: uploadResult.fileName,
                    fileSize: uploadResult.fileSize,
                    mimeType: uploadResult.mimeType,
                    downloadUrl: uploadResult.downloadUrl,
                    thumbnailUrl: uploadResult.thumbnailUrl,
                    duration: uploadResult.duration,
                    dimensions: uploadResult.dimensions
                }
            });
            
        } catch (error) {
            console.error('Failed to send file message:', error);
        }
    }

    private async uploadFile(file: File): Promise<UploadResult> {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/files/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.authToken}`
            },
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Upload failed');
        }
        
        return response.json();
    }

    private determineMessageType(mimeType: string): string {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('audio/')) return 'audio';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.includes('pdf') || mimeType.includes('document')) return 'document';
        return 'file';
    }
}
```

### React Native Client

```typescript
import { launchImageLibrary } from 'react-native-image-picker';
import { uploadFile } from './api/files';

class MobileFileService {
    async pickAndSendFile(conversationId: string): Promise<void> {
        try {
            // Pick file
            const result = await launchImageLibrary({
                mediaType: 'mixed',
                quality: 0.8,
            });
            
            if (result.assets?.[0]) {
                const asset = result.assets[0];
                
                // Upload file
                const uploadResult = await uploadFile({
                    uri: asset.uri!,
                    name: asset.fileName!,
                    type: asset.type!,
                });
                
                // Send via socket
                socket.emit('quick_share_file', {
                    fileId: uploadResult.fileId,
                    conversationId,
                    fileMetadata: {
                        fileName: uploadResult.fileName,
                        fileSize: uploadResult.fileSize,
                        mimeType: uploadResult.mimeType,
                        downloadUrl: uploadResult.downloadUrl,
                        thumbnailUrl: uploadResult.thumbnailUrl,
                        dimensions: asset.width && asset.height ? {
                            width: asset.width,
                            height: asset.height
                        } : undefined
                    }
                });
            }
        } catch (error) {
            console.error('File send failed:', error);
        }
    }
}
```

---

## 🎯 Server Events & Responses

### Incoming Message Events

```typescript
// When others send file messages
socket.on('new_message', (data) => {
    console.log('New message:', data);
    /*
    {
        id: 'msg_server_id',
        conversationId: 'conv_456',
        senderId: 'user_123',
        senderName: 'John Doe',
        content: '📄 document.pdf',
        messageType: 'document',
        timestamp: '2023-07-29T10:30:00Z',
        fileInfo: {
            id: 'file_uuid',
            fileName: 'document.pdf',
            fileSize: 1024000,
            mimeType: 'application/pdf',
            downloadUrl: 'https://...',
            thumbnailUrl: 'https://...', // If available
            duration: 120, // For audio/video
            dimensions: { width: 800, height: 600 } // For images
        }
    }
    */
});

// Dedicated file message event
socket.on('new_file_message', (data) => {
    // Same structure as above, optimized for file messages
});
```

### Acknowledgment Events

```typescript
// Message received acknowledgment
socket.on('message_received', (data) => {
    /*
    {
        localId: 'local_123',
        serverId: 'msg_server_id',
        timestamp: 1690632600000,
        status: 'processed',
        processingTime: 150
    }
    */
});

// Quick share success
socket.on('quick_file_shared', (data) => {
    /*
    {
        messageId: 'msg_server_id',
        fileId: 'file_uuid',
        conversationId: 'conv_456',
        processingTime: 200
    }
    */
});

// Error events
socket.on('message_error', (error) => {
    console.error('Message error:', error);
});

socket.on('quick_share_file_error', (error) => {
    console.error('Quick share error:', error);
});
```

---

## 🔧 Performance Optimizations

### 1. **File Type Detection**
```typescript
// Server automatically determines message type from MIME type
const messageType = this.getMessageTypeFromMimeType(mimeType);
```

### 2. **Thumbnail Pre-generation**
- Server generates thumbnails during HTTP upload
- WebSocket events include ready-to-use thumbnail URLs

### 3. **Metadata Validation**
```typescript
// Server validates file metadata structure
private validateFileMetadata(fileMetadata: any): boolean {
    const requiredFields = ['fileId', 'fileName', 'fileSize', 'mimeType', 'downloadUrl'];
    return requiredFields.every(field => fileMetadata[field] !== undefined);
}
```

### 4. **Access Control**
```typescript
// Lightweight file access check for quick sharing
const hasAccess = await this.filesService.checkFileAccess(fileId, userId);
```

---

## 🛡️ Security Considerations

### 1. **File Ownership Verification**
- Server verifies user owns the file before allowing message send
- Download URLs are signed and time-limited

### 2. **Token-based Downloads**
```typescript
// Download URLs include secure tokens
"downloadUrl": "https://api.com/files/download?token=jwt_signed_token&expires=1690719000"
```

### 3. **MIME Type Validation**
- Server validates MIME types match file content
- Prevents malicious file type spoofing

---

## 📊 Benefits của Architecture này

### ✅ **Separation of Concerns**
- Upload logic tách biệt khỏi messaging logic
- Dễ maintain và scale riêng biệt

### ✅ **Performance**
- File processing (thumbnails, validation) không block WebSocket
- Client có thể cache file metadata

### ✅ **Reliability**
- HTTP upload có retry mechanisms tốt hơn WebSocket
- WebSocket chỉ handle messaging nhanh và nhẹ

### ✅ **Scalability**  
- File storage có thể scale riêng (CDN, multiple servers)
- WebSocket servers không cần handle file processing

### ✅ **Mobile-First**
- Optimize cho mobile networks (retry upload riêng)
- Progressive file sending (upload trước, send message sau)

---

## 🚨 Migration từ Architecture cũ

### Legacy Support
Server vẫn support `share_file` event để backward compatibility:

```typescript
// Legacy event (still supported)
socket.emit('share_file', {
    fileId: 'uuid',
    conversationId: 'conv_456',
    message: 'Optional'
});
```

### Recommended Migration Path
1. Implement new HTTP upload endpoints
2. Update clients để sử dụng `send_message` với `fileMetadata`
3. Gradually deprecate `share_file` event
4. Monitor performance improvements

---

---

## 📊 Message Status Management System

### Message Status Lifecycle

Message trong hệ thống chat có 4 trạng thái chính:

1. **SENDING** (`sending`) - Đang gửi (Client-side only)
2. **SENT** (`sent`) - Đã gửi thành công lên server
3. **DELIVERED** (`delivered`) - Đã được gửi đến người nhận
4. **READ** (`read`) - Đã được đọc bởi người nhận

```typescript
enum MessageStatus {
    SENDING = 'sending',
    SENT = 'sent', 
    DELIVERED = 'delivered',
    READ = 'read'
}
```

---

## 🔄 Message Status Flow Implementation

### 1. Client-Side Status Tracking

```typescript
interface LocalMessage {
    localId: string;
    serverId?: string;
    content: string;
    type: string;
    status: MessageStatus;
    timestamp: number;
    senderId: string;
    conversationId: string;
    retryCount?: number;
    fileMetadata?: any;
}

class MessageStatusManager {
    private messages = new Map<string, LocalMessage>();
    private statusUpdateCallbacks = new Map<string, Function[]>();

    // Gửi message với status tracking
    async sendMessage(messageData: any): Promise<void> {
        const localId = `msg_${Date.now()}_${Math.random()}`;
        
        // 1. Tạo message với status SENDING
        const message: LocalMessage = {
            localId,
            ...messageData,
            status: MessageStatus.SENDING,
            timestamp: Date.now(),
            retryCount: 0
        };
        
        this.messages.set(localId, message);
        this.notifyStatusUpdate(localId, MessageStatus.SENDING);
        
        try {
            // 2. Gửi qua WebSocket
            socket.emit('send_message', {
                localId,
                conversationId: messageData.conversationId,
                content: messageData.content,
                type: messageData.type,
                timestamp: Date.now(),
                fileMetadata: messageData.fileMetadata
            });
            
        } catch (error) {
            // Update status to failed
            message.status = 'failed';
            this.notifyStatusUpdate(localId, 'failed');
        }
    }

    // Handle server acknowledgment
    handleMessageReceived(data: any): void {
        const message = this.messages.get(data.localId);
        if (message) {
            // 3. Update status to SENT when server confirms
            message.status = MessageStatus.SENT;
            message.serverId = data.serverId;
            this.notifyStatusUpdate(data.localId, MessageStatus.SENT);
        }
    }

    // Handle delivery confirmation
    handleMessageDelivered(data: any): void {
        const message = Array.from(this.messages.values())
            .find(msg => msg.serverId === data.messageId);
        
        if (message) {
            // 4. Update status to DELIVERED
            message.status = MessageStatus.DELIVERED;
            this.notifyStatusUpdate(message.localId, MessageStatus.DELIVERED);
        }
    }

    // Handle read receipt
    handleMessageRead(data: any): void {
        data.messageIds.forEach(messageId => {
            const message = Array.from(this.messages.values())
                .find(msg => msg.serverId === messageId);
            
            if (message) {
                // 5. Update status to READ
                message.status = MessageStatus.READ;
                this.notifyStatusUpdate(message.localId, MessageStatus.READ);
            }
        });
    }

    private notifyStatusUpdate(localId: string, status: MessageStatus): void {
        const callbacks = this.statusUpdateCallbacks.get(localId) || [];
        callbacks.forEach(callback => callback(status));
        
        // Trigger UI update
        this.updateMessageInUI(localId, status);
    }

    private updateMessageInUI(localId: string, status: MessageStatus): void {
        const messageElement = document.querySelector(`[data-local-id="${localId}"]`);
        if (messageElement) {
            const statusElement = messageElement.querySelector('.message-status');
            if (statusElement) {
                statusElement.className = `message-status status-${status}`;
                statusElement.innerHTML = this.getStatusIcon(status);
            }
        }
    }

    private getStatusIcon(status: MessageStatus): string {
        switch (status) {
            case MessageStatus.SENDING:
                return '<i class="fas fa-clock" title="Đang gửi..."></i>';
            case MessageStatus.SENT:
                return '<i class="fas fa-check" title="Đã gửi"></i>';
            case MessageStatus.DELIVERED:
                return '<i class="fas fa-check-double" title="Đã nhận"></i>';
            case MessageStatus.READ:
                return '<i class="fas fa-check-double text-blue" title="Đã đọc"></i>';
            default:
                return '<i class="fas fa-exclamation-triangle text-red" title="Lỗi"></i>';
        }
    }
}
```

### 2. Server-Side Status Events

```typescript
// chat.gateway.ts - Message Status Handling

@SubscribeMessage('send_message')
async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessageDto,
) {
    try {
        const userId = this.socketToUser.get(client.id);
        
        // 1. Send immediate acknowledgment (SENT status)
        client.emit('message_received', {
            localId: data.localId,
            serverId: 'pending',
            timestamp: Date.now(),
            status: 'received'
        });

        // 2. Process and save message
        const message = await this.messagesService.sendMessage(createMessageDto, userContext);

        // 3. Send final acknowledgment with server ID
        client.emit('message_received', {
            localId: data.localId,
            serverId: message.id,
            timestamp: message.createdAt,
            status: 'processed'
        });

        // 4. Broadcast to conversation participants
        const messageData = {
            id: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            content: message.content,
            messageType: message.type,
            timestamp: message.createdAt
        };

        // Exclude sender to prevent duplicate
        client.to(`conversation:${data.conversationId}`).emit('new_message', messageData);

        // 5. Auto-mark as delivered for online users
        const participants = await this.getConversationParticipants(data.conversationId);
        await this.updateDeliveryStatusForOnlineUsers(message.id, participants);

    } catch (error) {
        // Send error status
        client.emit('message_error', {
            localId: data.localId,
            error: error.message,
            status: 'failed'
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

        // Update delivery status in database
        await this.messagesService.markAsDelivered(data.messageId, userId, data.deliveredAt);

        // Notify sender about delivery
        this.server.to(`conversation:${data.conversationId}`).emit('message_delivery_update', {
            messageId: data.messageId,
            userId: userId,
            status: 'delivered',
            timestamp: data.deliveredAt
        });

        this.logger.log(`Message ${data.messageId} marked as delivered by user ${userId}`);

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
        if (!userId) return;

        // Update read status in database
        await this.messagesService.markMessagesAsRead(data.messageIds, userId, data.readAt);

        // Notify conversation participants about read receipt
        this.server.to(`conversation:${data.conversationId}`).emit('messages_read_update', {
            messageIds: data.messageIds,
            userId: userId,
            readAt: data.readAt
        });

        // Sync read status across user's devices
        await this.deviceSyncService.syncReadStatus(userId, data.messageIds, data.readAt);

        this.logger.log(`${data.messageIds.length} messages marked as read by user ${userId}`);

    } catch (error) {
        this.logger.error(`Read receipt error:`, error);
    }
}

// Auto-delivery tracking for online users
async updateDeliveryStatusForOnlineUsers(messageId: string, participants: string[]): Promise<void> {
    try {
        const onlineParticipants = participants.filter(userId => this.isUserOnline(userId));
        
        for (const userId of onlineParticipants) {
            // Auto-mark as delivered for online users
            await this.messagesService.markAsDelivered(messageId, userId, Date.now());
            
            // Notify about delivery
            this.sendToUser(userId, 'message_delivery_update', {
                messageId,
                userId,
                status: 'delivered',
                timestamp: Date.now()
            });
        }
    } catch (error) {
        this.logger.error(`Auto-delivery update failed:`, error);
    }
}
```

### 3. Complete Client Integration

```html
<!-- Message HTML Template with Status -->
<div class="message sent" data-local-id="{{localId}}" data-server-id="{{serverId}}">
    <div class="message-content">
        <p>{{content}}</p>
        <div class="message-footer">
            <span class="timestamp">{{time}}</span>
            <span class="message-status status-{{status}}">
                <!-- Status icon will be inserted here -->
            </span>
        </div>
    </div>
</div>

<style>
.message-status {
    margin-left: 5px;
    font-size: 12px;
}

.status-sending { color: #999; }
.status-sent { color: #4CAF50; }
.status-delivered { color: #2196F3; }
.status-read { color: #2196F3; }
.status-failed { color: #f44336; }

.status-read .fas {
    color: #2196F3 !important;
}
</style>

<script>
// Initialize status manager
const statusManager = new MessageStatusManager();

// Socket event listeners
socket.on('message_received', (data) => {
    statusManager.handleMessageReceived(data);
});

socket.on('message_delivery_update', (data) => {
    statusManager.handleMessageDelivered(data);
});

socket.on('messages_read_update', (data) => {
    statusManager.handleMessageRead(data);
});

socket.on('new_message', (data) => {
    // When receiving new message, auto-send delivery confirmation
    socket.emit('message_delivered', {
        messageId: data.id,
        conversationId: data.conversationId,
        userId: currentUserId,
        deliveredAt: Date.now()
    });
    
    // Display message in UI
    displayMessage(data);
});

// Auto-read when message is visible
function markMessagesAsRead(messageIds, conversationId) {
    socket.emit('mark_as_read', {
        conversationId,
        messageIds,
        userId: currentUserId,
        readAt: Date.now()
    });
}

// Send message with status tracking
async function sendMessage(content, type = 'text', fileMetadata = null) {
    await statusManager.sendMessage({
        conversationId: currentConversationId,
        content,
        type,
        fileMetadata
    });
}
</script>
```

---

## 🔧 Advanced Status Features

### 1. Batch Status Updates
```typescript
// Optimize multiple message status updates
@SubscribeMessage('batch_mark_delivered')
async handleBatchMarkDelivered(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageIds: string[]; conversationId: string; deliveredAt: number },
) {
    const userId = this.socketToUser.get(client.id);
    if (!userId) return;

    await this.messagesService.markMultipleAsDelivered(data.messageIds, userId, data.deliveredAt);
    
    this.server.to(`conversation:${data.conversationId}`).emit('batch_delivery_update', {
        messageIds: data.messageIds,
        userId,
        status: 'delivered',
        timestamp: data.deliveredAt
    });
}
```

### 2. Status Persistence & Recovery
```typescript
// Recover message status on reconnection
socket.on('connect', async () => {
    const pendingMessages = statusManager.getPendingMessages();
    
    for (const message of pendingMessages) {
        if (message.status === MessageStatus.SENDING) {
            // Retry sending
            await statusManager.retrySendMessage(message);
        }
    }
    
    // Request status updates for recent messages
    socket.emit('request_status_sync', {
        conversationId: currentConversationId,
        since: Date.now() - (5 * 60 * 1000) // Last 5 minutes
    });
});
```

### 3. Real-time Status Indicators
```typescript
// Show typing and online status
function updateUserStatusIndicators(participants) {
    participants.forEach(participant => {
        const isOnline = onlineUsers.includes(participant.userId);
        const indicator = document.querySelector(`[data-user="${participant.userId}"] .status-indicator`);
        
        if (indicator) {
            indicator.className = `status-indicator ${isOnline ? 'online' : 'offline'}`;
        }
    });
}
```

---

*Tài liệu này được thiết kế theo tiêu chuẩn Senior Developer với focus vào Performance, Security, và Maintainability.*
