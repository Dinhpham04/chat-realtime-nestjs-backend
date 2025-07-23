/**
 * Message Attachment Type Definitions
 * 
 * 🎯 TypeScript Best Practices: Type-first design
 * 📱 Mobile-First: Strong typing for mobile clients
 * 🚀 SOLID: Single source of truth for types
 */

// =============== ENUMS ===============

/**
 * Storage provider options
 */
export enum StorageProvider {
  LOCAL = 'local',
  S3 = 's3',
  GCS = 'gcs',
  AZURE = 'azure'
}

/**
 * File upload status
 */
export enum UploadStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Virus scan results
 */
export enum ScanResult {
  CLEAN = 'clean',
  SUSPICIOUS = 'suspicious',
  INFECTED = 'infected'
}

/**
 * Thumbnail sizes
 */
export enum ThumbnailSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large'
}

/**
 * File quality levels
 */
export enum FileQuality {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  ORIGINAL = 'original'
}

/**
 * File category types
 */
export enum FileCategory {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  PDF = 'pdf',
  FILE = 'file'
}

// =============== INTERFACES ===============

/**
 * File information structure
 */
export interface FileInfo {
  readonly originalName: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSize: number;
  readonly checksum: string;
}

/**
 * Storage configuration
 */
export interface StorageInfo {
  readonly storageProvider: StorageProvider;
  readonly storagePath: string;
  readonly publicUrl: string;
  readonly cdnUrl?: string;
  readonly expiresAt?: Date;
}

/**
 * Image/Video dimensions
 */
export interface MediaDimensions {
  readonly width: number;
  readonly height: number;
}

/**
 * Thumbnail information
 */
export interface ThumbnailInfo {
  readonly size: ThumbnailSize;
  readonly width: number;
  readonly height: number;
  readonly url: string;
  readonly fileSize: number;
}

/**
 * Media processing information
 */
export interface MediaInfo {
  readonly dimensions?: MediaDimensions;
  readonly thumbnails: ThumbnailInfo[];
  readonly duration?: number; // For video/audio (seconds)
  readonly format?: string;
  readonly quality?: FileQuality;
  readonly isCompressed: boolean;
}

/**
 * Audio specific metadata
 */
export interface AudioInfo {
  readonly duration: number; // Duration in seconds
  readonly bitrate?: number;
  readonly sampleRate?: number;
  readonly channels?: number;
  readonly waveform?: readonly number[]; // Immutable array
  readonly transcript?: string;
}

/**
 * Processing status details
 */
export interface ProcessingStatus {
  thumbnailGenerated: boolean;
  compressionApplied: boolean;
  virusScanned: boolean;
  scanResult: ScanResult;
}

/**
 * Upload tracking information
 */
export interface UploadInfo {
  status: UploadStatus;
  uploadProgress: number; // 0-100
  processingStatus: ProcessingStatus;
  readonly uploadedAt: Date;
  processedAt?: Date;
}

/**
 * Access restrictions configuration
 */
export interface AccessRestrictions {
  allowedUsers: readonly string[]; // User IDs as strings for flexibility
  maxDownloads?: number;
  expiresAfter?: number; // Hours
}

/**
 * Access control settings
 */
export interface AccessControl {
  isPublic: boolean;
  requiresAuth: boolean;
  downloadCount: number;
  lastAccessedAt: Date;
  accessRestrictions: AccessRestrictions;
}

// =============== UTILITY TYPES ===============

/**
 * Create attachment data (for service layer)
 */
export interface CreateMessageAttachmentData {
  readonly messageId: string;
  readonly uploadedBy: string;
  readonly fileInfo: FileInfo;
  readonly storage: StorageInfo;
  readonly mediaInfo?: MediaInfo;
  readonly audioInfo?: AudioInfo;
}

/**
 * Update attachment data (partial updates)
 */
export interface UpdateMessageAttachmentData {
  uploadInfo?: Partial<UploadInfo>;
  mediaInfo?: Partial<MediaInfo>;
  audioInfo?: Partial<AudioInfo>;
  accessControl?: Partial<AccessControl>;
}

/**
 * File filter options (for queries)
 */
export interface AttachmentFilters {
  readonly fileCategory?: FileCategory;
  readonly storageProvider?: StorageProvider;
  readonly uploadStatus?: UploadStatus;
  readonly dateFrom?: Date;
  readonly dateTo?: Date;
  readonly maxFileSize?: number;
  readonly minFileSize?: number;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly sortBy?: 'createdAt' | 'fileSize' | 'downloadCount';
  readonly sortOrder?: 'asc' | 'desc';
}

// =============== TYPE GUARDS ===============

/**
 * Check if file is image
 */
export function isImageFile(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith('image/');
}

/**
 * Check if file is video
 */
export function isVideoFile(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith('video/');
}

/**
 * Check if file is audio
 */
export function isAudioFile(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith('audio/');
}

/**
 * Get file category from MIME type
 */
export function getFileCategory(mimeType: string): FileCategory {
  const mime = mimeType.toLowerCase();

  if (mime.startsWith('image/')) return FileCategory.IMAGE;
  if (mime.startsWith('video/')) return FileCategory.VIDEO;
  if (mime.startsWith('audio/')) return FileCategory.AUDIO;
  if (mime.includes('pdf')) return FileCategory.PDF;
  if (mime.includes('document') || mime.includes('text')) return FileCategory.DOCUMENT;

  return FileCategory.FILE;
}

// =============== CONSTANTS ===============

/**
 * File size limits (bytes)
 */
export const FILE_SIZE_LIMITS = {
  IMAGE: 50 * 1024 * 1024, // 50MB
  VIDEO: 500 * 1024 * 1024, // 500MB  
  AUDIO: 100 * 1024 * 1024, // 100MB
  DOCUMENT: 10 * 1024 * 1024, // 10MB
  DEFAULT: 25 * 1024 * 1024, // 25MB
} as const;

/**
 * Supported MIME types
 */
export const ALLOWED_MIME_TYPES = {
  IMAGES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ],
  VIDEOS: [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/avi',
    'video/mov'
  ],
  AUDIO: [
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'audio/m4a'
  ],
  DOCUMENTS: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  ]
} as const;

/**
 * Default processing settings
 */
export const DEFAULT_PROCESSING = {
  THUMBNAIL_SIZES: [ThumbnailSize.SMALL, ThumbnailSize.MEDIUM, ThumbnailSize.LARGE],
  COMPRESSION_QUALITY: FileQuality.HIGH,
  MAX_PROCESSING_TIME: 5 * 60 * 1000, // 5 minutes
  SCAN_TIMEOUT: 30 * 1000, // 30 seconds
} as const;
