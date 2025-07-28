import { Test, TestingModule } from '@nestjs/testing';
import { ChunkUploadController } from '../controllers/chunk-upload.controller';
import { ChunkUploadService } from '../services/chunk-upload.service';
import { FilesService } from '../services/files.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

describe('ChunkUploadController', () => {
    let controller: ChunkUploadController;
    let chunkUploadService: ChunkUploadService;
    let filesService: FilesService;

    const mockChunkUploadService = {
        initiateChunkUpload: jest.fn(),
        uploadChunk: jest.fn(),
        getUploadProgress: jest.fn(),
        completeChunkUpload: jest.fn(),
        cancelUpload: jest.fn(),
    };

    const mockFilesService = {
        uploadFile: jest.fn(),
    };

    const mockAuthGuard = {
        canActivate: jest.fn(() => true),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ChunkUploadController],
            providers: [
                {
                    provide: ChunkUploadService,
                    useValue: mockChunkUploadService,
                },
                {
                    provide: FilesService,
                    useValue: mockFilesService,
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue(mockAuthGuard)
            .compile();

        controller = module.get<ChunkUploadController>(ChunkUploadController);
        chunkUploadService = module.get<ChunkUploadService>(ChunkUploadService);
        filesService = module.get<FilesService>(FilesService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('initiateUpload', () => {
        const mockUser = { id: 'user123', email: 'test@example.com' };
        const mockRequest = { user: mockUser } as any;

        it('should initiate chunk upload successfully', async () => {
            // Arrange
            const uploadData = {
                fileName: 'large-video.mp4',
                fileSize: 50 * 1024 * 1024, // 50MB
                mimeType: 'video/mp4',
            };

            const expectedUploadInfo = {
                uploadId: 'upload123',
                fileName: 'large-video.mp4',
                totalSize: 50 * 1024 * 1024,
                mimeType: 'video/mp4',
                totalChunks: 25,
                chunkSize: 2 * 1024 * 1024, // 2MB chunks
            };

            mockChunkUploadService.initiateChunkUpload.mockResolvedValue(expectedUploadInfo);

            // Act
            const result = await controller.initiateUpload(uploadData, mockRequest);

            // Assert
            expect(result.success).toBe(true);
            expect(result.data.uploadId).toBe('upload123');
            expect(result.data.totalChunks).toBe(25);
            expect(result.data.expiresAt).toBeDefined();
            expect(chunkUploadService.initiateChunkUpload).toHaveBeenCalledWith(
                'large-video.mp4',
                50 * 1024 * 1024,
                'video/mp4',
                'user123',
            );
        });
    });

    describe('uploadChunk', () => {
        const mockUser = { id: 'user123', email: 'test@example.com' };
        const mockRequest = { user: mockUser } as any;

        it('should upload chunk successfully', async () => {
            // Arrange
            const chunkData = Buffer.from('chunk data for testing');
            const checksum = crypto.createHash('sha256').update(chunkData).digest('hex');

            const mockChunkFile = {
                buffer: chunkData,
                size: chunkData.length,
                originalname: 'chunk',
                mimetype: 'application/octet-stream',
            } as Express.Multer.File;

            const expectedProgress = {
                uploadId: 'upload123',
                totalChunks: 25,
                completedChunks: 1,
                percentage: 4,
                isComplete: false,
                failedChunks: [],
            };

            mockChunkUploadService.uploadChunk.mockResolvedValue(expectedProgress);

            // Act
            const result = await controller.uploadChunk(
                'upload123',
                '0',
                mockChunkFile,
                checksum,
                mockRequest,
            );

            // Assert
            expect(result.success).toBe(true);
            expect(result.data.chunkNumber).toBe(0);
            expect(result.data.percentage).toBe(4);
            expect(chunkUploadService.uploadChunk).toHaveBeenCalledWith(
                'upload123',
                0,
                chunkData,
                checksum,
                'user123',
            );
        });

        it('should throw error when no chunk file provided', async () => {
            // Act & Assert
            await expect(
                controller.uploadChunk('upload123', '0', undefined as any, 'checksum', mockRequest),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw error when no checksum provided', async () => {
            // Arrange
            const mockChunkFile = {
                buffer: Buffer.from('chunk data'),
                size: 10,
            } as Express.Multer.File;

            // Act & Assert
            await expect(
                controller.uploadChunk('upload123', '0', mockChunkFile, '', mockRequest),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw error when checksum verification fails', async () => {
            // Arrange
            const chunkData = Buffer.from('chunk data for testing');
            const wrongChecksum = 'wrong_checksum';

            const mockChunkFile = {
                buffer: chunkData,
                size: chunkData.length,
            } as Express.Multer.File;

            // Act & Assert
            await expect(
                controller.uploadChunk('upload123', '0', mockChunkFile, wrongChecksum, mockRequest),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('getUploadProgress', () => {
        const mockUser = { id: 'user123', email: 'test@example.com' };
        const mockRequest = { user: mockUser } as any;

        it('should return upload progress successfully', async () => {
            // Arrange
            const expectedProgress = {
                uploadId: 'upload123',
                totalChunks: 25,
                completedChunks: 10,
                percentage: 40,
                isComplete: false,
                failedChunks: [5, 7],
            };

            mockChunkUploadService.getUploadProgress.mockResolvedValue(expectedProgress);

            // Act
            const result = await controller.getUploadProgress('upload123', mockRequest);

            // Assert
            expect(result.success).toBe(true);
            expect(result.data.percentage).toBe(40);
            expect(result.data.failedChunks).toEqual([5, 7]);
            expect(chunkUploadService.getUploadProgress).toHaveBeenCalledWith('upload123', 'user123');
        });
    });

    describe('completeUpload', () => {
        const mockUser = { id: 'user123', email: 'test@example.com' };
        const mockRequest = { user: mockUser } as any;

        it('should complete upload successfully', async () => {
            // Arrange
            const completeData = {
                uploadId: 'upload123',
                checksum: 'final_file_checksum',
            };

            const assemblyResult = {
                fileId: 'file123',
                fileName: 'large-video.mp4',
                fileSize: 50 * 1024 * 1024,
                mimeType: 'video/mp4',
                downloadUrl: 'https://example.com/download/file123',
            };

            mockChunkUploadService.completeChunkUpload.mockResolvedValue(assemblyResult);

            // Act
            const result = await controller.completeUpload('upload123', completeData, mockRequest);

            // Assert
            expect(result.success).toBe(true);
            expect(result.data.fileId).toBe('file123');
            expect(result.data.fileName).toBe('large-video.mp4');
            expect(chunkUploadService.completeChunkUpload).toHaveBeenCalledWith(
                'upload123',
                'final_file_checksum',
                'user123',
            );
        });
    });

    describe('healthCheck', () => {
        it('should return health status with configuration', async () => {
            // Act
            const result = await controller.healthCheck();

            // Assert
            expect(result.status).toBe('healthy');
            expect(result.chunkSize).toBeDefined();
            expect(result.maxFileSize).toBeDefined();
            expect(result.maxChunks).toBe(1000);
            expect(result.timestamp).toBeDefined();
        });
    });
});
