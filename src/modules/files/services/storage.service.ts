import { Injectable, Logger, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStorageService, UploadResult } from '../interfaces/services.interface';
import { RedisDownloadTokenService } from '../../../redis/services/redis-download-token.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Storage service with local file system backend
 * Can be extended to support S3 and other cloud storage providers
 * Now uses Redis for secure download token management
 */
@Injectable()
export class StorageService implements IStorageService {
    private readonly logger = new Logger(StorageService.name);
    private readonly localStoragePath: string;
    private readonly baseUrl: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly redisDownloadTokenService: RedisDownloadTokenService,
    ) {
        this.localStoragePath = this.configService.get<string>('LOCAL_STORAGE_PATH', './uploads');
        this.baseUrl = this.configService.get<string>('BASE_URL', 'http://localhost:3000');
        // Initialize storage asynchronously but don't block constructor
        this.initializeLocalStorage().catch(error => {
            this.logger.error('Failed to initialize local storage:', error);
        });
    }

    /**
     * Uploads file to local storage
     * @param fileId Unique file identifier
     * @param buffer File content buffer
     * @param mimeType File MIME type
     * @returns Upload result with path and URL
     */
    async uploadFile(fileId: string, buffer: Buffer, mimeType: string): Promise<UploadResult> {
        try {
            const extension = this.getExtensionFromMimeType(mimeType);
            const fileName = `${fileId}${extension}`;

            // Create subdirectory based on date for organization
            const datePrefix = new Date().toISOString().slice(0, 7); // YYYY-MM format
            const subDir = path.join(this.localStoragePath, datePrefix);
            await fs.mkdir(subDir, { recursive: true });

            const filePath = path.join(subDir, fileName);
            await fs.writeFile(filePath, buffer);

            const relativePath = path.join(datePrefix, fileName);

            return {
                path: relativePath,
                url: `${this.baseUrl}/api/v1/files/download/${fileId}`,
                size: buffer.length
            };
        } catch (error) {
            this.logger.error(`Failed to upload file ${fileId}:`, error);
            throw new InternalServerErrorException('File upload failed');
        }
    }

    /**
     * Downloads file from local storage
     * @param fileId File identifier
     * @returns File content buffer
     */
    async downloadFile(fileId: string): Promise<Buffer> {
        try {
            const filePath = await this.findLocalFile(fileId);
            return await fs.readFile(filePath);
        } catch (error) {
            this.logger.error(`Failed to download file ${fileId}:`, error);
            throw new InternalServerErrorException('File download failed');
        }
    }

    /**
     * Deletes file from local storage
     * @param filePath Relative file path to delete
     */
    async deleteFile(filePath: string): Promise<void> {
        try {
            // Validate path to prevent path traversal attacks
            const normalizedPath = path.normalize(filePath);
            if (normalizedPath.includes('..') || path.isAbsolute(normalizedPath)) {
                throw new BadRequestException('Invalid file path');
            }

            const fullPath = path.join(this.localStoragePath, normalizedPath);

            // Ensure the resolved path is still within storage directory
            if (!fullPath.startsWith(path.resolve(this.localStoragePath))) {
                throw new BadRequestException('Path traversal not allowed');
            }

            await fs.unlink(fullPath);
            this.logger.log(`Deleted file: ${filePath}`);
        } catch (error) {
            this.logger.warn(`Failed to delete file ${filePath}:`, error);
            // Don't throw error for delete operations - log and continue
        }
    }

    /**
     * Generates signed URL for secure file access using Redis tokens
     * @param fileId File identifier
     * @param userId User requesting access
     * @param expiresIn Expiration time in seconds
     * @param permissions File access permissions
     * @param maxDownloads Maximum number of downloads
     * @returns Signed URL with Redis token
     */
    async getSignedUrl(
        fileId: string,
        userId: string,
        expiresIn: number = 3600,
        permissions: ('read' | 'download')[] = ['read', 'download'],
        maxDownloads?: number
    ): Promise<string> {
        try {
            const token = await this.redisDownloadTokenService.generateToken(fileId, userId, {
                expiresIn,
                permissions,
                maxDownloads
            });

            return `${this.baseUrl}/api/v1/files/download/${fileId}?token=${token}`;
        } catch (error) {
            this.logger.error(`Failed to generate signed URL for ${fileId}:`, error);
            throw new InternalServerErrorException('Failed to generate download URL');
        }
    }

    /**
     * Generate one-time download URL
     * @param fileId File identifier
     * @param userId User requesting access
     * @param expiresIn Expiration time in seconds
     * @returns One-time download URL
     */
    async getOneTimeDownloadUrl(
        fileId: string,
        userId: string,
        expiresIn: number = 300
    ): Promise<string> {
        try {
            const token = await this.redisDownloadTokenService.generateOneTimeToken(fileId, userId, expiresIn);
            return `${this.baseUrl}/api/v1/files/download/${fileId}?token=${token}`;
        } catch (error) {
            this.logger.error(`Failed to generate one-time URL for ${fileId}:`, error);
            throw new InternalServerErrorException('Failed to generate one-time download URL');
        }
    }

    /**
     * Generate preview URL (read-only)
     * @param fileId File identifier
     * @param userId User requesting access
     * @param expiresIn Expiration time in seconds
     * @returns Preview URL
     */
    async getPreviewUrl(
        fileId: string,
        userId: string,
        expiresIn: number = 900
    ): Promise<string> {
        try {
            const token = await this.redisDownloadTokenService.generatePreviewToken(fileId, userId, expiresIn);
            return `${this.baseUrl}/api/v1/files/preview/${fileId}?token=${token}`;
        } catch (error) {
            this.logger.error(`Failed to generate preview URL for ${fileId}:`, error);
            throw new InternalServerErrorException('Failed to generate preview URL');
        }
    }

    /**
     * Validates download token and track usage
     * @param token Download token
     * @param requiredPermission Required permission
     * @param clientIp Client IP address
     * @returns Token validation result
     */
    async validateAndTrackDownload(
        token: string,
        requiredPermission: 'read' | 'download' = 'read',
        clientIp?: string
    ): Promise<{ fileId: string; userId: string }> {
        try {
            const tokenData = await this.redisDownloadTokenService.validateToken(token, requiredPermission, clientIp);

            // Track download if permission is download
            if (requiredPermission === 'download') {
                await this.redisDownloadTokenService.trackDownload(token);
            }

            return {
                fileId: tokenData.fileId,
                userId: tokenData.userId
            };
        } catch (error) {
            this.logger.warn(`Token validation failed: ${error.message}`);
            throw error; // Re-throw the specific error from Redis service
        }
    }

    /**
     * Uploads thumbnail to storage
     * @param fileId Original file ID
     * @param buffer Thumbnail buffer
     * @param mimeType Thumbnail MIME type
     * @returns Thumbnail path
     */
    async uploadThumbnail(fileId: string, buffer: Buffer, mimeType: string): Promise<string> {
        const thumbnailId = `${fileId}_thumb`;
        const result = await this.uploadFile(thumbnailId, buffer, mimeType);
        return result.path;
    }

    // Private helper methods
    private async initializeLocalStorage(): Promise<void> {
        try {
            await fs.mkdir(this.localStoragePath, { recursive: true });
            this.logger.log(`Local storage initialized at: ${this.localStoragePath}`);
        } catch (error) {
            this.logger.error('Failed to initialize local storage:', error);
            throw error;
        }
    }

    private async findLocalFile(fileId: string): Promise<string> {
        // Search through subdirectories to find the file
        const searchDirs = await this.getSubDirectories();

        for (const subDir of searchDirs) {
            const dirPath = path.join(this.localStoragePath, subDir);
            try {
                const files = await fs.readdir(dirPath);
                // Fix: Use exact match with extensions to avoid partial matches
                const matchingFile = files.find(file => {
                    const nameWithoutExt = path.parse(file).name;
                    return nameWithoutExt === fileId;
                });

                if (matchingFile) {
                    return path.join(dirPath, matchingFile);
                }
            } catch (error) {
                // Directory might not exist, continue searching
                continue;
            }
        }

        throw new Error(`File not found: ${fileId}`);
    }

    private async getSubDirectories(): Promise<string[]> {
        try {
            const items = await fs.readdir(this.localStoragePath, { withFileTypes: true });
            const dirs = items
                .filter(item => item.isDirectory())
                .map(item => item.name)
                .sort()
                .reverse(); // Search recent directories first

            return ['', ...dirs]; // Include root directory
        } catch (error) {
            return [''];
        }
    }

    private getExtensionFromMimeType(mimeType: string): string {
        const mimeToExt: Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/bmp': '.bmp',
            'image/svg+xml': '.svg',
            'video/mp4': '.mp4',
            'video/mpeg': '.mpeg',
            'video/quicktime': '.mov',
            'video/x-msvideo': '.avi',
            'video/x-ms-wmv': '.wmv',
            'video/webm': '.webm',
            'audio/mpeg': '.mp3',
            'audio/wav': '.wav',
            'audio/aac': '.aac',
            'audio/ogg': '.ogg',
            'audio/webm': '.weba',
            'audio/x-m4a': '.m4a',
            'application/pdf': '.pdf',
            'application/msword': '.doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
            'application/vnd.ms-excel': '.xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
            'application/vnd.ms-powerpoint': '.ppt',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
            'application/zip': '.zip',
            'application/x-rar-compressed': '.rar',
            'application/x-7z-compressed': '.7z',
            'application/gzip': '.gz',
            'text/plain': '.txt',
            'text/csv': '.csv',
            'application/rtf': '.rtf'
        };

        return mimeToExt[mimeType] || '.bin';
    }

    /**
     * Uploads a file chunk for chunked upload
     * @param chunkPath Chunk storage path
     * @param chunkData Chunk binary data
     * @returns Chunk storage result
     */
    async uploadChunk(chunkPath: string, chunkData: Buffer): Promise<{ path: string }> {
        try {
            const fullPath = path.join(this.localStoragePath, 'chunks', chunkPath);

            // Create directory if needed
            await fs.mkdir(path.dirname(fullPath), { recursive: true });

            // Write chunk file
            await fs.writeFile(fullPath, chunkData);

            this.logger.log(`Chunk uploaded: ${chunkPath} (${chunkData.length} bytes) to ${fullPath}`);

            return {
                path: fullPath,
            };
        } catch (error) {
            this.logger.error(`Failed to upload chunk ${chunkPath}: ${error.message}`);
            throw new InternalServerErrorException(`Chunk upload failed: ${error.message}`);
        }
    }

    /**
     * Downloads a file chunk
     * @param chunkPath Chunk storage path
     * @returns Chunk binary data
     */
    async downloadChunk(chunkPath: string): Promise<Buffer> {
        const fullPath = path.join(this.localStoragePath, 'chunks', chunkPath);

        try {
            const buffer = await fs.readFile(fullPath);
            this.logger.log(`Chunk downloaded: ${chunkPath} (${buffer.length} bytes) from ${fullPath}`);
            return buffer;
        } catch (error: any) {
            this.logger.error(`Failed to download chunk ${chunkPath}: ${error.message}`);
            if (error.code === 'ENOENT') {
                throw new NotFoundException(`Chunk not found: ${chunkPath}`);
            }
            throw new InternalServerErrorException(`Chunk download failed: ${error.message}`);
        }
    }

    /**
     * Deletes a file chunk
     * @param chunkPath Chunk storage path
     */
    async deleteChunk(chunkPath: string): Promise<void> {
        const fullPath = path.join(this.localStoragePath, 'chunks', chunkPath);

        try {
            await fs.unlink(fullPath);
            this.logger.log(`Chunk deleted: ${chunkPath}`);
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }
}
