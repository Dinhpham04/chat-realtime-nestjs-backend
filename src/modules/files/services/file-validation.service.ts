import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SUPPORTED_MIME_TYPES, FILE_CONSTANTS, FILE_CATEGORIES } from '../constants/file.constants';

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
        const allSupportedTypes: string[] = [
            ...SUPPORTED_MIME_TYPES.IMAGES,
            ...SUPPORTED_MIME_TYPES.VIDEOS,
            ...SUPPORTED_MIME_TYPES.AUDIO,
            ...SUPPORTED_MIME_TYPES.DOCUMENTS,
            ...SUPPORTED_MIME_TYPES.ARCHIVES
        ];

        return allSupportedTypes.includes(mimeType);
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

        const hex = buffer.toString('hex', 0, Math.min(12, buffer.length)).toUpperCase();

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
            '66747970': 'video/mp4', // MP4 at offset 4
            '000001BA': 'video/mpeg',
            '000001B3': 'video/mpeg',
        };

        // Check 8-byte signatures first
        for (const [signature, mimeType] of Object.entries(signatures)) {
            if (hex.startsWith(signature)) {
                return mimeType;
            }
        }

        // Special case for WebP - check RIFF header + WEBP
        if (hex.startsWith('52494646') && buffer.length >= 12) {
            const webpCheck = buffer.toString('ascii', 8, 12);
            if (webpCheck === 'WEBP') {
                return 'image/webp';
            }
        }

        // Special case for MP4 variants
        if (buffer.length >= 8) {
            const mp4Check = buffer.toString('ascii', 4, 8);
            if (mp4Check === 'ftyp') {
                return 'video/mp4';
            }
        }

        return null;
    }

    /**
     * Checks if two MIME types are compatible
     */
    private areCompatibleMimeTypes(detected: string, declared: string): boolean {
        // JPEG variants
        if ((detected === 'image/jpeg' && declared === 'image/jpg') ||
            (detected === 'image/jpg' && declared === 'image/jpeg')) {
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
        if (detected === 'video/mp4' &&
            (declared === 'video/quicktime' || declared === 'video/mp4')) {
            return true;
        }

        return false;
    }

    /**
     * Determines file category from MIME type
     */
    private getFileCategory(mimeType: string): string {
        if ((SUPPORTED_MIME_TYPES.IMAGES as readonly string[]).includes(mimeType)) {
            return FILE_CATEGORIES.IMAGE;
        }
        if ((SUPPORTED_MIME_TYPES.VIDEOS as readonly string[]).includes(mimeType)) {
            return FILE_CATEGORIES.VIDEO;
        }
        if ((SUPPORTED_MIME_TYPES.AUDIO as readonly string[]).includes(mimeType)) {
            return FILE_CATEGORIES.AUDIO;
        }
        if ((SUPPORTED_MIME_TYPES.DOCUMENTS as readonly string[]).includes(mimeType)) {
            return FILE_CATEGORIES.DOCUMENT;
        }
        if ((SUPPORTED_MIME_TYPES.ARCHIVES as readonly string[]).includes(mimeType)) {
            return FILE_CATEGORIES.ARCHIVE;
        }

        return FILE_CATEGORIES.OTHER;
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
