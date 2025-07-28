# Files Module

## 📋 Overview

Files Module cung cấp comprehensive file handling capabilities cho chat application, bao gồm upload, download, processing, và security features theo Zalo/Messenger pattern.

## 🏗️ Architecture

### Clean Architecture Layers:
- **Entities**: Database schemas (File, MessageAttachment, ChunkUploadSession)
- **Repositories**: Data access interfaces và implementations  
- **Services**: Business logic (upload, processing, validation)
- **Controllers**: HTTP API endpoints
- **DTOs**: Request/response validation

### Key Design Patterns:
- **Repository Pattern**: Abstraction cho data access
- **Strategy Pattern**: Multiple storage providers (S3, Local, etc.)
- **Chain of Responsibility**: File processing pipeline
- **Observer Pattern**: Upload progress notifications

## 📊 Database Schema

### Files Collection
```typescript
{
  fileId: string,           // UUID v4
  originalFilename: string,
  fileName: string,         // Stored filename
  mimeType: string,
  fileSize: number,         // Bytes
  checksum: string,         // SHA-256 for deduplication
  storagePath: string,      // Storage location
  thumbnailPath?: string,   // Generated thumbnail
  uploadedBy: string,       // User ID
  isProcessed: boolean,     // Processing status
  virusScanStatus: string,  // Security scan result
  isActive: boolean,        // Soft delete flag
  downloadCount: number,    // Usage tracking
  lastAccessedAt?: Date,    // For cleanup
  metadata?: object,        // File-specific metadata
  createdAt: Date,
  updatedAt: Date
}
```

### Message Attachments Collection (Junction Table)
```typescript
{
  messageId: string,        // Reference to Message
  fileId: string,          // Reference to File
  caption?: string,        // Optional caption for images
  attachmentOrder: number, // Order in message
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Chunk Upload Sessions Collection
```typescript
{
  uploadId: string,         // UUID for upload session
  userId: string,
  originalFilename: string,
  totalSize: number,
  totalChunks: number,
  uploadedChunks: number,
  completedChunkIndexes: number[],
  status: string,           // uploading, completed, failed
  finalFileId?: string,
  checksum?: string,
  expiresAt: Date          // TTL for cleanup
}
```

## 🔧 Configuration

### Environment Variables
```env
# Storage Configuration
STORAGE_TYPE=s3           # or 'local'
AWS_S3_BUCKET=your-bucket
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1

# File Limits
MAX_FILE_SIZE_IMAGE=25MB
MAX_FILE_SIZE_VIDEO=100MB
MAX_FILE_SIZE_DOCUMENT=50MB
CHUNK_SIZE=2MB
MAX_PARALLEL_CHUNKS=3

# Security
VIRUS_SCANNING_ENABLED=true
VIRUS_SCAN_TIMEOUT=30000
FILE_ENCRYPTION_ENABLED=false

# Cleanup
UNUSED_FILE_CLEANUP_DAYS=7
DOWNLOAD_URL_EXPIRY=3600
```

## 🚀 Features

### ✅ File Upload
- **Single Upload**: Files < 10MB
- **Chunked Upload**: Files > 10MB với resumable capability
- **Progress Tracking**: Real-time upload progress
- **Validation**: File type, size, content validation
- **Deduplication**: SHA-256 checksum-based duplicate detection

### ✅ File Processing
- **Thumbnail Generation**: Auto-generate thumbnails cho images/videos
- **Metadata Extraction**: Width, height, duration, encoding info
- **Compression**: Smart compression based on file type
- **Format Conversion**: Convert to web-optimized formats

### ✅ Security
- **Virus Scanning**: ClamAV integration cho malware detection
- **Access Control**: Token-based download URLs
- **Rate Limiting**: Download limits per user
- **Content Validation**: Verify file content matches extension

### ✅ Performance
- **CDN Integration**: Fast file delivery
- **Caching Strategy**: Multi-tier caching (hot/warm/cold)
- **Lazy Loading**: On-demand file processing
- **Cleanup Jobs**: Automated unused file cleanup

## 📡 API Endpoints

### File Upload
```bash
# Single file upload (< 10MB)
POST /files/upload
Content-Type: multipart/form-data

# Initiate chunked upload (> 10MB)
POST /files/upload/init
Body: { fileName, fileSize, mimeType }

# Upload chunk
POST /files/upload/chunk/:uploadId/:chunkIndex
Content-Type: multipart/form-data

# Complete chunked upload
POST /files/upload/complete/:uploadId
```

### File Management
```bash
# Get file info
GET /files/:fileId

# Get user files
GET /files/user
Query: ?limit=20&skip=0&sortBy=createdAt&sortOrder=desc

# Generate download URL
POST /files/:fileId/download-url
Body: { expiresIn?: 3600 }

# Delete file
DELETE /files/:fileId
```

### Message Integration
```bash
# Link file to message
POST /files/link-to-message
Body: { fileId, messageId, caption? }

# Get message attachments
GET /files/message/:messageId/attachments
```

## 🔄 Usage Examples

### Simple File Upload
```typescript
const formData = new FormData();
formData.append('file', fileBlob);

const response = await fetch('/files/upload', {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const result = await response.json();
// { fileId, fileName, downloadUrl, thumbnailUrl }
```

### Chunked Upload with Progress
```typescript
// 1. Initiate upload
const initResponse = await fetch('/files/upload/init', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type
  })
});

const { uploadId, chunkSize } = await initResponse.json();

// 2. Upload chunks
const chunks = Math.ceil(file.size / chunkSize);
for (let i = 0; i < chunks; i++) {
  const start = i * chunkSize;
  const end = Math.min(start + chunkSize, file.size);
  const chunk = file.slice(start, end);
  
  const formData = new FormData();
  formData.append('chunk', chunk);
  
  await fetch(`/files/upload/chunk/${uploadId}/${i}`, {
    method: 'POST',
    body: formData
  });
}

// 3. Complete upload
const completeResponse = await fetch(`/files/upload/complete/${uploadId}`, {
  method: 'POST'
});

const result = await completeResponse.json();
```

### Send File Message
```typescript
// 1. Upload file first
const uploadResult = await uploadFile(file);

// 2. Send message with file
const messageResponse = await fetch('/messages/file', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversationId: 'conv_123',
    fileIds: [uploadResult.fileId],
    message: 'Check this document!' // Optional
  })
});
```

## 🧪 Testing

### Unit Tests
```bash
npm run test src/modules/files
```

### Integration Tests
```bash
npm run test:e2e files
```

### Load Testing
```bash
# Test chunked upload performance
npm run test:load files/upload
```

## 📈 Monitoring

### Metrics to Track
- Upload success/failure rates
- Average upload/download times
- Storage usage by file type
- Virus scan results
- CDN cache hit rates

### Health Checks
- Storage connectivity
- Virus scanner status
- Database connection
- Processing queue health

## 🔧 Troubleshooting

### Common Issues
1. **Upload Timeouts**: Increase chunk size, check network
2. **Virus Scan Failures**: Verify ClamAV configuration
3. **Storage Errors**: Check S3 credentials và permissions
4. **Memory Issues**: Optimize file processing buffer sizes

### Debug Commands
```bash
# Check storage connectivity
npm run debug:storage

# Verify virus scanner
npm run debug:virus-scan

# Test file processing
npm run debug:file-process
```

## 🚀 Deployment

### Production Checklist
- [ ] Configure S3 bucket với proper permissions
- [ ] Setup ClamAV virus scanner
- [ ] Configure CDN for file delivery
- [ ] Setup monitoring and alerts
- [ ] Test backup và recovery procedures
- [ ] Configure auto-scaling for processing jobs

---

## 📝 Next Steps

1. **Phase 1**: Basic upload/download functionality
2. **Phase 2**: Chunked upload implementation  
3. **Phase 3**: File processing pipeline
4. **Phase 4**: Security features (virus scan, access control)
5. **Phase 5**: Performance optimization (CDN, caching)
6. **Phase 6**: Advanced features (compression, format conversion)
