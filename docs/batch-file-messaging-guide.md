# Batch File Messaging Implementation Guide

## 🎯 Tổng quan Multiple Files Support

Hệ thống messaging đã được mở rộng để support **batch file uploads** và **multiple file messages** với 4 approaches khác nhau để tối ưu cho các use cases khác nhau.

---

## 📋 Architecture Overview

### Single File vs Batch Files

```typescript
// Single File
socket.emit('send_message', {
    type: 'image',
    fileId: 'single_file_id'  // hoặc fileMetadata
});

// Multiple Files 
socket.emit('send_message', {
    type: 'file',
    fileIds: ['file1', 'file2', 'file3']  // hoặc filesMetadata
});

// Dedicated Batch Handler
socket.emit('batch_share_files', {
    fileIds: ['file1', 'file2', 'file3'],
    conversationId: 'conv_123'
});
```

---

## 🚀 **4 Approaches cho File Messaging**

### 1️⃣ **Single File + FileId (Secure)**
```typescript
// Client
const uploadResult = await uploadFile(file);
socket.emit('send_message', {
    localId: generateId(),
    conversationId: 'conv_123',
    content: 'Check this image!',
    type: 'image',
    fileId: uploadResult.fileId  // Backend queries metadata
});
```

### 2️⃣ **Single File + Metadata (Performance)**
```typescript
// Client
const uploadResult = await uploadFile(file);
socket.emit('send_message', {
    localId: generateId(), 
    conversationId: 'conv_123',
    content: 'Check this image!',
    type: 'image',
    fileMetadata: {
        fileId: uploadResult.fileId,
        fileName: uploadResult.fileName,
        downloadUrl: uploadResult.downloadUrl,
        thumbnailUrl: uploadResult.thumbnailUrl,
        // ... other metadata
    }
});
```

### 3️⃣ **Batch Files + FileIds (Secure)**
```typescript
// Client 
const uploadResults = await uploadMultipleFiles(files);
socket.emit('send_message', {
    localId: generateId(),
    conversationId: 'conv_123', 
    content: 'Here are some files!',
    type: 'file',
    fileIds: uploadResults.map(r => r.fileId)  // Backend queries all metadata
});
```

### 4️⃣ **Batch Files + Metadata (High Performance)**
```typescript
// Client
const uploadResults = await uploadMultipleFiles(files);
socket.emit('send_message', {
    localId: generateId(),
    conversationId: 'conv_123',
    content: 'Here are some files!',
    type: 'file', 
    filesMetadata: uploadResults.map(r => ({
        fileId: r.fileId,
        fileName: r.fileName,
        downloadUrl: r.downloadUrl,
        thumbnailUrl: r.thumbnailUrl,
        // ... other metadata
    }))
});
```

---

## 📱 Client Implementation Examples

### React/TypeScript - Batch File Upload

```typescript
class BatchFileService {
    private socket: Socket;

    async sendMultipleFiles(files: File[], conversationId: string, message?: string) {
        try {
            // 1. Upload tất cả files via HTTP API
            const uploadPromises = files.map(file => this.uploadFile(file));
            const uploadResults = await Promise.all(uploadPromises);
            
            // 2. Determine approach based on file count and network
            if (files.length === 1) {
                // Single file - use secure approach
                return this.sendSingleFile(uploadResults[0], conversationId, message);
            } else {
                // Multiple files - use batch approach
                return this.sendBatchFiles(uploadResults, conversationId, message);
            }
            
        } catch (error) {
            console.error('Failed to send multiple files:', error);
            throw error;
        }
    }

    private async sendSingleFile(uploadResult: UploadResult, conversationId: string, message?: string) {
        const messageType = this.determineMessageType(uploadResult.mimeType);
        
        // Use secure approach for single file
        this.socket.emit('send_message', {
            localId: `msg_${Date.now()}_${Math.random()}`,
            conversationId,
            content: message || '',
            type: messageType,
            fileId: uploadResult.fileId  // Let backend query metadata
        });
    }

    private async sendBatchFiles(uploadResults: UploadResult[], conversationId: string, message?: string) {
        const isHighPerformanceMode = this.shouldUseHighPerformanceMode(uploadResults.length);
        
        if (isHighPerformanceMode) {
            // Approach 4: High performance with metadata
            this.socket.emit('send_message', {
                localId: `batch_${Date.now()}_${Math.random()}`,
                conversationId,
                content: message || '',
                type: 'file',
                filesMetadata: uploadResults.map(result => ({
                    fileId: result.fileId,
                    fileName: result.fileName,
                    fileSize: result.fileSize,
                    mimeType: result.mimeType,
                    downloadUrl: result.downloadUrl,
                    thumbnailUrl: result.thumbnailUrl,
                    duration: result.duration,
                    dimensions: result.dimensions
                }))
            });
        } else {
            // Approach 3: Secure with fileIds only
            this.socket.emit('send_message', {
                localId: `batch_${Date.now()}_${Math.random()}`,
                conversationId,
                content: message || '',
                type: 'file',
                fileIds: uploadResults.map(result => result.fileId)
            });
        }
    }

    private shouldUseHighPerformanceMode(fileCount: number): boolean {
        // Use high performance mode for large batches or mobile
        return fileCount > 5 || this.isMobile();
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
            throw new Error(`Upload failed for ${file.name}`);
        }
        
        return response.json();
    }

    // Alternative: Dedicated batch handler
    async quickShareMultipleFiles(uploadResults: UploadResult[], conversationId: string, message?: string) {
        this.socket.emit('batch_share_files', {
            fileIds: uploadResults.map(r => r.fileId),
            conversationId,
            message,
            filesMetadata: uploadResults.map(r => ({
                fileName: r.fileName,
                fileSize: r.fileSize,
                mimeType: r.mimeType,
                downloadUrl: r.downloadUrl,
                thumbnailUrl: r.thumbnailUrl,
                duration: r.duration,
                dimensions: r.dimensions
            }))
        });
    }
}
```

### React Native - Mobile Optimized

```typescript
class MobileBatchFileService {
    async pickAndSendMultipleFiles(conversationId: string): Promise<void> {
        try {
            // Pick multiple files
            const results = await DocumentPicker.pickMultiple({
                type: [DocumentPicker.types.allFiles],
                copyTo: 'cachesDirectory'
            });
            
            // Show upload progress
            this.showUploadProgress(results.length);
            
            // Upload với progress tracking
            const uploadResults = await this.uploadFilesWithProgress(results);
            
            // Send với high performance approach (metadata)
            await this.sendBatchFilesOptimized(uploadResults, conversationId);
            
        } catch (error) {
            if (!DocumentPicker.isCancel(error)) {
                console.error('File picking failed:', error);
            }
        }
    }

    private async uploadFilesWithProgress(files: any[]): Promise<UploadResult[]> {
        const results: UploadResult[] = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            try {
                const uploadResult = await this.uploadSingleFile(file);
                results.push(uploadResult);
                
                // Update progress
                this.updateProgress((i + 1) / files.length);
                
            } catch (error) {
                console.error(`Failed to upload ${file.name}:`, error);
                // Continue with other files
            }
        }
        
        return results;
    }

    private async sendBatchFilesOptimized(uploadResults: UploadResult[], conversationId: string) {
        // Mobile: Always use high performance approach
        socket.emit('send_message', {
            localId: `mobile_batch_${Date.now()}`,
            conversationId,
            content: this.generateBatchMessage(uploadResults),
            type: 'file',
            filesMetadata: uploadResults.map(result => ({
                fileId: result.fileId,
                fileName: result.fileName,
                fileSize: result.fileSize,
                mimeType: result.mimeType,
                downloadUrl: result.downloadUrl,
                thumbnailUrl: result.thumbnailUrl,
                duration: result.duration,
                dimensions: result.dimensions
            }))
        });
    }

    private generateBatchMessage(uploadResults: UploadResult[]): string {
        const types = this.categorizeFiles(uploadResults);
        const descriptions = [];
        
        if (types.images > 0) descriptions.push(`${types.images} ảnh`);
        if (types.videos > 0) descriptions.push(`${types.videos} video`);
        if (types.documents > 0) descriptions.push(`${types.documents} tài liệu`);
        if (types.others > 0) descriptions.push(`${types.others} tệp khác`);
        
        return descriptions.length > 0 ? descriptions.join(', ') : `${uploadResults.length} tệp`;
    }
}
```

---

## 🎯 Server Response Events

### Single File Message Response
```typescript
socket.on('new_message', (data) => {
    /*
    {
        id: 'msg_123',
        conversationId: 'conv_456', 
        content: '🖼️ image.jpg',
        messageType: 'image',
        fileInfo: {
            id: 'file_123',
            fileName: 'image.jpg',
            downloadUrl: 'https://...',
            thumbnailUrl: 'https://...'
        }
    }
    */
});
```

### Batch Files Message Response
```typescript
socket.on('new_message', (data) => {
    /*
    {
        id: 'msg_123',
        conversationId: 'conv_456',
        content: '📎 3 hình ảnh, 1 video',
        messageType: 'file',
        fileInfo: {
            // First file for backward compatibility
            id: 'file_123',
            fileName: 'image1.jpg',
            downloadUrl: 'https://...'
        },
        filesInfo: [
            {
                id: 'file_123',
                fileName: 'image1.jpg',
                downloadUrl: 'https://...',
                thumbnailUrl: 'https://...'
            },
            {
                id: 'file_124', 
                fileName: 'image2.jpg',
                downloadUrl: 'https://...',
                thumbnailUrl: 'https://...'
            },
            {
                id: 'file_125',
                fileName: 'video.mp4',
                downloadUrl: 'https://...',
                duration: 120
            }
        ]
    }
    */
});
```

### Dedicated Batch Handler Response
```typescript
socket.on('new_batch_files_message', (data) => {
    // Similar structure optimized for batch files
});

socket.on('batch_files_shared', (response) => {
    /*
    {
        messageId: 'msg_123',
        fileIds: ['file_123', 'file_124', 'file_125'],
        conversationId: 'conv_456',
        filesCount: 3,
        processingTime: 250
    }
    */
});
```

---

## ⚡ Performance Optimizations

### 1. **Smart Content Generation**
```typescript
// Server generates intelligent batch descriptions
"📎 3 hình ảnh, 2 video" // Mixed files
"🖼️ 5 ảnh"              // All images  
"📄 3 tài liệu"          // All documents
"📎 10 tệp"              // Generic fallback
```

### 2. **Batch Processing**
- Parallel file validation
- Concurrent download URL generation
- Optimized database queries

### 3. **Message Type Intelligence**
```typescript
// Server determines predominant type
['image/jpeg', 'image/png', 'video/mp4'] → type: 'image' (majority)
['image/jpeg', 'audio/mp3', 'application/pdf'] → type: 'file' (mixed)
```

### 4. **Backward Compatibility**
- `fileInfo` always present for legacy clients
- `filesInfo` array for modern clients supporting batch

---

## 🛡️ Security Considerations

### File Access Validation
```typescript
// Server validates ALL files in batch
for (const fileId of data.fileIds) {
    const hasAccess = await this.filesService.checkFileAccess(fileId, userId);
    if (!hasAccess) {
        throw new Error(`File ${fileId} access denied`);
    }
}
```

### Batch Size Limits
```typescript
// Implement reasonable limits
const MAX_BATCH_SIZE = 10;
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB

if (data.fileIds.length > MAX_BATCH_SIZE) {
    throw new Error('Too many files in batch');
}
```

---

## 📊 Use Cases & Recommendations

### ✅ **Web Dashboard** 
- **Single files**: FileId approach (secure)
- **Batch files**: FileIds approach (secure)
- **Max batch size**: 5 files

### ✅ **Mobile Apps**
- **Single files**: Metadata approach (performance)
- **Batch files**: Metadata approach (performance) 
- **Max batch size**: 10 files

### ✅ **Desktop Apps**
- **Single files**: FileId approach (secure)
- **Batch files**: Mixed approach based on count
- **Max batch size**: 20 files

---

## 🎯 Migration Strategy

1. **Phase 1**: Deploy backend với batch support
2. **Phase 2**: Update web clients để support multiple files
3. **Phase 3**: Update mobile clients với batch optimization
4. **Phase 4**: Monitor performance và fine-tune batch sizes

**Kết luận**: Batch file messaging giải quyết được use case gửi multiple files một cách hiệu quả, với flexibility cho cả security và performance optimization! 🚀
