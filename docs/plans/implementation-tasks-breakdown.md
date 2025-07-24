# 📋 Kế Hoạch Triển Khai Chi Tiết - Hệ Thống Nhắn Tin & File Riêng Biệt

## 🎯 Tổng Quan
Triển khai hệ thống nhắn tin theo mô hình Zalo với 2 module riêng biệt:
- **Messages Module**: Xử lý tin nhắn văn bản, hệ thống
- **Files Module**: Xử lý upload, lưu trữ, quản lý file

## 📊 Hiện Trạng Codebase
✅ **Đã có**: Conversations Module, User/Auth modules, Database connection, Redis
✅ **Đã có**: Schemas cho Messages (cần cập nhật), Type definitions  
❌ **Chưa có**: Files Module hoàn chỉnh, API endpoints, WebSocket handlers
❌ **Chưa có**: Messages Module hoàn chỉnh

---

## 🔥 PHASE 1: FILES MODULE - CORE FOUNDATION

### 1.1 Database Schema & Models
```typescript
// 📁 src/modules/files/schemas/file.schema.ts
- File entity với checksum deduplication
- File metadata (size, type, dimensions)
- Storage provider integration
- Virus scan status
```

```typescript
// 📁 src/modules/files/schemas/file-attachment.schema.ts  
- MessageAttachment linking table
- File-to-message relationships
- Attachment metadata
```

**Công việc cụ thể:**
- [ ] Tạo `file.schema.ts` với các fields: fileId, originalName, mimeType, size, checksum, storageProvider, storagePath, uploadStatus, scanResult
- [ ] Tạo `file-attachment.schema.ts` với relationships: messageId, fileId, attachmentOrder
- [ ] Tạo `file-thumbnail.schema.ts` cho image/video thumbnails
- [ ] Export schemas trong `schemas/index.ts`

### 1.2 Repository Layer
```typescript
// 📁 src/modules/files/repositories/file.repository.ts
- findByChecksum() - deduplication
- createFile() - save metadata  
- findByIds() - batch loading
- updateScanResult() - virus scan
```

**Công việc cụ thể:**
- [ ] Interface `IFileRepository` với methods: findByChecksum, createFile, findByIds, updateScanResult, deleteFile
- [ ] Implementation `FileRepository` với MongoDB queries
- [ ] Batch operations cho performance
- [ ] Error handling & logging

### 1.3 Service Layer
```typescript
// 📁 src/modules/files/services/file-upload.service.ts
- uploadFile() - main upload logic
- validateFile() - security checks
- generateThumbnails() - image processing
- deduplicateFile() - checksum check
```

```typescript
// 📁 src/modules/files/services/file-storage.service.ts
- saveToStorage() - provider abstraction
- getFileUrl() - signed URLs
- deleteFromStorage() - cleanup
```

**Công việc cụ thể:**
- [ ] `FileUploadService` với validation, checksum calculation, deduplication
- [ ] `FileStorageService` với LOCAL/S3 providers
- [ ] `FileThumbnailService` cho image/video processing
- [ ] `FileSecurityService` cho virus scanning (mock implementation)
- [ ] Error handling cho từng service

### 1.4 Controller Layer
```typescript
// 📁 src/modules/files/controllers/file-upload.controller.ts
POST /files/upload - Upload single file
POST /files/upload-multiple - Upload multiple files  
GET /files/:fileId - Get file metadata
GET /files/:fileId/download - Download file
DELETE /files/:fileId - Delete file
```

**Công việc cụ thể:**
- [ ] Upload endpoints với Multer integration
- [ ] File validation middleware
- [ ] Rate limiting cho uploads
- [ ] Swagger documentation
- [ ] Response DTOs cho file metadata

### 1.5 DTOs & Validation
```typescript
// 📁 src/modules/files/dto/
- upload-file.dto.ts - Upload request validation
- file-response.dto.ts - API responses
- file-query.dto.ts - Search/filter params
```

**Công việc cụ thể:**
- [ ] `UploadFileDto` với file constraints
- [ ] `FileResponseDto` cho API responses
- [ ] `FileQueryDto` cho filtering
- [ ] Validation pipes cho file size, type

### 1.6 Module Configuration
```typescript
// 📁 src/modules/files/files.module.ts
- Configure Multer
- Register schemas
- Export services for Messages module
```

**Công việc cụ thể:**
- [ ] Module setup với dependencies
- [ ] Multer configuration
- [ ] Provider exports
- [ ] Import trong App module

---

## 🔥 PHASE 2: MESSAGES MODULE - CORE MESSAGING

### 2.1 Update Existing Schemas
```typescript
// 📁 src/modules/messages/schemas/message.schema.ts (UPDATE)
- Remove file-related fields
- Keep only: content, messageType, replyTo
- Focus on text messaging core
```

**Công việc cụ thể:**
- [ ] Refactor `message.schema.ts` - remove attachment fields
- [ ] Update `MessageType` enum usage
- [ ] Keep schema lean and focused
- [ ] Update existing repository methods

### 2.2 Repository Layer
```typescript
// 📁 src/modules/messages/repositories/message.repository.ts (UPDATE)
- createTextMessage() - text only
- createSystemMessage() - notifications
- findByConversation() - pagination
- updateMessageStatus() - read/delivered
```

**Công việc cụ thể:**
- [ ] Update existing repository methods
- [ ] Add pagination support
- [ ] Add message status tracking
- [ ] Optimize queries cho performance

### 2.3 Service Layer
```typescript
// 📁 src/modules/messages/services/message.service.ts
- sendTextMessage() - core messaging
- sendSystemMessage() - notifications  
- getConversationMessages() - with pagination
- markAsRead() - status updates
```

**Công việc cụ thể:**
- [ ] `MessageService` với core business logic
- [ ] Integration với Conversations module
- [ ] Real-time notifications
- [ ] Message validation & sanitization

### 2.4 WebSocket Gateway
```typescript
// 📁 src/modules/messages/gateways/message.gateway.ts
- handleSendMessage() - real-time messaging
- handleTyping() - typing indicators
- handleMessageRead() - read receipts
```

**Công việc cụ thể:**
- [ ] WebSocket events cho real-time
- [ ] Room management cho conversations
- [ ] Authentication middleware
- [ ] Error handling & reconnection

### 2.5 Controller Layer
```typescript
// 📁 src/modules/messages/controllers/message.controller.ts
POST /messages/send - Send text message
GET /conversations/:id/messages - Get messages
PUT /messages/:id/read - Mark as read
DELETE /messages/:id - Delete message
```

**Công việc cụ thể:**
- [ ] REST API endpoints
- [ ] Pagination support
- [ ] Validation & error handling
- [ ] Swagger documentation

### 2.6 Module Update
```typescript
// 📁 src/modules/messages/messages.module.ts (CREATE)
- Import Files module for attachments
- Register all providers
- Export services
```

**Công việc cụ thể:**
- [ ] Tạo messages.module.ts file
- [ ] Configure dependencies
- [ ] Import FilesModule
- [ ] Export để Conversations sử dụng

---

## 🔥 PHASE 3: INTEGRATION LAYER - CONNECTING MODULES

### 3.1 Message-Attachment Bridge Service
```typescript
// 📁 src/modules/messages/services/message-attachment.service.ts
- attachFilesToMessage() - link files to messages
- getMessageWithAttachments() - complete data
- detachFiles() - cleanup on delete
```

**Công việc cụ thể:**
- [ ] Bridge service giữa Messages và Files
- [ ] Bulk attachment operations
- [ ] Transaction support
- [ ] Cleanup on message delete

### 3.2 Enhanced Message Service
```typescript
// 📁 src/modules/messages/services/enhanced-message.service.ts
- sendMessageWithFiles() - combined operation
- getMessagesWithAttachments() - join queries
- deleteMessageWithFiles() - cascade delete
```

**Công việc cụ thể:**
- [ ] Enhanced service với file support
- [ ] Optimized join queries
- [ ] Cascade operations
- [ ] Performance monitoring

### 3.3 API Composition Layer
```typescript
// 📁 src/modules/messages/controllers/enhanced-message.controller.ts
POST /messages/send-with-files - Upload files + send message
GET /conversations/:id/messages-with-files - Complete message data
```

**Công việc cụ thể:**
- [ ] Composite API endpoints
- [ ] Transaction handling
- [ ] Rollback on failures
- [ ] Response optimization

---

## 🔥 PHASE 4: ADVANCED FEATURES

### 4.1 Performance Optimization
```typescript
// 📁 src/modules/messages/services/message-cache.service.ts
- Cache frequent conversations
- Preload attachments metadata
- Redis integration
```

**Công việc cụ thể:**
- [ ] Redis caching layer
- [ ] Cache invalidation strategies
- [ ] Preloading mechanisms
- [ ] Performance metrics

### 4.2 Security & Validation
```typescript
// 📁 src/shared/guards/file-security.guard.ts
- File type validation
- Size limits
- Virus scanning integration
```

**Công việc cụ thể:**
- [ ] Security guards
- [ ] File validation pipes
- [ ] Rate limiting
- [ ] Audit logging

### 4.3 Real-time Enhancements
```typescript
// 📁 src/modules/messages/gateways/enhanced-message.gateway.ts
- File upload progress
- Message with attachments events
- Typing with file indicators
```

**Công việc cụ thể:**
- [ ] Enhanced WebSocket events
- [ ] Upload progress tracking
- [ ] Rich presence indicators
- [ ] Error recovery

---

## 📋 DEVELOPMENT CHECKLIST

### ✅ Files Module (Độc lập hoàn toàn)
- [ ] File schema & models
- [ ] File repository với deduplication
- [ ] Upload service với validation
- [ ] Storage service (LOCAL first)
- [ ] File controller với REST API
- [ ] DTOs & validation
- [ ] Module configuration
- [ ] Unit tests

### ✅ Messages Module (Text messaging core)
- [ ] Update message schema (remove file fields)
- [ ] Message repository
- [ ] Message service
- [ ] WebSocket gateway
- [ ] Message controller
- [ ] Module configuration
- [ ] Unit tests

### ✅ Integration Layer (Kết nối 2 modules)
- [ ] Message-attachment bridge service
- [ ] Enhanced message service
- [ ] Composite API endpoints
- [ ] Transaction handling
- [ ] Integration tests

### ✅ Advanced Features
- [ ] Caching layer
- [ ] Security enhancements
- [ ] Performance optimization
- [ ] Real-time features
- [ ] E2E tests

---

## 🚀 DEPLOYMENT STRATEGY

### Development Order:
1. **Files Module** (hoàn toàn độc lập)
2. **Messages Module** (text-only, không phụ thuộc Files)
3. **Integration Layer** (kết nối 2 modules)
4. **Advanced Features** (optimization)

### Testing Strategy:
- Unit tests cho từng service
- Integration tests cho module interactions
- E2E tests cho complete flows
- Performance tests cho scalability

### Rollout Plan:
- Phase 1: Files Module deploy
- Phase 2: Messages Module deploy  
- Phase 3: Integration enable
- Phase 4: Advanced features enable

---

## 💡 TECHNICAL DECISIONS

### Database Strategy:
- **Separate collections**: `messages`, `files`, `message_attachments`
- **Deduplication**: SHA-256 checksum cho files
- **Indexing**: Compound indexes cho performance

### API Strategy:
- **Separate endpoints**: `/messages/*` và `/files/*`
- **Composite endpoints**: `/messages/send-with-files`
- **Pagination**: Cursor-based cho messages

### Real-time Strategy:
- **WebSocket**: Real-time messaging
- **Events**: Separate events cho messages và files
- **Rooms**: Conversation-based rooms

Bạn muốn bắt đầu từ module nào trước? Files Module hay Messages Module?
