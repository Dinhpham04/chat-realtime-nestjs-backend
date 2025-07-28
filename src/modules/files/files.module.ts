import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

// Redis module import
import { RedisModule } from '../../redis/redis.module';

// Schemas
import { File, FileSchema } from './schemas/file.schema';
import { MessageAttachment, MessageAttachmentSchema } from './schemas/message-attachment.schema';
import { ChunkUploadSession, ChunkUploadSessionSchema } from './schemas/chunk-upload-session.schema';

// Repositories
import { FileRepository } from './repositories/file.repository';
import { MessageAttachmentRepository } from './repositories/message-attachment.repository';
import { ChunkUploadSessionRepository } from './repositories/chunk-upload-session.repository';

// Services
import { FileValidationService } from './services/file-validation.service';
import { StorageService } from './services/storage.service';
import { FilesService } from './services/files.service';
import { ChunkUploadService } from './services/chunk-upload.service';

// Controllers
import { FilesController } from './controllers/files.controller';
import { ChunkUploadController } from './controllers/chunk-upload.controller';

@Module({
    imports: [
        // Redis module for chunk sessions and download tokens
        RedisModule,

        // Database schemas
        MongooseModule.forFeature([
            { name: File.name, schema: FileSchema },
            { name: MessageAttachment.name, schema: MessageAttachmentSchema },
            { name: ChunkUploadSession.name, schema: ChunkUploadSessionSchema },
        ]),

        // Configuration
        ConfigModule,
    ],

    controllers: [
        // Phase 2: Controllers
        FilesController,
        ChunkUploadController,
    ],

    providers: [
        // Repositories
        FileRepository,
        MessageAttachmentRepository,
        ChunkUploadSessionRepository,

        // Provide repository interfaces
        {
            provide: 'IFileRepository',
            useClass: FileRepository,
        },
        {
            provide: 'IMessageAttachmentRepository',
            useClass: MessageAttachmentRepository,
        },

        // Note: ChunkUploadSessionRepository no longer used - replaced by Redis
        // Keeping for backwards compatibility if needed
        {
            provide: 'IChunkUploadSessionRepository',
            useClass: ChunkUploadSessionRepository,
        },

        // Services
        FileValidationService,
        StorageService,
        FilesService,
        ChunkUploadService,
    ],

    exports: [
        FileRepository,
        MessageAttachmentRepository,
        ChunkUploadSessionRepository,
        'IFileRepository',
        'IMessageAttachmentRepository',
        'IChunkUploadSessionRepository',

        // Export services for other modules
        FileValidationService,
        StorageService,
        FilesService,
        ChunkUploadService,
    ],
})
export class FilesModule { }
