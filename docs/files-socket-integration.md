# File Upload Socket Integration 📁🚀

## Overview

This implementation integrates file upload functionality with the real-time chat system following senior developer guidelines for **Clean Architecture** and **Separation of Concerns**.

## Architecture Decision

### ✅ Gateway in Socket Module (Implemented)
- **Reason**: Socket infrastructure already exists in Socket Module
- **Benefits**: 
  - Consistent WebSocket handling
  - Better separation of concerns
  - Easier to maintain and scale
  - Follows NestJS modular architecture

### ❌ Gateway in Files Module (Not Recommended)
- Would create tight coupling between files business logic and socket infrastructure
- Violates Single Responsibility Principle

## Implementation Structure

```
src/
├── socket/
│   ├── gateways/
│   │   ├── chat.gateway.ts           # Enhanced with file message support
│   │   └── file-upload.gateway.ts    # 🆕 Dedicated file upload WebSocket
│   ├── services/
│   │   └── file-chat-integration.service.ts  # 🆕 Bridge between file & chat
│   └── socket.module.ts              # Updated imports
├── modules/files/
│   └── (existing files services)     # No socket coupling
```

## Features Implemented

### 1. 🔄 File Upload Gateway (`/file-upload` namespace)
- **Chunked uploads** with real-time progress
- **Resume capability** using Redis sessions
- **Multi-device sync** for upload progress
- **Error handling** and retry logic
- **Auto-cleanup** on disconnect

### 2. 💬 Enhanced Chat Gateway
- **File message support** in conversations
- **File sharing** from completed uploads
- **Download URL generation** with security tokens
- **Real-time notifications** for file events

### 3. 🌉 File-Chat Integration Service
- **Event-driven architecture** using EventEmitter
- **File processing notifications**
- **Virus scan status updates**
- **Cross-namespace communication**

## WebSocket Events

### File Upload Namespace (`/file-upload`)

#### Client → Server
```typescript
// Initiate upload
emit('initiate_upload', {
    fileName: string,
    fileSize: number,
    mimeType: string,
    chunkSize?: number,
    uploadId: string
})

// Upload chunk
emit('upload_chunk', {
    sessionId: string,
    chunkIndex: number,
    chunkData: string, // base64
    uploadId: string
})

// Complete upload
emit('complete_upload', {
    sessionId: string,
    uploadId: string,
    fileName: string
})

// Cancel upload
emit('cancel_upload', {
    sessionId: string,
    uploadId: string,
    reason?: string
})
```

#### Server → Client
```typescript
// Upload progress
on('upload_progress', {
    uploadId: string,
    progress: number,
    completedChunks: number,
    totalChunks: number
})

// Upload completed
on('upload_completed', {
    uploadId: string,
    file: {
        id: string,
        fileName: string,
        downloadUrl: string
    }
})

// Upload errors
on('upload_error', { error: string })
on('chunk_error', { chunkIndex: number, error: string })
```

### Chat Namespace (`/chat`)

#### Enhanced Events
```typescript
// Share file in conversation
emit('share_file', {
    fileId: string,
    conversationId: string,
    message?: string
})

// Receive file messages
on('new_file_message', {
    id: string,
    conversationId: string,
    senderId: string,
    fileInfo: {
        id: string,
        fileName: string,
        downloadUrl: string
    }
})
```

## Redis Integration

### Upload Sessions
- **Session management** using `RedisChunkSessionService`
- **Progress tracking** with real-time updates
- **Auto-expiration** to prevent memory leaks
- **Multi-device consistency**

### Download Tokens
- **Secure access** using `RedisDownloadTokenService`
- **Granular permissions** (read, download, preview)
- **Usage tracking** and rate limiting
- **One-time tokens** for enhanced security

## Security Features

### File Validation
- **MIME type verification**
- **File size limits**
- **Virus scanning integration**
- **User permission checks**

### Access Control
- **JWT authentication** for WebSocket connections
- **User ownership verification**
- **Download token validation**
- **Rate limiting** on uploads/downloads

## Testing

### File Upload Test Page
Location: `file-upload-test.html`

Features:
- **Dual namespace connection** (file-upload + chat)
- **Chunked upload simulation** with progress visualization
- **File sharing** in conversations
- **Real-time event logging**
- **Error handling** demonstration

### Test Scenarios
1. **Large file upload** (>1MB chunks)
2. **Multi-device sync** (open multiple browser tabs)
3. **Network interruption** (disconnect/reconnect)
4. **File sharing** in conversations
5. **Permission testing** (invalid tokens)

## Usage Examples

### Frontend Integration

```javascript
// Connect to file upload namespace
const fileSocket = io('/file-upload', {
    auth: { token: 'jwt-token', deviceId: 'device-1' }
});

// Connect to chat namespace
const chatSocket = io('/chat', {
    auth: { token: 'jwt-token', deviceId: 'device-1' }
});

// Upload file
fileSocket.emit('initiate_upload', {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    uploadId: generateId()
});

// Listen for progress
fileSocket.on('upload_progress', (data) => {
    updateProgressBar(data.progress);
});

// Share completed file
chatSocket.emit('share_file', {
    fileId: uploadResult.file.id,
    conversationId: 'conv-123',
    message: 'Check out this document!'
});
```

### Mobile App Integration

```dart
// Flutter/Dart example
final fileSocket = IO.io('/file-upload', {
    'auth': {'token': jwtToken, 'deviceId': deviceId}
});

fileSocket.on('upload_progress', (data) {
    setState(() {
        uploadProgress = data['progress'];
    });
});
```

## Performance Optimizations

### Chunked Uploads
- **64KB default chunks** for optimal network usage
- **Parallel processing** where supported
- **Resume capability** for large files
- **Progress batching** to reduce UI updates

### Real-time Updates
- **Event batching** for high-frequency updates
- **Room-based broadcasting** for efficiency
- **Compression** for large payloads
- **Selective synchronization** based on user activity

## Deployment Considerations

### Environment Variables
```env
# File upload limits
MAX_FILE_SIZE=100MB
CHUNK_SIZE=64KB
MAX_CONCURRENT_UPLOADS=5

# Redis configuration
REDIS_TTL_UPLOAD_SESSION=3600
REDIS_TTL_DOWNLOAD_TOKEN=86400

# WebSocket limits
MAX_SOCKET_CONNECTIONS_PER_USER=10
```

### Scaling
- **Horizontal scaling** with Redis adapter
- **Load balancing** for WebSocket connections
- **CDN integration** for file downloads
- **Queue processing** for large file operations

## Monitoring

### Metrics to Track
- Upload success/failure rates
- Average upload time by file size
- Concurrent uploads per user
- Redis memory usage
- WebSocket connection count

### Alerts
- Failed upload rate > 5%
- Redis memory usage > 80%
- Socket connection errors
- File processing queue backup

## Future Enhancements

### Planned Features
1. **Video thumbnail generation**
2. **Image compression/optimization**
3. **Bulk file operations**
4. **Advanced file sharing permissions**
5. **File version control**

### Mobile Optimizations
1. **Adaptive chunk sizing** based on network
2. **Background upload** capability
3. **Offline queuing**
4. **Battery optimization**

## Migration Guide

### From Basic HTTP Upload
1. Update frontend to use WebSocket connection
2. Implement chunked upload logic
3. Add progress tracking UI
4. Handle file sharing in chat

### Testing Migration
1. Run both systems in parallel
2. A/B test with user groups
3. Monitor performance metrics
4. Gradual rollout based on file size

---

## 🎯 Senior Developer Principles Applied

✅ **Clean Architecture**: Clear separation between socket, files, and chat concerns  
✅ **SOLID Principles**: Single responsibility for each service  
✅ **Security First**: JWT auth, token validation, rate limiting  
✅ **Performance**: Redis caching, chunked uploads, real-time optimization  
✅ **Scalability**: Namespace separation, event-driven architecture  
✅ **Maintainability**: Comprehensive documentation, testing tools  
✅ **Fast Delivery**: Working MVP with extension points for future features  

This implementation provides a robust, scalable file upload system that integrates seamlessly with the existing chat infrastructure while maintaining clean architecture principles.
