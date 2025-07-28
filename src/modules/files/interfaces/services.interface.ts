export interface IStorageService {
    uploadFile(fileId: string, buffer: Buffer, mimeType: string): Promise<UploadResult>;
    downloadFile(fileId: string): Promise<Buffer>;
    deleteFile(path: string): Promise<void>;
    getSignedUrl(fileId: string, userId: string, expiresIn?: number, permissions?: ('read' | 'download')[], maxDownloads?: number): Promise<string>;
    getOneTimeDownloadUrl(fileId: string, userId: string, expiresIn?: number): Promise<string>;
    getPreviewUrl(fileId: string, userId: string, expiresIn?: number): Promise<string>;
    validateAndTrackDownload(token: string, requiredPermission?: 'read' | 'download', clientIp?: string): Promise<{ fileId: string; userId: string }>;
    uploadThumbnail(fileId: string, buffer: Buffer, mimeType: string): Promise<string>;
}

export interface IVirusScanningService {
    scanFile(buffer: Buffer): Promise<ScanResult>;
    scanFileById(fileId: string): Promise<ScanResult>;
}

export interface IFileProcessingService {
    processFile(fileId: string): Promise<ProcessingResult>;
    generateThumbnail(buffer: Buffer, mimeType: string): Promise<Buffer>;
    extractMetadata(buffer: Buffer, mimeType: string): Promise<FileMetadata>;
    compressFile(buffer: Buffer, mimeType: string): Promise<Buffer>;
}

export interface IChunkUploadService {
    initializeUpload(uploadData: InitiateUploadDto): Promise<UploadSession>;
    uploadChunk(uploadId: string, chunkIndex: number, chunkData: Buffer): Promise<ChunkResult>;
    completeUpload(uploadId: string): Promise<CompleteUploadResult>;
    resumeUpload(uploadId: string): Promise<UploadStatus>;
    cancelUpload(uploadId: string): Promise<void>;
}

export interface UploadResult {
    path: string;
    url: string;
    size: number;
}

export interface ScanResult {
    isClean: boolean;
    threatName?: string;
    scanTime: number;
}

export interface ProcessingResult {
    thumbnailPath?: string;
    previewPath?: string;
    metadata: FileMetadata;
    compressed?: boolean;
}

export interface FileMetadata {
    width?: number;
    height?: number;
    duration?: number;
    encoding?: string;
    bitrate?: number;
}

export interface UploadSession {
    uploadId: string;
    chunkSize: number;
    totalChunks: number;
    expiresAt: Date;
}

export interface ChunkResult {
    chunkIndex: number;
    uploaded: boolean;
    progress: number;
}

export interface CompleteUploadResult {
    fileId: string;
    fileName: string;
    fileSize: number;
    downloadUrl: string;
    thumbnailUrl?: string;
}

export interface UploadStatus {
    uploadId: string;
    progress: number;
    completedChunks: number[];
    status: string;
}

export interface InitiateUploadDto {
    fileName: string;
    fileSize: number;
    mimeType: string;
    userId: string;
}
