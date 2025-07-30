import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';
import * as ffmpeg from 'fluent-ffmpeg';
import { StorageService } from './storage.service';

export interface ThumbnailResult {
    thumbnailBuffer: Buffer;
    thumbnailPath: string;
    thumbnailUrl: string;
    mimeType: string;
}

/**
 * Service for generating thumbnails for different file types
 * Supports images, videos, PDFs, and document previews
 */
@Injectable()
export class ThumbnailGenerationService {
    private readonly logger = new Logger(ThumbnailGenerationService.name);

    // Thumbnail configurations
    private readonly THUMBNAIL_SIZE = { width: 300, height: 300 };
    private readonly THUMBNAIL_QUALITY = 80;
    private readonly VIDEO_FRAME_TIME = '00:00:02'; // Extract frame at 2 seconds

    constructor(
        private readonly storageService: StorageService,
    ) { }

    /**
     * Generate thumbnail based on file type
     * @param fileBuffer Original file buffer
     * @param mimeType File MIME type
     * @param fileId File identifier
     * @param userId User ID for access control
     * @returns Thumbnail result or null if not supported
     */
    async generateThumbnail(
        fileBuffer: Buffer,
        mimeType: string,
        fileId: string,
        userId: string
    ): Promise<ThumbnailResult | null> {
        this.logger.log(`Generating thumbnail for file ${fileId}, type: ${mimeType}`);

        try {
            if (this.isImageFile(mimeType)) {
                return await this.generateImageThumbnail(fileBuffer, fileId, userId);
            }

            if (this.isVideoFile(mimeType)) {
                return await this.generateVideoThumbnail(fileBuffer, fileId, userId);
            }

            if (this.isPDFFile(mimeType)) {
                return await this.generatePDFThumbnail(fileBuffer, fileId, userId);
            }

            if (this.isAudioFile(mimeType)) {
                return await this.generateAudioThumbnail(fileBuffer, fileId, userId);
            }

            if (this.isDocumentFile(mimeType)) {
                return await this.generateDocumentThumbnail(mimeType, fileId, userId);
            }

            this.logger.log(`No thumbnail generation support for MIME type: ${mimeType}`);
            return null;

        } catch (error) {
            this.logger.error(`Failed to generate thumbnail for ${fileId}:`, error);
            return null; // Fail gracefully, don't break upload
        }
    }

    /**
     * Generate thumbnail for image files
     */
    private async generateImageThumbnail(
        imageBuffer: Buffer,
        fileId: string,
        userId: string
    ): Promise<ThumbnailResult> {
        this.logger.log(`Generating image thumbnail for ${fileId}`);

        // Use Sharp for high-quality image processing
        const thumbnailBuffer = await sharp(imageBuffer)
            .resize(this.THUMBNAIL_SIZE.width, this.THUMBNAIL_SIZE.height, {
                fit: 'cover', // Crop to fill the dimensions
                position: 'center'
            })
            .jpeg({
                quality: this.THUMBNAIL_QUALITY,
                progressive: true
            })
            .toBuffer();

        // Upload thumbnail to storage
        const thumbnailPath = await this.storageService.uploadThumbnail(
            fileId,
            thumbnailBuffer,
            'image/jpeg'
        );

        // Generate signed URL for thumbnail
        const thumbnailUrl = await this.storageService.getSignedUrl(
            `${fileId}_thumb`,
            userId,
            3600 // 1 hour expiry
        );

        return {
            thumbnailBuffer,
            thumbnailPath,
            thumbnailUrl,
            mimeType: 'image/jpeg'
        };
    }

    /**
     * Generate thumbnail for video files
     */
    private async generateVideoThumbnail(
        videoBuffer: Buffer,
        fileId: string,
        userId: string
    ): Promise<ThumbnailResult> {
        this.logger.log(`Generating video thumbnail for ${fileId}`);

        return new Promise(async (resolve, reject) => {
            try {
                // Create temporary file for FFmpeg processing
                const tempVideoPath = `/tmp/video_${fileId}.mp4`;
                const tempThumbPath = `/tmp/thumb_${fileId}.jpg`;

                // Write video buffer to temp file
                const fs = require('fs').promises;
                await fs.writeFile(tempVideoPath, videoBuffer);

                // Extract frame using FFmpeg
                ffmpeg(tempVideoPath)
                    .seekInput(this.VIDEO_FRAME_TIME)
                    .frames(1)
                    .size(`${this.THUMBNAIL_SIZE.width}x${this.THUMBNAIL_SIZE.height}`)
                    .output(tempThumbPath)
                    .on('end', async () => {
                        try {
                            // Read generated thumbnail
                            const thumbnailBuffer = await fs.readFile(tempThumbPath);

                            // Upload to storage
                            const thumbnailPath = await this.storageService.uploadThumbnail(
                                fileId,
                                thumbnailBuffer,
                                'image/jpeg'
                            );

                            // Generate signed URL
                            const thumbnailUrl = await this.storageService.getSignedUrl(
                                `${fileId}_thumb`,
                                userId,
                                3600
                            );

                            // Cleanup temp files
                            await Promise.all([
                                fs.unlink(tempVideoPath).catch(() => { }),
                                fs.unlink(tempThumbPath).catch(() => { })
                            ]);

                            resolve({
                                thumbnailBuffer,
                                thumbnailPath,
                                thumbnailUrl,
                                mimeType: 'image/jpeg'
                            });

                        } catch (error) {
                            reject(error);
                        }
                    })
                    .on('error', (error) => {
                        this.logger.error(`FFmpeg error for ${fileId}:`, error);
                        reject(error);
                    })
                    .run();

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Generate thumbnail for PDF files
     */
    private async generatePDFThumbnail(
        pdfBuffer: Buffer,
        fileId: string,
        userId: string
    ): Promise<ThumbnailResult> {
        this.logger.log(`Generating PDF thumbnail for ${fileId}`);

        // For now, return a generic PDF icon
        // TODO: Implement PDF-to-image conversion using pdf2pic or similar
        return await this.generateGenericThumbnail('pdf', fileId, userId);
    }

    /**
     * Generate thumbnail for audio files (waveform or music icon)
     */
    private async generateAudioThumbnail(
        audioBuffer: Buffer,
        fileId: string,
        userId: string
    ): Promise<ThumbnailResult> {
        this.logger.log(`Generating audio thumbnail for ${fileId}`);

        // For now, return a generic audio icon
        // TODO: Implement waveform generation
        return await this.generateGenericThumbnail('audio', fileId, userId);
    }

    /**
     * Generate thumbnail for document files
     */
    private async generateDocumentThumbnail(
        mimeType: string,
        fileId: string,
        userId: string
    ): Promise<ThumbnailResult> {
        this.logger.log(`Generating document thumbnail for ${fileId}`);

        const docType = this.getDocumentType(mimeType);
        return await this.generateGenericThumbnail(docType, fileId, userId);
    }

    /**
     * Generate generic icon-based thumbnail
     */
    private async generateGenericThumbnail(
        iconType: string,
        fileId: string,
        userId: string
    ): Promise<ThumbnailResult> {
        // Create a simple colored square with file type text
        const thumbnailBuffer = await sharp({
            create: {
                width: this.THUMBNAIL_SIZE.width,
                height: this.THUMBNAIL_SIZE.height,
                channels: 3,
                background: this.getIconColor(iconType)
            }
        })
            .png()
            .toBuffer();

        // Upload to storage
        const thumbnailPath = await this.storageService.uploadThumbnail(
            fileId,
            thumbnailBuffer,
            'image/png'
        );

        // Generate signed URL
        const thumbnailUrl = await this.storageService.getSignedUrl(
            `${fileId}_thumb`,
            userId,
            3600
        );

        return {
            thumbnailBuffer,
            thumbnailPath,
            thumbnailUrl,
            mimeType: 'image/png'
        };
    }

    // Helper methods for file type detection
    private isImageFile(mimeType: string): boolean {
        return mimeType.startsWith('image/') && !mimeType.includes('svg');
    }

    private isVideoFile(mimeType: string): boolean {
        return mimeType.startsWith('video/');
    }

    private isPDFFile(mimeType: string): boolean {
        return mimeType === 'application/pdf';
    }

    private isAudioFile(mimeType: string): boolean {
        return mimeType.startsWith('audio/');
    }

    private isDocumentFile(mimeType: string): boolean {
        const documentTypes = [
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'text/csv'
        ];
        return documentTypes.includes(mimeType);
    }

    private getDocumentType(mimeType: string): string {
        if (mimeType.includes('word')) return 'doc';
        if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'xls';
        if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'ppt';
        if (mimeType.includes('pdf')) return 'pdf';
        if (mimeType.includes('text')) return 'txt';
        return 'file';
    }

    private getIconColor(iconType: string): { r: number; g: number; b: number } {
        const colors = {
            pdf: { r: 220, g: 53, b: 69 },      // Red
            doc: { r: 40, g: 167, b: 69 },       // Green  
            xls: { r: 25, g: 135, b: 84 },       // Dark Green
            ppt: { r: 255, g: 193, b: 7 },       // Yellow
            audio: { r: 111, g: 66, b: 193 },    // Purple
            video: { r: 13, g: 110, b: 253 },    // Blue
            txt: { r: 108, g: 117, b: 125 },     // Gray
            file: { r: 134, g: 142, b: 150 }     // Light Gray
        };
        return colors[iconType] || colors.file;
    }

    /**
     * Check if thumbnail generation is supported for file type
     */
    isThumbnailSupported(mimeType: string): boolean {
        return this.isImageFile(mimeType) ||
            this.isVideoFile(mimeType) ||
            this.isPDFFile(mimeType) ||
            this.isAudioFile(mimeType) ||
            this.isDocumentFile(mimeType);
    }
}
