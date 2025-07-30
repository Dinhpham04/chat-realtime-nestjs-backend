# 📚 Files API - Comprehensive Swagger Documentation

## 🎯 Overview

Files Controller đã được cập nhật với **comprehensive Swagger documentation** bao gồm:

### ✅ Enhanced Documentation Features

1. **Detailed Descriptions**: Mỗi endpoint có mô tả chi tiết về:
   - Mục đích và use cases
   - Các tính năng chính
   - Yêu cầu bảo mật
   - Hướng dẫn sử dụng step-by-step

2. **Complete Parameter Documentation**:
   - `@ApiParam`: Path parameters với examples và validation rules
   - `@ApiQuery`: Query parameters với enum values và constraints
   - `@ApiBody`: Request body schemas với examples thực tế

3. **Rich Response Examples**:
   - Success responses với data structure chi tiết
   - Error responses với error codes và messages
   - Multiple example scenarios cho mỗi endpoint

4. **Request/Response Schemas**:
   - Detailed type definitions
   - Validation constraints (min/max, required fields)
   - Format specifications (UUID, binary, etc.)

## 📋 API Endpoints Documentation

### 1. **POST /files/upload** - Single File Upload
```yaml
Parameters:
  - file: binary (multipart/form-data)
    - Required: true
    - Max size: 500MB (videos), 100MB (documents), 50MB (images/audio)
    - Supported types: Images, Videos, Documents, Audio, Archives

Response Example:
{
  "success": true,
  "message": "File uploaded successfully",  
  "data": {
    "fileId": "550e8400-e29b-41d4-a716-446655440000",
    "fileName": "user_profile_image_abc123.jpg",
    "originalName": "my-photo.jpg",
    "fileSize": 2048576,
    "mimeType": "image/jpeg",
    "downloadUrl": "/files/download/550e8400.../token=abc123...",
    "thumbnailUrl": "/files/preview/550e8400.../token=def456...",
    "isNew": true,
    "uploadedAt": "2025-07-29T10:30:00.000Z"
  }
}
```

### 2. **POST /files/upload/batch** - Multiple Files Upload
```yaml
Parameters:
  - files: array of binary files (max 10 files)
    - Each file follows same validation as single upload
    - Parallel processing with error handling per file

Response Example:
{
  "success": true,
  "message": "Batch upload completed: 8/10 files uploaded successfully",
  "data": {
    "uploadedFiles": [...],
    "totalFiles": 10,
    "successCount": 8,
    "failedCount": 2,
    "errors": [
      {"fileName": "invalid.txt", "error": "Unsupported file type"},
      {"fileName": "toolarge.mp4", "error": "File size exceeds maximum limit"}
    ]
  }
}
```

### 3. **GET /files/:fileId** - Get File Details
```yaml
Parameters:
  - fileId: UUID (path parameter)
    - Format: 550e8400-e29b-41d4-a716-446655440000
    - Required: true

Response Example:
{
  "success": true,
  "data": {
    "fileId": "550e8400-e29b-41d4-a716-446655440000",
    "fileName": "user_document_abc123.pdf",
    "originalName": "my-document.pdf",
    "mimeType": "application/pdf",
    "fileSize": 2048576,
    "uploadedBy": "123e4567-e89b-12d3-a456-426614174000",
    "uploadedAt": "2025-07-29T10:30:00.000Z",
    "downloadCount": 5,
    "isProcessed": true,
    "virusScanStatus": "clean",
    "metadata": {
      "pages": 10,
      "author": "John Doe"
    }
  }
}
```

### 4. **POST /files/:fileId/download-url** - Generate Download URL
```yaml
Parameters:
  - fileId: UUID (path parameter)
  - Body:
    - expiresIn: number (60-86400 seconds, default: 3600)
    - oneTimeUse: boolean (default: false)
    - allowedIps: string[] (optional IP restrictions)

Examples:
- Standard 1-hour URL: {"expiresIn": 3600, "oneTimeUse": false}
- One-time download: {"expiresIn": 86400, "oneTimeUse": true}
- IP-restricted: {"expiresIn": 7200, "allowedIps": ["192.168.1.100"]}

Response:
{
  "downloadUrl": "https://api.../files/download/550e8400.../token=eyJhbGc...",
  "expiresAt": "2025-07-29T11:30:00.000Z"
}
```

### 5. **GET /files** - Get User Files (Paginated)
```yaml
Query Parameters:
  - limit: number (1-100, default: 20)
  - skip: number (default: 0)
  - sortBy: enum [uploadDate, fileSize, fileName, downloadCount]
  - sortOrder: enum [asc, desc]
  - fileType: enum [images, videos, documents, audio, archives]
  - searchQuery: string (max 100 chars)

Response Example:
{
  "success": true,
  "data": {
    "files": [...],
    "pagination": {
      "total": 150,
      "limit": 20,
      "skip": 0,
      "hasMore": true
    }
  }
}
```

### 6. **POST /files/:fileId/link-message** - Link File to Message
```yaml
Parameters:
  - fileId: UUID (path parameter)
  - Body:
    - messageId: UUID (required)
    - caption: string (optional, max 500 chars)
    - attachmentOrder: number (optional, min: 1)

Examples:
- Simple: {"messageId": "123e4567-e89b-12d3-a456-426614174000"}
- With caption: {"messageId": "...", "caption": "Updated document"}
- Specific order: {"messageId": "...", "caption": "Image 1 of 3", "attachmentOrder": 1}
```

### 7. **GET /files/download/:fileId** - Secure Download (Public)
```yaml
Parameters:
  - fileId: UUID (path parameter)
  - token: string (query parameter, required)
    - Generated via download-url endpoint
    - Time-limited and secure

Response:
  - Binary file content with appropriate headers
  - Content-Type: file's MIME type
  - Content-Disposition: attachment with filename
  - Content-Length: file size in bytes
```

### 8. **GET /files/preview/:fileId** - Secure Preview (Public)
```yaml
Parameters:
  - fileId: UUID (path parameter)  
  - token: string (query parameter, required)

Response:
  - Binary content for inline viewing
  - Content-Disposition: inline (not attachment)
  - Cache-Control: optimized for browser caching
  - Supports: Images, PDFs, Text, Audio, Video
```

## 🔒 Security & Authentication

### JWT Authentication
- **Required for**: All endpoints except download/preview
- **Header**: `Authorization: Bearer <jwt_token>`
- **Scope**: User can only access their own files

### Token-Based Download/Preview
- **Public endpoints**: No JWT required
- **Security**: Redis-based secure tokens
- **Features**: Time expiration, IP restrictions, one-time use
- **Generation**: Via authenticated download-url endpoint

## 📊 Error Handling

### Standard Error Format
```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {} // Additional context when available
}
```

### Common Error Codes
- `VALIDATION_FAILED`: File validation errors
- `FILE_TOO_LARGE`: Size limit exceeded
- `UNSUPPORTED_TYPE`: Invalid file type
- `FILE_NOT_FOUND`: File doesn't exist
- `ACCESS_DENIED`: Permission denied
- `TOKEN_EXPIRED`: Download token expired
- `RATE_LIMIT_EXCEEDED`: Too many requests

## 🚀 Best Practices

### For Developers
1. **File Upload**: Use multipart/form-data with proper field names
2. **Large Files**: Consider chunked upload for files >10MB
3. **Security**: Always validate file types on client side too
4. **Performance**: Use pagination for file listings
5. **Error Handling**: Check both success field and HTTP status

### For Frontend Integration
1. **Progress Tracking**: Implement upload progress bars
2. **Retry Logic**: Handle network failures gracefully
3. **Caching**: Cache file metadata for better UX
4. **Preview**: Use preview endpoint for thumbnails
5. **Batch Operations**: Group multiple file operations

## 📱 Mobile App Integration

### Upload Flow
```javascript
// Single file upload
const formData = new FormData();
formData.append('file', fileBlob, 'filename.jpg');

fetch('/files/upload', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + jwt_token
  },
  body: formData
});
```

### Download Flow
```javascript
// Generate download URL
const response = await fetch(`/files/${fileId}/download-url`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + jwt_token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    expiresIn: 3600,
    oneTimeUse: false
  })
});

const {downloadUrl} = await response.json();
// Use downloadUrl directly in browser or download manager
```

## 📈 Monitoring & Analytics

### Admin Endpoints
- **GET /files/admin/statistics**: Comprehensive file statistics
- **GET /files/admin/test**: Health check endpoint

### Metrics Available
- Total files count and storage usage
- File type distribution
- Upload trends and patterns
- Download analytics
- Performance metrics

---

## ✨ What's New in This Documentation

1. **Comprehensive Examples**: Real-world request/response examples
2. **Parameter Details**: Complete parameter documentation with constraints
3. **Error Scenarios**: Detailed error handling and codes
4. **Use Case Guidance**: When and how to use each endpoint
5. **Integration Examples**: Code samples for common scenarios
6. **Security Documentation**: Authentication and authorization details
7. **Best Practices**: Guidelines for optimal usage
8. **Mobile-First**: Examples optimized for mobile app integration

Swagger UI sẽ hiển thị tất cả thông tin này một cách interactive, cho phép developers test API trực tiếp và hiểu rõ cách sử dụng từng endpoint! 🎉
