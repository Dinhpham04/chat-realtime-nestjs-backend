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

*Tài liệu này được thiết kế theo tiêu chuẩn Senior Developer với focus vào Performance, Security, và Maintainability.*
