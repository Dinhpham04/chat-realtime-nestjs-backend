import { Injectable, BadRequestException } from '@nestjs/common';
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

    /**
     * Validates a file against all business rules
     * @param fileInfo File information to validate
     * @returns Validation result with category and requirements
     */
    validateFile(fileInfo: FileInfo): FileValidationResult {
        const errors: string[] = [];

        // 1. Validate file type
        if (!this.isValidMimeType(fileInfo.mimeType)) {
            errors.push(`Unsupported file type: ${fileInfo.mimeType}`);
        }

        // 2. Validate file size
        const sizeValidation = this.validateFileSize(fileInfo.mimeType, fileInfo.size);
        if (!sizeValidation.isValid) {
            errors.push(sizeValidation.error!);
        }

        // 3. Validate filename
        if (!this.isValidFileName(fileInfo.originalName)) {
            errors.push('Invalid file name. Only alphanumeric characters and common symbols allowed.');
        }

        // 4. Content validation (if buffer provided)
        if (fileInfo.buffer && !this.validateFileContent(fileInfo.buffer, fileInfo.mimeType)) {
            errors.push('File content does not match declared file type');
        }

        const category = this.getFileCategory(fileInfo.mimeType);

        return {
            isValid: errors.length === 0,
            category,
            requiresProcessing: this.requiresProcessing(fileInfo.mimeType),
            useChunkedUpload: fileInfo.size > FILE_CONSTANTS.CHUNK_UPLOAD_THRESHOLD,
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
        const maxSize = FILE_CONSTANTS.MAX_FILE_SIZE[category.toUpperCase() as keyof typeof FILE_CONSTANTS.MAX_FILE_SIZE]
            || FILE_CONSTANTS.MAX_FILE_SIZE.OTHER;

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
        const actualMimeType = this.detectMimeTypeFromBuffer(buffer);

        // If we can't detect, assume it's valid (fallback)
        if (!actualMimeType) {
            return true;
        }

        // Check if detected type matches declared type
        return actualMimeType === declaredMimeType ||
            this.areCompatibleMimeTypes(actualMimeType, declaredMimeType);
    }

    /**
     * Detects MIME type from file buffer (magic numbers)
     */
    private detectMimeTypeFromBuffer(buffer: Buffer): string | null {
        if (buffer.length < 4) return null;

        const hex = buffer.toString('hex', 0, 4).toUpperCase();

        // Common file signatures
        const signatures: Record<string, string> = {
            'FFD8FFE0': 'image/jpeg',
            'FFD8FFE1': 'image/jpeg',
            'FFD8FFDB': 'image/jpeg',
            '89504E47': 'image/png',
            '47494638': 'image/gif',
            '52494646': 'image/webp', // Need to check further for WebP
            '25504446': 'application/pdf',
            '504B0304': 'application/zip',
            '504B0506': 'application/zip',
            '504B0708': 'application/zip'
        };

        // Check 4-byte signatures
        if (signatures[hex]) {
            return signatures[hex];
        }

        // Check 3-byte signatures
        const hex3 = hex.substring(0, 6);
        if (hex3 === 'FFD8FF') {
            return 'image/jpeg';
        }

        return null;
    }

    /**
     * Checks if two MIME types are compatible
     */
    private areCompatibleMimeTypes(detected: string, declared: string): boolean {
        // JPEG variants
        if (detected === 'image/jpeg' &&
            (declared === 'image/jpg' || declared === 'image/jpeg')) {
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
     * Validates multiple files (for batch upload)
     */
    validateMultipleFiles(files: FileInfo[]): {
        isValid: boolean;
        results: FileValidationResult[];
        errors?: string[];
    } {
        if (files.length === 0) {
            return {
                isValid: false,
                results: [],
                errors: ['No files provided']
            };
        }

        if (files.length > 10) {
            return {
                isValid: false,
                results: [],
                errors: ['Maximum 10 files allowed per upload']
            };
        }

        const results = files.map(file => this.validateFile(file));
        const globalErrors: string[] = [];

        // Check total size
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        if (totalSize > 500 * 1024 * 1024) { // 500MB total limit
            globalErrors.push('Total file size exceeds 500MB limit');
        }

        const isValid = results.every(result => result.isValid) && globalErrors.length === 0;

        return {
            isValid,
            results,
            errors: globalErrors.length > 0 ? globalErrors : undefined
        };
    }
}
