/**
 * File Configuration for Conversations Module
 * 
 * This configuration file defines settings for file handling
 * within conversations, including size limits, allowed types,
 * and storage configurations.
 */

export interface FileUploadConfig {
    maxFileSize: number;
    maxFilesPerMessage: number;
    allowedMimeTypes: string[];
    thumbnailConfig: {
        enabled: boolean;
        maxWidth: number;
        maxHeight: number;
        quality: number;
    };
}

export interface FileStorageConfig {
    uploadPath: string;
    thumbnailPath: string;
    baseUrl: string;
    cdnEnabled: boolean;
    cdnUrl?: string;
}

export interface FileProcessingConfig {
    compressionEnabled: boolean;
    virusScanEnabled: boolean;
    metadataExtractionEnabled: boolean;
    autoDeleteAfterDays?: number;
}

/**
 * Default file configuration
 */
export const DEFAULT_FILE_CONFIG: {
    upload: FileUploadConfig;
    storage: FileStorageConfig;
    processing: FileProcessingConfig;
} = {
    upload: {
        maxFileSize: 100 * 1024 * 1024, // 100MB
        maxFilesPerMessage: 10,
        allowedMimeTypes: [
            // Images
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/svg+xml',

            // Videos
            'video/mp4',
            'video/webm',
            'video/avi',
            'video/mov',
            'video/wmv',

            // Audio
            'audio/mp3',
            'audio/wav',
            'audio/ogg',
            'audio/aac',
            'audio/m4a',

            // Documents
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'text/csv',

            // Archives
            'application/zip',
            'application/x-rar-compressed',
            'application/x-7z-compressed',
            'application/x-tar',
            'application/gzip',
        ],
        thumbnailConfig: {
            enabled: true,
            maxWidth: 300,
            maxHeight: 300,
            quality: 80,
        },
    },

    storage: {
        uploadPath: '/uploads/conversations',
        thumbnailPath: '/uploads/thumbnails',
        baseUrl: process.env.FILE_BASE_URL || 'http://localhost:3000',
        cdnEnabled: process.env.CDN_ENABLED === 'true',
        cdnUrl: process.env.CDN_URL,
    },

    processing: {
        compressionEnabled: process.env.FILE_COMPRESSION_ENABLED !== 'false',
        virusScanEnabled: process.env.VIRUS_SCAN_ENABLED === 'true',
        metadataExtractionEnabled: process.env.METADATA_EXTRACTION_ENABLED !== 'false',
        autoDeleteAfterDays: process.env.AUTO_DELETE_FILES_AFTER_DAYS
            ? parseInt(process.env.AUTO_DELETE_FILES_AFTER_DAYS, 10)
            : undefined,
    },
};

/**
 * File type categories and their corresponding MIME types
 */
export const FILE_TYPE_CATEGORIES = {
    image: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'image/bmp',
        'image/tiff',
    ],

    video: [
        'video/mp4',
        'video/webm',
        'video/avi',
        'video/mov',
        'video/wmv',
        'video/flv',
        'video/mkv',
        'video/3gp',
    ],

    audio: [
        'audio/mp3',
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        'audio/aac',
        'audio/m4a',
        'audio/flac',
        'audio/wma',
    ],

    document: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
        'text/rtf',
        'application/rtf',
    ],

    archive: [
        'application/zip',
        'application/x-zip-compressed',
        'application/x-rar-compressed',
        'application/x-7z-compressed',
        'application/x-tar',
        'application/gzip',
        'application/x-gzip',
    ],
};

/**
 * Security configurations for file handling
 */
export const FILE_SECURITY_CONFIG = {
    blockedExtensions: [
        '.exe',
        '.bat',
        '.cmd',
        '.com',
        '.pif',
        '.scr',
        '.vbs',
        '.js',
        '.jar',
        '.app',
        '.deb',
        '.pkg',
        '.rpm',
    ],

    blockedMimeTypes: [
        'application/x-executable',
        'application/x-msdownload',
        'application/x-msdos-program',
        'application/x-winexe',
        'application/x-winhlp',
        'application/x-winhelp',
    ],

    scanForMalware: true,
    quarantineEnabled: true,

    // Headers to strip from uploaded files
    stripMetadata: true,
    allowedHeaders: [
        'content-type',
        'content-length',
        'content-disposition',
    ],
};

/**
 * Performance optimization configurations
 */
export const FILE_PERFORMANCE_CONFIG = {
    // Lazy loading for file lists
    lazyLoadingEnabled: true,
    itemsPerPage: 20,
    maxItemsPerPage: 100,

    // Caching
    cacheEnabled: true,
    cacheTtl: 3600, // 1 hour in seconds

    // Image optimization
    imageOptimization: {
        enabled: true,
        formats: ['webp', 'avif', 'jpg'],
        sizes: [150, 300, 600, 1200],
    },

    // Video processing
    videoProcessing: {
        enabled: false,
        generatePreviews: true,
        maxPreviewDuration: 10, // seconds
    },
};

/**
 * Error messages for file operations
 */
export const FILE_ERROR_MESSAGES = {
    FILE_TOO_LARGE: 'File size exceeds the maximum allowed limit',
    INVALID_FILE_TYPE: 'File type is not allowed',
    TOO_MANY_FILES: 'Too many files in a single message',
    UPLOAD_FAILED: 'File upload failed',
    VIRUS_DETECTED: 'File contains malicious content',
    STORAGE_QUOTA_EXCEEDED: 'Storage quota exceeded',
    FILE_NOT_FOUND: 'File not found',
    ACCESS_DENIED: 'Access denied to file',
    PROCESSING_FAILED: 'File processing failed',
    THUMBNAIL_GENERATION_FAILED: 'Thumbnail generation failed',
};

/**
 * Helper function to get file type category from MIME type
 */
export function getFileTypeCategory(mimeType: string): string {
    for (const [category, types] of Object.entries(FILE_TYPE_CATEGORIES)) {
        if (types.includes(mimeType.toLowerCase())) {
            return category;
        }
    }
    return 'other';
}

/**
 * Helper function to check if file type is allowed
 */
export function isFileTypeAllowed(mimeType: string): boolean {
    return DEFAULT_FILE_CONFIG.upload.allowedMimeTypes.includes(mimeType.toLowerCase());
}

/**
 * Helper function to check if file is under size limit
 */
export function isFileSizeAllowed(fileSize: number): boolean {
    return fileSize <= DEFAULT_FILE_CONFIG.upload.maxFileSize;
}

/**
 * Helper function to generate thumbnail URL
 */
export function generateThumbnailUrl(fileId: string, config = DEFAULT_FILE_CONFIG.storage): string {
    const baseUrl = config.cdnEnabled && config.cdnUrl ? config.cdnUrl : config.baseUrl;
    return `${baseUrl}${config.thumbnailPath}/${fileId}`;
}

/**
 * Helper function to generate download URL
 */
export function generateDownloadUrl(
    fileId: string,
    fileName: string,
    config = DEFAULT_FILE_CONFIG.storage
): string {
    const baseUrl = config.cdnEnabled && config.cdnUrl ? config.cdnUrl : config.baseUrl;
    return `${baseUrl}/api/files/${fileId}/download/${encodeURIComponent(fileName)}`;
}
