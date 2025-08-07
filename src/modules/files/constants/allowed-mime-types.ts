/**
 * Allowed MIME Types for File Upload
 * 
 * 🎯 Purpose: Centralized configuration for supported file types
 * 🔧 Maintenance: Update this file to add/remove supported formats
 * 📱 Mobile-First: Includes all common mobile file formats
 * 🚀 Extensible: Easy to add new categories and types
 */

export const ALLOWED_MIME_TYPES = {
    // Images - Common formats for photos, graphics, and web images
    IMAGES: [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'image/bmp', 'image/tiff', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon',
        'image/heic', 'image/heif', 'image/avif', // Modern mobile formats
    ],

    // Videos - All major video formats for desktop and mobile
    VIDEOS: [
        'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/quicktime',
        'video/x-msvideo', 'video/webm', 'video/ogg', 'video/3gpp', 'video/x-flv',
        'video/mkv', 'video/x-matroska', 'video/m4v',
    ],

    // Audio - Music, voice recordings, and podcast formats
    AUDIO: [
        'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/mp4', 'audio/aac',
        'audio/ogg', 'audio/webm', 'audio/flac', 'audio/x-wav', 'audio/wave',
        'audio/vnd.wav', 'audio/x-ms-wma', 'audio/amr', 'audio/3gpp', 'audio/x-m4a',
        'audio/x-aiff', 'audio/aiff', 'audio/x-matroska', 'audio/x-flac',
        'audio/x-ms-wax', 'audio/x-ms-wvx', 'audio/x-mpegurl', 'audio/midi',
        'audio/x-midi', 'audio/x-wavpack', 'audio/x-speex', 'audio/x-opus',
    ],

    // Documents - PDF files
    DOCUMENTS_PDF: [
        'application/pdf',
    ],

    // Documents - Microsoft Office Suite
    DOCUMENTS_MICROSOFT: [
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-access', 'application/vnd.ms-project',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
        'application/vnd.openxmlformats-officedocument.presentationml.template',
    ],

    // Documents - LibreOffice/OpenOffice
    DOCUMENTS_LIBREOFFICE: [
        'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet',
        'application/vnd.oasis.opendocument.presentation', 'application/vnd.oasis.opendocument.graphics',
        'application/vnd.oasis.opendocument.database', 'application/vnd.oasis.opendocument.formula',
    ],

    // Documents - Text and markup formats
    DOCUMENTS_TEXT: [
        'text/plain', 'text/csv', 'text/tab-separated-values', 'text/rtf',
        'application/rtf', 'text/html', 'application/xhtml+xml',
    ],

    // Documents - E-books and digital publications
    DOCUMENTS_EBOOKS: [
        'application/epub+zip', 'application/x-mobipocket-ebook',
        'application/vnd.amazon.ebook', 'application/x-ibooks+zip',
    ],

    // Archives & Compression - File compression formats
    ARCHIVES: [
        'application/zip', 'application/x-rar-compressed', 'application/x-rar',
        'application/x-7z-compressed', 'application/x-tar', 'application/gzip',
        'application/x-gzip', 'application/x-bzip2', 'application/x-compress',
        'application/x-compressed', 'application/x-zip-compressed',
        'application/vnd.rar', 'application/x-lzh-compressed',
    ],

    // Programming & Development - Source code and development files
    DEVELOPMENT: [
        'text/javascript', 'application/javascript', 'text/css', 'application/json',
        'text/xml', 'application/xml', 'text/x-python', 'text/x-java-source',
        'text/x-c', 'text/x-c++', 'text/x-csharp', 'text/x-php',
        'text/x-sql', 'text/x-sh', 'application/x-sh',
    ],

    // Fonts - Web and desktop font formats
    FONTS: [
        'font/ttf', 'font/otf', 'font/woff', 'font/woff2', 'application/font-woff',
        'application/font-woff2', 'application/vnd.ms-fontobject', 'font/eot',
    ],

    // CAD & Design - Computer-aided design files
    CAD_DESIGN: [
        'application/dwg', 'application/dxf', 'image/vnd.dwg', 'image/vnd.dxf',
        'application/x-autocad', 'application/acad',
    ],

    // 3D Models - 3D graphics and modeling files
    MODELS_3D: [
        'model/obj', 'model/fbx', 'model/gltf+json', 'model/gltf-binary',
        'application/octet-stream', // For various binary formats
    ],

    // Cloud & Productivity - Additional cloud-based formats
    CLOUD_PRODUCTIVITY: [
        'application/vnd.apple.keynote', 'application/vnd.google-apps.presentation',
        'application/vnd.google-apps.spreadsheet',
    ],

    // System & Package Files - Installation and system files
    SYSTEM_PACKAGES: [
        'application/x-sqlite3', 'application/x-msdownload',
        'application/vnd.android.package-archive', // APK files
        'application/x-debian-package', // DEB files
        'application/x-rpm', // RPM files
    ],
};

/**
 * Get all allowed MIME types as a flat array
 * @returns Array of all supported MIME types
 */
export function getAllowedMimeTypes(): string[] {
    return Object.values(ALLOWED_MIME_TYPES).flat();
}

/**
 * Check if a MIME type is allowed
 * @param mimeType - MIME type to check
 * @returns True if the MIME type is supported
 */
export function isAllowedMimeType(mimeType: string): boolean {
    return getAllowedMimeTypes().includes(mimeType);
}

/**
 * Get MIME types by category
 * @param category - Category name (e.g., 'IMAGES', 'VIDEOS')
 * @returns Array of MIME types for the specified category
 */
export function getMimeTypesByCategory(category: keyof typeof ALLOWED_MIME_TYPES): string[] {
    return [...ALLOWED_MIME_TYPES[category]];
}

/**
 * Get human-readable file type categories
 */
export const FILE_TYPE_CATEGORIES = {
    images: 'Images',
    videos: 'Videos',
    audio: 'Audio',
    documents: 'Documents',
    archives: 'Archives',
    development: 'Development Files',
    fonts: 'Fonts',
    cad: 'CAD/Design Files',
    models3d: '3D Models',
    cloud: 'Cloud/Productivity',
    system: 'System/Package Files',
} as const;

/**
 * Get category for a MIME type
 * @param mimeType - MIME type to categorize
 * @returns Category name or 'unknown' if not found
 */
export function getCategoryForMimeType(mimeType: string): string {
    for (const [category, types] of Object.entries(ALLOWED_MIME_TYPES)) {
        if (types.includes(mimeType as any)) {
            // Convert category name to readable format
            switch (category) {
                case 'IMAGES': return 'images';
                case 'VIDEOS': return 'videos';
                case 'AUDIO': return 'audio';
                case 'DOCUMENTS_PDF':
                case 'DOCUMENTS_MICROSOFT':
                case 'DOCUMENTS_LIBREOFFICE':
                case 'DOCUMENTS_TEXT':
                case 'DOCUMENTS_EBOOKS': return 'documents';
                case 'ARCHIVES': return 'archives';
                case 'DEVELOPMENT': return 'development';
                case 'FONTS': return 'fonts';
                case 'CAD_DESIGN': return 'cad';
                case 'MODELS_3D': return 'models3d';
                case 'CLOUD_PRODUCTIVITY': return 'cloud';
                case 'SYSTEM_PACKAGES': return 'system';
                default: return 'unknown';
            }
        }
    }
    return 'unknown';
}
