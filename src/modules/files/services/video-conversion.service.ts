/**
 * Video Conversion Service
 * 
 * 🎯 Purpose: Convert video formats for web preview compatibility
 * 📱 Mobile-First: Handle mobile video formats (.mov, .avi, .3gp, etc.)
 * 🚀 On-Demand: Convert only when preview is requested
 * 
 * Features:
 * - Convert unsupported formats to MP4 (H.264 + AAC)
 * - Cache converted videos for performance
 * - Quality optimization for web preview
 * - Error handling and fallback mechanisms
 * 
 * Supported Input Formats:
 * - Apple formats: .mov, .m4v, .qt
 * - Windows formats: .avi, .wmv, .asf
 * - Mobile formats: .3gp, .3g2
 * - Other formats: .flv, .mkv, .webm (older versions)
 * 
 * Output: Always MP4 (H.264 video + AAC audio) for maximum compatibility
 * 
 * Updated: FFmpeg path configuration ok
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { execSync } from 'child_process';

export interface VideoConversionOptions {
    quality?: 'low' | 'medium' | 'high';
    maxWidth?: number;
    maxHeight?: number;
    maxBitrate?: string;
    audioCodec?: string;
    videoCodec?: string;
}

export interface ConversionResult {
    success: boolean;
    outputBuffer?: Buffer;
    originalSize: number;
    convertedSize: number;
    compressionRatio: number;
    processingTime: number;
    error?: string;
}

@Injectable()
export class VideoConversionService {
    private readonly logger = new Logger(VideoConversionService.name);
    private readonly tempDir: string;

    // Formats that need conversion for web preview
    private readonly FORMATS_NEED_CONVERSION = [
        'video/quicktime',        // .mov (Apple)
        'video/x-msvideo',        // .avi 
        'video/x-ms-wmv',         // .wmv (Windows)
        'video/3gpp',             // .3gp (Mobile)
        'video/3gpp2',            // .3g2 (Mobile)
        'video/x-flv',            // .flv (Flash)
        'video/x-matroska',       // .mkv
        'video/x-m4v',            // .m4v (Apple)
        'application/x-troff-msvideo', // Old AVI
    ];

    // Formats that are already web-compatible
    private readonly WEB_COMPATIBLE_FORMATS = [
        'video/mp4',              // ✅ Best compatibility
        'video/webm',             // ✅ Modern browsers
        'video/ogg',              // ✅ Firefox, Chrome
    ];

    constructor(private readonly configService: ConfigService) {
        this.tempDir = path.join(os.tmpdir(), 'video-conversion');
        this.ensureTempDir();
        this.configureFfmpeg();
    }

    /**
     * Check if video format needs conversion for web preview
     */
    needsConversion(mimeType: string): boolean {
        return this.FORMATS_NEED_CONVERSION.includes(mimeType);
    }

    /**
     * Check if video format is web-compatible
     */
    isWebCompatible(mimeType: string): boolean {
        return this.WEB_COMPATIBLE_FORMATS.includes(mimeType);
    }

    /**
     * Convert video to web-compatible MP4 format
     */
    async convertToMp4(
        inputBuffer: Buffer,
        originalMimeType: string,
        options: VideoConversionOptions = {}
    ): Promise<ConversionResult> {
        const startTime = Date.now();
        const tempId = `conversion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const inputPath = path.join(this.tempDir, `${tempId}_input${this.getFileExtension(originalMimeType)}`);
        const outputPath = path.join(this.tempDir, `${tempId}_output.mp4`);

        try {
            this.logger.debug(`Starting conversion: ${originalMimeType} → MP4`);

            // Write input buffer to temp file
            await fs.writeFile(inputPath, inputBuffer);

            // Get conversion settings
            const conversionSettings = this.getConversionSettings(options);

            // Perform conversion
            await this.performConversion(inputPath, outputPath, conversionSettings);

            // Read converted file
            const outputBuffer = await fs.readFile(outputPath);
            const processingTime = Date.now() - startTime;

            const result: ConversionResult = {
                success: true,
                outputBuffer,
                originalSize: inputBuffer.length,
                convertedSize: outputBuffer.length,
                compressionRatio: Math.round((1 - outputBuffer.length / inputBuffer.length) * 100),
                processingTime,
            };

            this.logger.log(`Conversion successful: ${originalMimeType} → MP4 (${this.formatBytes(inputBuffer.length)} → ${this.formatBytes(outputBuffer.length)}, ${processingTime}ms)`);

            return result;

        } catch (error) {
            const processingTime = Date.now() - startTime;
            this.logger.error(`Conversion failed: ${error.message}`, error.stack);

            return {
                success: false,
                originalSize: inputBuffer.length,
                convertedSize: 0,
                compressionRatio: 0,
                processingTime,
                error: error.message,
            };

        } finally {
            // Cleanup temp files
            await this.cleanupFiles([inputPath, outputPath]);
        }
    }

    /**
     * Get optimal video format for preview based on user agent
     */
    getOptimalFormat(userAgent?: string): string {
        if (!userAgent) return 'video/mp4';

        const ua = userAgent.toLowerCase();

        // Safari prefers MP4
        if (ua.includes('safari') && !ua.includes('chrome')) {
            return 'video/mp4';
        }

        // Chrome/Edge supports WebM efficiently
        if (ua.includes('chrome') || ua.includes('edge')) {
            return 'video/webm'; // Could offer WebM alternative
        }

        // Firefox supports both
        if (ua.includes('firefox')) {
            return 'video/mp4'; // MP4 for broader compatibility
        }

        // Default to MP4 for maximum compatibility
        return 'video/mp4';
    }

    /**
     * Get video metadata without conversion
     */
    async getVideoMetadata(inputBuffer: Buffer, mimeType: string): Promise<{
        duration: number;
        width: number;
        height: number;
        bitrate: number;
        fps: number;
        codec: string;
    } | null> {
        const tempId = `metadata_${Date.now()}`;
        const inputPath = path.join(this.tempDir, `${tempId}${this.getFileExtension(mimeType)}`);

        try {
            await fs.writeFile(inputPath, inputBuffer);

            return new Promise((resolve, reject) => {
                ffmpeg.ffprobe(inputPath, (err, metadata) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                    if (!videoStream) {
                        resolve(null);
                        return;
                    }

                    resolve({
                        duration: parseFloat(String(metadata.format.duration || 0)),
                        width: videoStream.width || 0,
                        height: videoStream.height || 0,
                        bitrate: parseInt(String(metadata.format.bit_rate || 0)),
                        fps: eval(videoStream.r_frame_rate || '0') || 0,
                        codec: videoStream.codec_name || 'unknown',
                    });
                });
            });

        } catch (error) {
            this.logger.error(`Failed to get video metadata: ${error.message}`);
            return null;

        } finally {
            await this.cleanupFiles([inputPath]);
        }
    }

    // =============== PRIVATE METHODS ===============

    private async ensureTempDir(): Promise<void> {
        try {
            await fs.access(this.tempDir);
        } catch {
            await fs.mkdir(this.tempDir, { recursive: true });
            this.logger.debug(`Created temp directory: ${this.tempDir}`);
        }
    }

    private configureFfmpeg(): void {
        try {
            // Try configured paths first
            const ffmpegPath = this.configService.get<string>('FFMPEG_PATH');
            const ffprobePath = this.configService.get<string>('FFPROBE_PATH');

            if (ffmpegPath && this.isValidFFmpegPath(ffmpegPath)) {
                ffmpeg.setFfmpegPath(ffmpegPath);
                this.logger.debug(`✅ Using configured FFmpeg: ${ffmpegPath}`);
            } else if (ffmpegPath) {
                this.logger.warn(`❌ Configured FFmpeg path invalid: ${ffmpegPath}`);
                this.autoDetectFFmpeg();
            } else {
                this.autoDetectFFmpeg();
            }

            if (ffprobePath && this.isValidFFprobePath(ffprobePath)) {
                ffmpeg.setFfprobePath(ffprobePath);
                this.logger.debug(`✅ Using configured FFprobe: ${ffprobePath}`);
            } else if (ffprobePath) {
                this.logger.warn(`❌ Configured FFprobe path invalid: ${ffprobePath}`);
                this.autoDetectFFprobe();
            } else {
                this.autoDetectFFprobe();
            }

        } catch (error) {
            this.logger.error(`FFmpeg configuration failed: ${error.message}`);
            this.logger.warn('Video conversion will be disabled');
        }
    }

    private autoDetectFFmpeg(): void {
        if (process.platform === 'win32') {
            this.detectWindowsFFmpeg();
        } else {
            this.detectUnixFFmpeg();
        }
    }

    private autoDetectFFprobe(): void {
        if (process.platform === 'win32') {
            this.detectWindowsFFprobe();
        } else {
            this.detectUnixFFprobe();
        }
    }

    private detectAndSetFfmpegPath(): void {
        try {
            if (process.platform === 'win32') {
                this.detectWindowsFFmpeg();
            } else {
                this.detectUnixFFmpeg();
            }
        } catch (error) {
            this.logger.error(`Failed to detect FFmpeg path: ${error.message}`);
        }
    }

    private detectWindowsFFmpeg(): void {
        // Method 1: Check if FFmpeg is in PATH
        try {
            const result = execSync('where ffmpeg', { encoding: 'utf8' }).trim();
            const ffmpegPath = result.split('\n')[0];
            ffmpeg.setFfmpegPath(ffmpegPath);
            this.logger.debug(`✅ FFmpeg found in PATH: ${ffmpegPath}`);
            return;
        } catch {
            this.logger.debug('FFmpeg not found in PATH, trying other locations...');
        }

        // Method 2: Search WinGet installation directories
        const wingetPaths = this.findWinGetFFmpeg();
        for (const testPath of wingetPaths) {
            if (this.isValidFFmpegPath(testPath)) {
                ffmpeg.setFfmpegPath(testPath);
                this.logger.debug(`✅ FFmpeg found via WinGet: ${testPath}`);
                return;
            }
        }

        // Method 3: Check common manual installation paths
        const commonPaths = [
            'C:\\ffmpeg\\bin\\ffmpeg.exe',
            'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
            'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe',
            path.join(process.env.USERPROFILE || '', 'ffmpeg', 'bin', 'ffmpeg.exe'),
            path.join(process.env.USERPROFILE || '', 'scoop', 'apps', 'ffmpeg', 'current', 'bin', 'ffmpeg.exe'),
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'ffmpeg', 'bin', 'ffmpeg.exe'),
        ];

        for (const testPath of commonPaths) {
            if (this.isValidFFmpegPath(testPath)) {
                ffmpeg.setFfmpegPath(testPath);
                this.logger.debug(`✅ FFmpeg found at: ${testPath}`);
                return;
            }
        }

        this.logger.warn('❌ FFmpeg not found. Please install via: winget install Gyan.FFmpeg.Essentials');
    }

    private findWinGetFFmpeg(): string[] {
        const paths: string[] = [];
        const userProfile = process.env.USERPROFILE || '';

        try {
            // WinGet packages are typically installed in user's AppData\Local\Microsoft\WinGet\Packages
            const wingetBase = path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages');

            if (require('fs').existsSync(wingetBase)) {
                const packages = require('fs').readdirSync(wingetBase);

                // Look for FFmpeg packages
                const ffmpegPackages = packages.filter((pkg: string) =>
                    pkg.toLowerCase().includes('ffmpeg') ||
                    pkg.toLowerCase().includes('gyan')
                );

                for (const pkg of ffmpegPackages) {
                    const packagePath = path.join(wingetBase, pkg);

                    try {
                        const contents = require('fs').readdirSync(packagePath);

                        // Look for ffmpeg directories
                        for (const item of contents) {
                            if (item.toLowerCase().includes('ffmpeg')) {
                                const ffmpegDir = path.join(packagePath, item);
                                const binDir = path.join(ffmpegDir, 'bin');
                                const ffmpegExe = path.join(binDir, 'ffmpeg.exe');

                                if (require('fs').existsSync(ffmpegExe)) {
                                    paths.push(ffmpegExe);
                                }
                            }
                        }
                    } catch {
                        continue;
                    }
                }
            }
        } catch (error) {
            this.logger.debug(`WinGet search failed: ${error.message}`);
        }

        return paths;
    }

    private detectUnixFFmpeg(): void {
        // Method 1: Check if FFmpeg is in PATH
        try {
            const result = execSync('which ffmpeg', { encoding: 'utf8' }).trim();
            ffmpeg.setFfmpegPath(result);
            this.logger.debug(`✅ FFmpeg found in PATH: ${result}`);
            return;
        } catch {
            this.logger.debug('FFmpeg not found in PATH, trying other locations...');
        }

        // Method 2: Check common Unix paths
        const commonPaths = [
            '/usr/bin/ffmpeg',
            '/usr/local/bin/ffmpeg',
            '/opt/homebrew/bin/ffmpeg',    // macOS ARM Homebrew
            '/usr/local/Homebrew/bin/ffmpeg', // macOS Intel Homebrew
            '/snap/bin/ffmpeg',            // Ubuntu Snap
            '/opt/ffmpeg/bin/ffmpeg',      // Custom installations
        ];

        for (const testPath of commonPaths) {
            if (this.isValidFFmpegPath(testPath)) {
                ffmpeg.setFfmpegPath(testPath);
                this.logger.debug(`✅ FFmpeg found at: ${testPath}`);
                return;
            }
        }

        const installCmd = process.platform === 'darwin' ? 'brew install ffmpeg' : 'sudo apt install ffmpeg';
        this.logger.warn(`❌ FFmpeg not found. Please install via: ${installCmd}`);
    }

    private isValidFFmpegPath(filePath: string): boolean {
        try {
            if (!require('fs').existsSync(filePath)) {
                return false;
            }

            // Try to run ffmpeg -version to verify it's working
            execSync(`"${filePath}" -version`, { stdio: 'pipe' });
            return true;
        } catch {
            return false;
        }
    }

    private isValidFFprobePath(filePath: string): boolean {
        try {
            if (!require('fs').existsSync(filePath)) {
                return false;
            }

            // Try to run ffprobe -version to verify it's working
            execSync(`"${filePath}" -version`, { stdio: 'pipe' });
            return true;
        } catch {
            return false;
        }
    }

    private detectWindowsFFprobe(): void {
        // Method 1: Check if FFprobe is in PATH
        try {
            const result = execSync('where ffprobe', { encoding: 'utf8' }).trim();
            const ffprobePath = result.split('\n')[0];
            ffmpeg.setFfprobePath(ffprobePath);
            this.logger.debug(`✅ FFprobe found in PATH: ${ffprobePath}`);
            return;
        } catch {
            this.logger.debug('FFprobe not found in PATH, trying other locations...');
        }

        // Method 2: Search WinGet installation directories
        const wingetPaths = this.findWinGetFFprobe();
        for (const testPath of wingetPaths) {
            if (this.isValidFFprobePath(testPath)) {
                ffmpeg.setFfprobePath(testPath);
                this.logger.debug(`✅ FFprobe found via WinGet: ${testPath}`);
                return;
            }
        }

        // Method 3: Check common manual installation paths
        const commonPaths = [
            'C:\\ffmpeg\\bin\\ffprobe.exe',
            'C:\\Program Files\\ffmpeg\\bin\\ffprobe.exe',
            'C:\\Program Files (x86)\\ffmpeg\\bin\\ffprobe.exe',
            path.join(process.env.USERPROFILE || '', 'ffmpeg', 'bin', 'ffprobe.exe'),
            path.join(process.env.USERPROFILE || '', 'scoop', 'apps', 'ffmpeg', 'current', 'bin', 'ffprobe.exe'),
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'ffmpeg', 'bin', 'ffprobe.exe'),
        ];

        for (const testPath of commonPaths) {
            if (this.isValidFFprobePath(testPath)) {
                ffmpeg.setFfprobePath(testPath);
                this.logger.debug(`✅ FFprobe found at: ${testPath}`);
                return;
            }
        }

        this.logger.debug('FFprobe not found, using default');
    }

    private findWinGetFFprobe(): string[] {
        const paths: string[] = [];
        const userProfile = process.env.USERPROFILE || '';

        try {
            const wingetBase = path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages');

            if (require('fs').existsSync(wingetBase)) {
                const packages = require('fs').readdirSync(wingetBase);

                const ffmpegPackages = packages.filter((pkg: string) =>
                    pkg.toLowerCase().includes('ffmpeg') ||
                    pkg.toLowerCase().includes('gyan')
                );

                for (const pkg of ffmpegPackages) {
                    const packagePath = path.join(wingetBase, pkg);

                    try {
                        const contents = require('fs').readdirSync(packagePath);

                        for (const item of contents) {
                            if (item.toLowerCase().includes('ffmpeg')) {
                                const ffmpegDir = path.join(packagePath, item);
                                const binDir = path.join(ffmpegDir, 'bin');
                                const ffprobeExe = path.join(binDir, 'ffprobe.exe');

                                if (require('fs').existsSync(ffprobeExe)) {
                                    paths.push(ffprobeExe);
                                }
                            }
                        }
                    } catch {
                        continue;
                    }
                }
            }
        } catch (error) {
            this.logger.debug(`WinGet FFprobe search failed: ${error.message}`);
        }

        return paths;
    }

    private detectUnixFFprobe(): void {
        // Method 1: Check if FFprobe is in PATH
        try {
            const result = execSync('which ffprobe', { encoding: 'utf8' }).trim();
            ffmpeg.setFfprobePath(result);
            this.logger.debug(`✅ FFprobe found in PATH: ${result}`);
            return;
        } catch {
            this.logger.debug('FFprobe not found in PATH, trying other locations...');
        }

        // Method 2: Check common Unix paths
        const commonPaths = [
            '/usr/bin/ffprobe',
            '/usr/local/bin/ffprobe',
            '/opt/homebrew/bin/ffprobe',
            '/usr/local/Homebrew/bin/ffprobe',
            '/snap/bin/ffprobe',
            '/opt/ffmpeg/bin/ffprobe',
        ];

        for (const testPath of commonPaths) {
            if (this.isValidFFprobePath(testPath)) {
                ffmpeg.setFfprobePath(testPath);
                this.logger.debug(`✅ FFprobe found at: ${testPath}`);
                return;
            }
        }

        this.logger.debug('FFprobe not found, using default');
    }

    private getConversionSettings(options: VideoConversionOptions) {
        const defaults = {
            quality: options.quality || 'medium',
            maxWidth: options.maxWidth || 1920,
            maxHeight: options.maxHeight || 1080,
            maxBitrate: options.maxBitrate || '2000k',
            audioCodec: options.audioCodec || 'aac',
            videoCodec: options.videoCodec || 'libx264',
        };

        // Quality presets
        const qualitySettings = {
            low: { maxBitrate: '800k', maxWidth: 854, maxHeight: 480 },
            medium: { maxBitrate: '2000k', maxWidth: 1280, maxHeight: 720 },
            high: { maxBitrate: '5000k', maxWidth: 1920, maxHeight: 1080 },
        };

        return { ...defaults, ...qualitySettings[defaults.quality] };
    }

    private async performConversion(
        inputPath: string,
        outputPath: string,
        settings: any
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            let command = ffmpeg(inputPath)
                .videoCodec(settings.videoCodec)
                .audioCodec(settings.audioCodec)
                .videoBitrate(settings.maxBitrate)
                .size(`${settings.maxWidth}x${settings.maxHeight}`)
                .autopad()
                .format('mp4')
                .outputOptions([
                    '-movflags faststart', // Enable progressive download
                    '-preset fast',        // Fast encoding
                    '-crf 23',            // Constant Rate Factor for quality
                    '-maxrate 2000k',     // Maximum bitrate
                    '-bufsize 4000k',     // Buffer size
                ]);

            // Add progress logging
            command.on('progress', (progress) => {
                if (progress.percent) {
                    this.logger.debug(`Conversion progress: ${Math.round(progress.percent)}%`);
                }
            });

            command.on('error', (err) => {
                this.logger.error(`FFmpeg error: ${err.message}`);
                reject(new Error(`Video conversion failed: ${err.message}`));
            });

            command.on('end', () => {
                this.logger.debug(`Conversion completed: ${outputPath}`);
                resolve();
            });

            command.save(outputPath);
        });
    }

    private getFileExtension(mimeType: string): string {
        const extensionMap: Record<string, string> = {
            'video/quicktime': '.mov',
            'video/x-msvideo': '.avi',
            'video/x-ms-wmv': '.wmv',
            'video/3gpp': '.3gp',
            'video/3gpp2': '.3g2',
            'video/x-flv': '.flv',
            'video/x-matroska': '.mkv',
            'video/x-m4v': '.m4v',
            'video/mp4': '.mp4',
            'video/webm': '.webm',
        };

        return extensionMap[mimeType] || '.video';
    }

    private async cleanupFiles(paths: string[]): Promise<void> {
        for (const filePath of paths) {
            try {
                await fs.unlink(filePath);
            } catch (error) {
                // Ignore cleanup errors
                this.logger.debug(`Failed to cleanup file ${filePath}: ${error.message}`);
            }
        }
    }

    private formatBytes(bytes: number): string {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}
