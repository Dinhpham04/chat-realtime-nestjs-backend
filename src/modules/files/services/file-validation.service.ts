import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ALLOWED_MIME_TYPES, getAllowedMimeTypes, getCategoryForMimeType } from '../constants';

// Temporary constants for backwards compatibility
const FILE_CONSTANTS = {
    CHUNK_UPLOAD_THRESHOLD: 10 * 1024 * 1024, // 10MB
    CHUNK_SIZE: 2 * 1024 * 1024, // 2MB
    MAX_FILE_SIZE: {
        IMAGES: 50 * 1024 * 1024, // 50MB
        VIDEOS: 500 * 1024 * 1024, // 500MB
        AUDIO: 50 * 1024 * 1024, // 50MB
        DOCUMENTS: 100 * 1024 * 1024, // 100MB
        ARCHIVES: 100 * 1024 * 1024, // 100MB
        OTHER: 100 * 1024 * 1024, // 100MB
    }
};

const FILE_CATEGORIES = {
    IMAGE: 'images',
    VIDEO: 'videos',
    AUDIO: 'audio',
    DOCUMENT: 'documents',
    ARCHIVE: 'archives',
    OTHER: 'other',
};

export interface FileValidationResult {
    isValid: boolean;
    category: string;
    requiresProcessing: boolean;
    useChunkedUpload: boolean;
    errors?: string[];
}

export interface FileInfo {
    originalName: string;
    mimeType: string;
    size: number;
    buffer?: Buffer;
}

/**
 * Service responsible for validating uploaded files
 * Handles file type, size, content validation according to business rules
 */
@Injectable()
export class FileValidationService {
    private readonly logger = new Logger(FileValidationService.name);

    /**
     * Validates a file against all business rules
     * @param fileInfo File information to validate
     * @returns Validation result with category and requirements
     */
    validateFile(fileInfo: FileInfo): FileValidationResult {
        // Input validation
        if (!fileInfo || !fileInfo.originalName || !fileInfo.mimeType) {
            return {
                isValid: false,
                category: FILE_CATEGORIES.OTHER,
                requiresProcessing: false,
                useChunkedUpload: false,
                errors: ['Invalid file information provided']
            };
        }

        const errors: string[] = [];

        // 1. Validate file type first (fastest check)
        if (!this.isValidMimeType(fileInfo.mimeType)) {
            errors.push(`Unsupported file type: ${fileInfo.mimeType}`);
        }

        // 2. Validate filename early (no external calls needed)
        if (!this.isValidFileName(fileInfo.originalName)) {
            errors.push('Invalid file name. Only alphanumeric characters and common symbols allowed.');
        }

        // 3. Validate file size (depends on mime type)
        if (typeof fileInfo.size === 'number' && fileInfo.size >= 0) {
            const sizeValidation = this.validateFileSize(fileInfo.mimeType, fileInfo.size);
            if (!sizeValidation.isValid) {
                errors.push(sizeValidation.error!);
            }
        } else {
            errors.push('Invalid file size provided');
        }

        // 4. Content validation (most expensive - only if buffer provided and other validations pass)
        if (fileInfo.buffer && errors.length === 0) {
            if (!this.validateFileContent(fileInfo.buffer, fileInfo.mimeType)) {
                errors.push('File content does not match declared file type');
            }
        }

        const category = this.getFileCategory(fileInfo.mimeType);

        return {
            isValid: errors.length === 0,
            category,
            requiresProcessing: this.requiresProcessing(fileInfo.mimeType),
            useChunkedUpload: typeof fileInfo.size === 'number' ?
                fileInfo.size > FILE_CONSTANTS.CHUNK_UPLOAD_THRESHOLD : false,
            errors: errors.length > 0 ? errors : undefined
        };
    }

    /**
     * Checks if MIME type is supported
     */
    private isValidMimeType(mimeType: string): boolean {
        return getAllowedMimeTypes().includes(mimeType);
    }

    /**
     * Validates file size based on category
     */
    private validateFileSize(mimeType: string, size: number): { isValid: boolean; error?: string } {
        const category = this.getFileCategory(mimeType);

        // Get max size for specific category, fallback to OTHER if not found
        const maxSizeKey = category.toUpperCase() as keyof typeof FILE_CONSTANTS.MAX_FILE_SIZE;
        const maxSize = FILE_CONSTANTS.MAX_FILE_SIZE[maxSizeKey] || FILE_CONSTANTS.MAX_FILE_SIZE.OTHER;

        if (size > maxSize) {
            const maxSizeMB = Math.round(maxSize / (1024 * 1024));
            return {
                isValid: false,
                error: `File too large. Maximum size for ${category} files: ${maxSizeMB}MB`
            };
        }

        if (size <= 0) {
            return {
                isValid: false,
                error: 'File is empty or corrupted'
            };
        }

        return { isValid: true };
    }

    /**
     * Validates filename format
     */
    private isValidFileName(fileName: string): boolean {
        // Check for dangerous characters
        const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
        if (dangerousChars.test(fileName)) {
            return false;
        }

        // Check length
        if (fileName.length > 255 || fileName.length === 0) {
            return false;
        }

        // Check for reserved names (Windows)
        const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
        if (reservedNames.test(fileName)) {
            return false;
        }

        return true;
    }

    /**
     * Validates file content matches declared MIME type
     */
    private validateFileContent(buffer: Buffer, declaredMimeType: string): boolean {
        try {
            const actualMimeType = this.detectMimeTypeFromBuffer(buffer);

            // If we can't detect, assume it's valid (fallback)
            if (!actualMimeType) {
                this.logger.warn(`Could not detect MIME type for declared type: ${declaredMimeType}`);
                return true;
            }

            // Check if detected type matches declared type
            const isMatch = actualMimeType === declaredMimeType ||
                this.areCompatibleMimeTypes(actualMimeType, declaredMimeType);

            if (!isMatch) {
                this.logger.warn(`MIME type mismatch: detected=${actualMimeType}, declared=${declaredMimeType}`);
            }

            return isMatch;
        } catch (error) {
            this.logger.error('Error validating file content:', error);
            // On error, allow the file (fail-open for usability)
            return true;
        }
    }

    /**
     * Detects MIME type from file buffer (magic numbers)
     */
    private detectMimeTypeFromBuffer(buffer: Buffer): string | null {
        if (buffer.length < 4) return null;

        const hex = buffer.toString('hex', 0, Math.min(16, buffer.length)).toUpperCase();

        // Common file signatures - check longer patterns first
        const signatures: Record<string, string> = {
            // Images
            'FFD8FFE0': 'image/jpeg',
            'FFD8FFE1': 'image/jpeg',
            'FFD8FFE2': 'image/jpeg',
            'FFD8FFDB': 'image/jpeg',
            '89504E47': 'image/png',
            '47494638': 'image/gif',
            '424D': 'image/bmp',
            '49492A00': 'image/tiff', // TIFF little endian
            '4D4D002A': 'image/tiff', // TIFF big endian

            // Audio - Basic signatures
            'FFFB': 'audio/mpeg', // MP3
            'FFF3': 'audio/mpeg', // MP3
            'FFF2': 'audio/mpeg', // MP3
            'ID3': 'audio/mpeg',   // MP3 with ID3 tag
            '52494646': 'audio/wav', // Will be refined below for WAV/WEBP

            // Documents
            '25504446': 'application/pdf',
            'D0CF11E0': 'application/msword', // DOC/XLS/PPT
            '504B0304': 'application/zip', // Also DOCX/XLSX/PPTX
            '504B0506': 'application/zip',
            '504B0708': 'application/zip',

            // Archives
            '52617221': 'application/x-rar-compressed', // RAR
            '377ABCAF': 'application/x-7z-compressed', // 7Z
            '1F8B': 'application/gzip',

            // Videos (basic detection)
            '000001BA': 'video/mpeg',
            '000001B3': 'video/mpeg',
        };

        // Check basic signatures first
        for (const [signature, mimeType] of Object.entries(signatures)) {
            if (hex.startsWith(signature)) {
                // Don't return RIFF immediately, need to check subtype
                if (signature !== '52494646') {
                    return mimeType;
                }
            }
        }

        // Advanced detection for container formats
        return this.detectContainerFormats(buffer, hex);
    }

    /**
     * Detects container-based formats (MP4, RIFF, etc.)
     */
    private detectContainerFormats(buffer: Buffer, hex: string): string | null {
        // RIFF container detection (WAV, WebP, AVI)
        if (hex.startsWith('52494646') && buffer.length >= 12) {
            const riffType = buffer.toString('ascii', 8, 12);
            switch (riffType) {
                case 'WAVE': return 'audio/wav';
                case 'WEBP': return 'image/webp';
                case 'AVI ': return 'video/avi';
                default: return 'application/octet-stream';
            }
        }

        // MP4/QuickTime container detection (includes M4A, M4V, etc.)
        if (buffer.length >= 12) {
            // Check for ftyp box at offset 4
            const ftypCheck = buffer.toString('ascii', 4, 8);
            if (ftypCheck === 'ftyp') {
                const brand = buffer.toString('ascii', 8, 12);

                // Specific audio-only container brands
                if (brand === 'M4A ' || brand === 'M4B ') {
                    return 'audio/x-m4a';
                }

                // Universal container brands - need to check content
                if (brand === 'mp41' || brand === 'mp42' || brand === 'avc1' || brand === 'isom') {
                    // For audio files: check audio-only atoms first (more specific)
                    if (this.containsAudioOnlyAtoms(buffer) && !this.containsVideoAtoms(buffer)) {
                        return 'audio/mp4';
                    }
                    // For video files: check video-specific atoms
                    if (this.containsVideoAtoms(buffer)) {
                        return 'video/mp4';
                    }
                    // If both audio and video atoms found, prioritize video
                    if (this.containsAudioOnlyAtoms(buffer) && this.containsVideoAtoms(buffer)) {
                        return 'video/mp4';
                    }
                    // Default to video for ambiguous cases
                    return 'video/mp4';
                }

                // Video container brands
                if (brand === 'qt  ') {
                    return 'video/mp4';
                }

                // Default MP4 container
                return 'video/mp4';
            }
        }

        // OGG container detection
        if (hex.startsWith('4F676753')) { // OggS
            // Check for Vorbis, Opus, or Theora
            if (buffer.length >= 35) {
                const oggContent = buffer.toString('ascii', 28, 35);
                if (oggContent.includes('vorbis')) {
                    return 'audio/ogg';
                }
                if (oggContent.includes('OpusHead')) {
                    return 'audio/x-opus';
                }
                if (oggContent.includes('theora')) {
                    return 'video/ogg';
                }
            }
            return 'audio/ogg'; // Default to audio for OGG
        }

        // FLAC detection
        if (hex.startsWith('664C6143')) { // fLaC
            return 'audio/flac';
        }

        // WebM detection (Matroska container)
        if (hex.startsWith('1A45DFA3')) {
            // This is Matroska/WebM - need to check doctype
            if (buffer.includes(Buffer.from('webm'))) {
                return 'video/webm';
            }
            if (buffer.includes(Buffer.from('matroska'))) {
                return 'video/x-matroska';
            }
            return 'video/webm'; // Default
        }

        // 3GP detection
        if (buffer.length >= 12) {
            const brand = buffer.toString('ascii', 8, 12);
            if (brand === '3gp4' || brand === '3gp5' || brand === '3g2a') {
                return 'video/3gpp';
            }
        }

        // AMR audio detection
        if (hex.startsWith('2321414D52')) { // #!AMR
            return 'audio/amr';
        }

        // AIFF detection
        if (hex.startsWith('464F524D') && buffer.length >= 12) {
            const aiffType = buffer.toString('ascii', 8, 12);
            if (aiffType === 'AIFF' || aiffType === 'AIFC') {
                return 'audio/aiff';
            }
        }

        // Additional audio format detection
        if (this.detectAdditionalAudioFormats(buffer, hex)) {
            return this.detectAdditionalAudioFormats(buffer, hex);
        }

        return null;
    }

    /**
     * Detects additional audio formats
     */
    private detectAdditionalAudioFormats(buffer: Buffer, hex: string): string | null {
        // WMA detection
        if (hex.startsWith('3026B2758E66CF11')) {
            return 'audio/x-ms-wma';
        }

        // AAC detection (ADTS)
        if (hex.startsWith('FFF1') || hex.startsWith('FFF9')) {
            return 'audio/aac';
        }

        // Monkey's Audio
        if (hex.startsWith('4D414320')) { // MAC
            return 'audio/x-ape';
        }

        // WavPack
        if (hex.startsWith('7776706B')) { // wvpk
            return 'audio/x-wavpack';
        }

        // True Audio
        if (hex.startsWith('5454413100')) { // TTA1
            return 'audio/x-tta';
        }

        // Musepack
        if (hex.startsWith('4D502B') || hex.startsWith('4D504348')) {
            return 'audio/x-musepack';
        }

        return null;
    }

    /**
     * Checks if MP4 container contains audio-only atoms
     */
    private containsAudioOnlyAtoms(buffer: Buffer): boolean {
        const audioAtoms = [
            'mp4a',  // MP4 Audio
            'samr',  // AMR audio
            'sawb',  // AMR-WB audio
            'sawp',  // AMR-WB+ audio
            'sevc',  // EVRC audio
            'sqcp',  // QCELP audio
            'ssmv',  // SMV audio
            'ac-3',  // AC3 audio
            'ec-3',  // Enhanced AC3 audio
            'mlpa',  // Meridian Lossless Packing
            'dtsc',  // DTS audio
            'dtse',  // DTS Express
            'dtsh',  // DTS-HD
            'dtsl',  // DTS-HD Lossless
        ];

        const bufferStr = buffer.toString('ascii');

        // Check for audio-specific atoms
        const hasAudioAtoms = audioAtoms.some(atom => bufferStr.includes(atom));

        // Check for audio-specific metadata
        const hasAudioMetadata = bufferStr.includes('audio/') ||
            bufferStr.includes('smhd') || // Sound media header
            (bufferStr.includes('mp4a') && !bufferStr.includes('vmhd'));

        return hasAudioAtoms || hasAudioMetadata;
    }

    /**
     * Checks if MP4 container contains video-specific atoms
     */
    private containsVideoAtoms(buffer: Buffer): boolean {
        const videoAtoms = [
            // Video codec atoms
            'avc1', 'avc3', 'hev1', 'hvc1', // H.264, H.265
            'mp4v', 'xvid', 'divx',         // MPEG-4 Visual, Xvid, DivX
            'vp08', 'vp09',                 // VP8, VP9
            'av01',                         // AV1
            // Video track atoms
            'vmhd',                         // Video media header
            // Video sample entries in stsd box
            'video/',                       // MIME type in metadata
        ];

        const bufferStr = buffer.toString('ascii');

        // Check for strong video indicators
        const hasVideoAtoms = videoAtoms.some(atom => bufferStr.includes(atom));

        // Only consider resolution indicators if we also have video atoms
        // This prevents false positives from audio metadata
        if (hasVideoAtoms) {
            const hasVideoResolution = /\b(1920|1080|720|480|360|240)\b/.test(bufferStr);
            return true; // If we have video atoms, it's definitely video
        }

        // Additional check: look for video track indicators
        const hasVideoTrack = bufferStr.includes('video') && (
            bufferStr.includes('track') ||
            bufferStr.includes('trak') ||
            bufferStr.includes('stsd')
        );

        return hasVideoTrack;
    }

    /**
     * Checks if two MIME types are compatible
     */
    private areCompatibleMimeTypes(detected: string, declared: string): boolean {
        // Exact match is always compatible
        if (detected === declared) {
            return true;
        }

        // Prevent cross-contamination between audio and video MP4 formats
        // Video detected as audio - NOT compatible
        if (detected.startsWith('video/') && declared.startsWith('audio/')) {
            return false;
        }
        // Audio detected as video - NOT compatible
        if (detected.startsWith('audio/') && declared.startsWith('video/')) {
            return false;
        }

        // JPEG variants
        if ((detected === 'image/jpeg' && declared === 'image/jpg') ||
            (detected === 'image/jpg' && declared === 'image/jpeg')) {
            return true;
        }

        // Audio format compatibility
        // MP4 container audio formats
        if (detected === 'audio/mp4' && (declared === 'audio/x-m4a' || declared === 'audio/aac')) {
            return true;
        }
        if (detected === 'audio/x-m4a' && (declared === 'audio/mp4' || declared === 'audio/aac')) {
            return true;
        }
        if (detected === 'audio/aac' && (declared === 'audio/mp4' || declared === 'audio/x-m4a')) {
            return true;
        }

        // MPEG audio variants
        if (detected === 'audio/mpeg' && (declared === 'audio/mp3' || declared === 'audio/mpga')) {
            return true;
        }
        if (detected === 'audio/mp3' && (declared === 'audio/mpeg' || declared === 'audio/mpga')) {
            return true;
        }

        // WAV variants
        if (detected === 'audio/wav' && (declared === 'audio/x-wav' || declared === 'audio/wave' || declared === 'audio/vnd.wav')) {
            return true;
        }
        if ((detected === 'audio/x-wav' || detected === 'audio/wave' || detected === 'audio/vnd.wav') && declared === 'audio/wav') {
            return true;
        }

        // OGG variants
        if (detected === 'audio/ogg' && (declared === 'audio/x-ogg' || declared === 'audio/ogg')) {
            return true;
        }

        // FLAC variants
        if (detected === 'audio/flac' && (declared === 'audio/x-flac' || declared === 'audio/flac')) {
            return true;
        }

        // AIFF variants
        if (detected === 'audio/aiff' && (declared === 'audio/x-aiff' || declared === 'audio/aiff')) {
            return true;
        }

        // ZIP-based formats (Office documents)
        if (detected === 'application/zip') {
            const zipBasedTypes = [
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
                'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
            ];
            return zipBasedTypes.includes(declared);
        }

        // Microsoft Office legacy formats
        if (detected === 'application/msword') {
            return declared === 'application/vnd.ms-excel' ||
                declared === 'application/vnd.ms-powerpoint' ||
                declared === 'application/msword';
        }

        // Video format variants
        if (detected === 'video/mp4' && (declared === 'video/quicktime' || declared === 'video/mp4' || declared === 'video/m4v')) {
            return true;
        }
        if (detected === 'video/quicktime' && (declared === 'video/mp4' || declared === 'video/mov')) {
            return true;
        }

        // Prevent audio/video MP4 cross-contamination
        if ((detected.startsWith('audio/') && declared.startsWith('video/')) ||
            (detected.startsWith('video/') && declared.startsWith('audio/'))) {
            return false;
        }

        return false;
    }

    /**
     * Determines file category from MIME type
     */
    private getFileCategory(mimeType: string): string {
        return getCategoryForMimeType(mimeType);
    }

    /**
     * Determines if file requires post-upload processing
     */
    private requiresProcessing(mimeType: string): boolean {
        // Images need thumbnail generation
        if (mimeType.startsWith('image/')) {
            return true;
        }

        // Videos need thumbnail extraction
        if (mimeType.startsWith('video/')) {
            return true;
        }

        // PDFs need preview generation
        if (mimeType === 'application/pdf') {
            return true;
        }

        return false;
    }

    /**
     * Quick validation for chunk upload initiation (WebSocket compatible)
     * Only validates essential properties without buffer content
     * @param fileName Original file name
     * @param mimeType File MIME type
     * @param totalSize Total file size
     * @returns Basic validation result
     */
    validateChunkUploadInfo(fileName: string, mimeType: string, totalSize: number): {
        isValid: boolean;
        category: string;
        useChunkedUpload: boolean;
        errors?: string[];
    } {
        const errors: string[] = [];

        // Input validation
        if (!fileName || !mimeType || typeof totalSize !== 'number') {
            return {
                isValid: false,
                category: FILE_CATEGORIES.OTHER,
                useChunkedUpload: false,
                errors: ['Invalid upload parameters provided']
            };
        }

        // Quick validations
        if (!this.isValidMimeType(mimeType)) {
            errors.push(`Unsupported file type: ${mimeType}`);
        }

        if (!this.isValidFileName(fileName)) {
            errors.push('Invalid file name format');
        }

        const sizeValidation = this.validateFileSize(mimeType, totalSize);
        if (!sizeValidation.isValid) {
            errors.push(sizeValidation.error!);
        }

        const category = this.getFileCategory(mimeType);

        return {
            isValid: errors.length === 0,
            category,
            useChunkedUpload: totalSize > FILE_CONSTANTS.CHUNK_UPLOAD_THRESHOLD,
            errors: errors.length > 0 ? errors : undefined
        };
    }

    /**
     * Validates chunk data during upload
     * @param chunkData Chunk buffer
     * @param expectedSize Expected chunk size
     * @param chunkNumber Chunk number (for logging)
     * @returns Validation result
     */
    validateChunkData(chunkData: Buffer, expectedSize: number, chunkNumber: number): {
        isValid: boolean;
        error?: string;
    } {
        if (!chunkData || !Buffer.isBuffer(chunkData)) {
            return {
                isValid: false,
                error: `Chunk ${chunkNumber}: Invalid chunk data`
            };
        }

        if (chunkData.length === 0) {
            return {
                isValid: false,
                error: `Chunk ${chunkNumber}: Empty chunk data`
            };
        }

        if (chunkData.length > FILE_CONSTANTS.CHUNK_SIZE) {
            return {
                isValid: false,
                error: `Chunk ${chunkNumber}: Chunk too large (${chunkData.length} > ${FILE_CONSTANTS.CHUNK_SIZE})`
            };
        }

        // For the last chunk, size can be smaller than expected
        if (expectedSize > 0 && chunkData.length !== expectedSize && expectedSize === FILE_CONSTANTS.CHUNK_SIZE) {
            return {
                isValid: false,
                error: `Chunk ${chunkNumber}: Size mismatch (expected: ${expectedSize}, got: ${chunkData.length})`
            };
        }

        return { isValid: true };
    }

    /**
     * Validates assembled file after chunk upload completion
     * @param assembledBuffer Complete file buffer
     * @param originalFileInfo Original file information
     * @returns Validation result
     */
    validateAssembledFile(assembledBuffer: Buffer, originalFileInfo: {
        fileName: string;
        mimeType: string;
        expectedSize: number;
    }): FileValidationResult {
        // Create FileInfo for validation
        const fileInfo: FileInfo = {
            originalName: originalFileInfo.fileName,
            mimeType: originalFileInfo.mimeType,
            size: assembledBuffer.length,
            buffer: assembledBuffer
        };

        // Verify assembled size matches expected
        if (assembledBuffer.length !== originalFileInfo.expectedSize) {
            return {
                isValid: false,
                category: this.getFileCategory(originalFileInfo.mimeType),
                requiresProcessing: false,
                useChunkedUpload: false,
                errors: [`Assembled file size mismatch. Expected: ${originalFileInfo.expectedSize}, Got: ${assembledBuffer.length}`]
            };
        }

        // Run full validation on assembled file
        return this.validateFile(fileInfo);
    }

    /**
     * Gets recommended chunk size for a file
     * @param fileSize Total file size
     * @param mimeType File MIME type
     * @returns Recommended chunk size
     */
    getRecommendedChunkSize(fileSize: number, mimeType: string): number {
        const category = this.getFileCategory(mimeType);

        // Larger chunks for videos (better for streaming)
        if (category === FILE_CATEGORIES.VIDEO && fileSize > 50 * 1024 * 1024) {
            return Math.min(FILE_CONSTANTS.CHUNK_SIZE * 2, 4 * 1024 * 1024); // Up to 4MB
        }

        // Smaller chunks for images (faster processing)
        if (category === FILE_CATEGORIES.IMAGE) {
            return Math.min(FILE_CONSTANTS.CHUNK_SIZE / 2, 1 * 1024 * 1024); // Up to 1MB
        }

        return FILE_CONSTANTS.CHUNK_SIZE;
    }

    /**
     * Validates multiple files (for batch upload)
     */
    validateMultipleFiles(files: FileInfo[]): {
        isValid: boolean;
        results: FileValidationResult[];
        errors?: string[];
    } {
        // Input validation
        if (!files || !Array.isArray(files)) {
            return {
                isValid: false,
                results: [],
                errors: ['Invalid files array provided']
            };
        }

        if (files.length === 0) {
            return {
                isValid: false,
                results: [],
                errors: ['No files provided']
            };
        }

        const maxBatchSize = 10;
        if (files.length > maxBatchSize) {
            return {
                isValid: false,
                results: [],
                errors: [`Maximum ${maxBatchSize} files allowed per upload`]
            };
        }

        const results = files.map((file, index) => {
            try {
                return this.validateFile(file);
            } catch (error) {
                return {
                    isValid: false,
                    category: FILE_CATEGORIES.OTHER,
                    requiresProcessing: false,
                    useChunkedUpload: false,
                    errors: [`File ${index + 1}: Validation error - ${error instanceof Error ? error.message : 'Unknown error'}`]
                };
            }
        });

        const globalErrors: string[] = [];

        // Check total size limit
        const totalSize = files.reduce((sum, file) => {
            return sum + (typeof file.size === 'number' ? file.size : 0);
        }, 0);

        const maxTotalSize = 500 * 1024 * 1024; // 500MB total limit
        if (totalSize > maxTotalSize) {
            globalErrors.push(`Total file size exceeds ${Math.round(maxTotalSize / (1024 * 1024))}MB limit`);
        }

        // Check for duplicate file names
        const fileNames = files.map(f => f.originalName.toLowerCase());
        const duplicateNames = fileNames.filter((name, index) => fileNames.indexOf(name) !== index);
        if (duplicateNames.length > 0) {
            globalErrors.push(`Duplicate file names detected: ${[...new Set(duplicateNames)].join(', ')}`);
        }

        // Count files by category for additional validation
        const categoryCount: Record<string, number> = {};
        results.forEach(result => {
            categoryCount[result.category] = (categoryCount[result.category] || 0) + 1;
        });

        // Limit video files in batch (they're large)
        if (categoryCount[FILE_CATEGORIES.VIDEO] > 3) {
            globalErrors.push('Maximum 3 video files allowed per batch upload');
        }

        const isValid = results.every(result => result.isValid) && globalErrors.length === 0;

        return {
            isValid,
            results,
            errors: globalErrors.length > 0 ? globalErrors : undefined
        };
    }
}
