import { Test, TestingModule } from '@nestjs/testing';
import { FilesController } from '../controllers/files.controller';
import { FilesService } from '../services/files.service';
import { FileValidationService } from '../services/file-validation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BadRequestException } from '@nestjs/common';

describe('FilesController', () => {
    let controller: FilesController;
    let filesService: FilesService;
    let validationService: FileValidationService;

    const mockFilesService = {
        uploadFile: jest.fn(),
        getFile: jest.fn(),
        getUserFiles: jest.fn(),
        generateDownloadUrl: jest.fn(),
        linkFileToMessage: jest.fn(),
        getMessageFiles: jest.fn(),
        deleteFile: jest.fn(),
        getFileStatistics: jest.fn(),
    };

    const mockValidationService = {
        validateFile: jest.fn(),
    };

    const mockAuthGuard = {
        canActivate: jest.fn(() => true),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [FilesController],
            providers: [
                {
                    provide: FilesService,
                    useValue: mockFilesService,
                },
                {
                    provide: FileValidationService,
                    useValue: mockValidationService,
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue(mockAuthGuard)
            .compile();

        controller = module.get<FilesController>(FilesController);
        filesService = module.get<FilesService>(FilesService);
        validationService = module.get<FileValidationService>(FileValidationService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('uploadFile', () => {
        const mockFile = {
            originalname: 'test.jpg',
            mimetype: 'image/jpeg',
            size: 1024 * 1024, // 1MB
            buffer: Buffer.from('fake image data'),
        } as Express.Multer.File;

        const mockUser = { id: 'user123', email: 'test@example.com' };
        const mockRequest = { user: mockUser } as any;

        it('should upload file successfully', async () => {
            // Arrange
            const expectedResult = {
                fileId: 'file123',
                fileName: 'test.jpg',
                originalName: 'test.jpg',
                fileSize: 1024 * 1024,
                mimeType: 'image/jpeg',
                downloadUrl: 'https://example.com/download/file123',
                isNew: true,
            };

            mockFilesService.uploadFile.mockResolvedValue(expectedResult);

            // Act
            const result = await controller.uploadFile(mockFile, mockRequest);

            // Assert
            expect(result.success).toBe(true);
            expect(result.data.fileId).toBe('file123');
            expect(result.data.originalName).toBe('test.jpg');
            expect(filesService.uploadFile).toHaveBeenCalledWith(
                {
                    originalName: 'test.jpg',
                    mimeType: 'image/jpeg',
                    size: 1024 * 1024,
                    buffer: mockFile.buffer,
                },
                'user123',
            );
        });

        it('should throw error when no file provided', async () => {
            // Act & Assert
            await expect(controller.uploadFile(undefined as any, mockRequest))
                .rejects.toThrow(BadRequestException);
        });

        it('should handle deuplicated files', async () => {
            // Arrange
            const duplicateResult = {
                fileId: 'existing123',
                fileName: 'test.jpg',
                originalName: 'test.jpg',
                fileSize: 1024 * 1024,
                mimeType: 'image/jpeg',
                downloadUrl: 'https://example.com/download/existing123',
                isNew: false,
            };

            mockFilesService.uploadFile.mockResolvedValue(duplicateResult);

            // Act
            const result = await controller.uploadFile(mockFile, mockRequest);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toContain('already exists');
            expect(result.data.isNew).toBe(false);
        });
    });

    describe('getFileDetails', () => {
        it('should return file details successfully', async () => {
            // Arrange
            const mockFile = {
                fileId: 'file123',
                fileName: 'test.jpg',
                originalFilename: 'test.jpg',
                mimeType: 'image/jpeg',
                fileSize: 1024 * 1024,
                uploadedBy: 'user123',
                createdAt: new Date(),
                downloadCount: 5,
                isProcessed: true,
                virusScanStatus: 'clean',
                metadata: { width: 800, height: 600 },
            };

            const mockUser = { id: 'user123', email: 'test@example.com' };
            const mockRequest = { user: mockUser } as any;

            mockFilesService.getFile.mockResolvedValue(mockFile);

            // Act
            const result = await controller.getFileDetails('file123', mockRequest);

            // Assert
            expect(result.success).toBe(true);
            expect(result.data.fileId).toBe('file123');
            expect(result.data.downloadCount).toBe(5);
            expect(filesService.getFile).toHaveBeenCalledWith('file123', 'user123');
        });
    });

    describe('generateDownloadUrl', () => {
        it('should generate download URL successfully', async () => {
            // Arrange
            const mockUser = { id: 'user123', email: 'test@example.com' };
            const mockRequest = { user: mockUser } as any;
            const mockDownloadUrl = 'https://example.com/download/file123?token=abc123';
            const mockOptions = { expiresIn: 3600 };

            mockFilesService.generateDownloadUrl.mockResolvedValue(mockDownloadUrl);

            // Act
            const result = await controller.generateDownloadUrl('file123', mockOptions, mockRequest);

            // Assert
            expect(result.downloadUrl).toBe(mockDownloadUrl);
            expect(result.expiresAt).toBeDefined();
            expect(filesService.generateDownloadUrl).toHaveBeenCalledWith('file123', 'user123', mockOptions);
        });
    });

    describe('healthCheck', () => {
        it('should return health status', async () => {
            // Act
            const result = await controller.healthCheck();

            // Assert
            expect(result.status).toBe('healthy');
            expect(result.timestamp).toBeDefined();
        });
    });
});
