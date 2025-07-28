export const FILE_CONSTANTS = {
    // File size limits (bytes)
    MAX_FILE_SIZE: {
        IMAGE: 25 * 1024 * 1024,      // 25MB
        VIDEO: 100 * 1024 * 1024,     // 100MB  
        AUDIO: 50 * 1024 * 1024,      // 50MB
        DOCUMENT: 50 * 1024 * 1024,   // 50MB
        OTHER: 25 * 1024 * 1024,      // 25MB
    },

    // Global max file size for upload (largest of all categories)
    GLOBAL_MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB

    // Chunk upload settings
    CHUNK_SIZE: 2 * 1024 * 1024,    // 2MB chunks
    MAX_PARALLEL_CHUNKS: 3,          // 3 parallel uploads
    CHUNK_UPLOAD_THRESHOLD: 1 * 1024 * 1024, // Use chunks for files > 1MB

    // Upload session settings
    UPLOAD_SESSION_TTL: 3600,        // 1 hour in seconds
    MAX_UPLOAD_RETRIES: 3,

    // File lifecycle
    UNUSED_FILE_CLEANUP_DAYS: 7,     // Clean up unused files after 7 days
    ACCESS_TIME_UPDATE_INTERVAL: 300, // Update access time every 5 minutes

    // Thumbnail settings
    THUMBNAIL_SIZE: { width: 150, height: 150 },
    PREVIEW_SIZE: { width: 800, height: 600 },

    // Security
    VIRUS_SCAN_TIMEOUT: 30000,       // 30 seconds
    DOWNLOAD_URL_EXPIRY: 3600,       // 1 hour
    MAX_DOWNLOADS_PER_HOUR: 100,
} as const;

export const SUPPORTED_MIME_TYPES = {
    IMAGES: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/svg+xml'
    ],

    VIDEOS: [
        'video/mp4',
        'video/mpeg',
        'video/quicktime',
        'video/x-msvideo', // AVI
        'video/x-ms-wmv',  // WMV
        'video/webm'
    ],

    AUDIO: [
        'audio/mpeg',      // MP3
        'audio/wav',
        'audio/aac',
        'audio/ogg',
        'audio/webm',
        'audio/x-m4a'
    ],

    DOCUMENTS: [
        'application/pdf',
        'application/msword', // DOC
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
        'application/vnd.ms-excel', // XLS
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
        'application/vnd.ms-powerpoint', // PPT
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
        'text/plain',
        'text/csv',
        'application/rtf'
    ],

    ARCHIVES: [
        'application/zip',
        'application/x-rar-compressed',
        'application/x-7z-compressed',
        'application/gzip'
    ]
} as const;

export const FILE_CATEGORIES = {
    IMAGE: 'image',
    VIDEO: 'video',
    AUDIO: 'audio',
    DOCUMENT: 'document',
    ARCHIVE: 'archive',
    OTHER: 'other'
} as const;

export const VIRUS_SCAN_STATUS = {
    PENDING: 'pending',
    CLEAN: 'clean',
    INFECTED: 'infected',
    FAILED: 'failed',
    TIMEOUT: 'timeout'
} as const;

export const UPLOAD_STATUS = {
    UPLOADING: 'uploading',
    COMPLETED: 'completed',
    FAILED: 'failed',
    EXPIRED: 'expired',
    CANCELLED: 'cancelled'
} as const;
