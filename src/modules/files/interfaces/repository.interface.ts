import { File } from '../schemas/file.schema';
import { MessageAttachment } from '../schemas/message-attachment.schema';
import { ChunkUploadSession } from '../schemas/chunk-upload-session.schema';

export interface IFileRepository {
    create(fileData: Partial<File>): Promise<File>;
    findById(fileId: string): Promise<File | null>;
    findByChecksum(checksum: string, mimeType: string): Promise<File | null>;
    findByUserId(userId: string, options?: FindOptions): Promise<File[]>;
    updateById(fileId: string, updateData: Partial<File>): Promise<File | null>;
    deleteById(fileId: string): Promise<boolean>;
    softDeleteById(fileId: string): Promise<boolean>;
    findUnusedFiles(daysOld: number): Promise<File[]>;
    updateAccessTime(fileId: string): Promise<void>;
    incrementDownloadCount(fileId: string): Promise<void>;
}

export interface IMessageAttachmentRepository {
    create(attachmentData: Partial<MessageAttachment>): Promise<MessageAttachment>;
    findByMessageId(messageId: string): Promise<MessageAttachment[]>;
    findByFileId(fileId: string): Promise<MessageAttachment[]>;
    linkFileToMessage(fileId: string, messageId: string, caption?: string): Promise<MessageAttachment>;
    unlinkFileFromMessage(fileId: string, messageId: string): Promise<boolean>;
    deleteByMessageId(messageId: string): Promise<void>;
}

export interface IChunkUploadSessionRepository {
    create(sessionData: Partial<ChunkUploadSession>): Promise<ChunkUploadSession>;
    findByUploadId(uploadId: string): Promise<ChunkUploadSession | null>;
    findByUserId(userId: string): Promise<ChunkUploadSession[]>;
    markChunkCompleted(uploadId: string, chunkNumber: number): Promise<void>;
    markChunkFailed(uploadId: string, chunkNumber: number): Promise<void>;
    removeFailedChunk(uploadId: string, chunkNumber: number): Promise<void>;
    markSessionCompleted(uploadId: string, finalFileId: string): Promise<void>;
    markSessionFailed(uploadId: string, errorMessage: string): Promise<void>;
    markSessionCancelled(uploadId: string): Promise<void>;
    cleanupExpiredSessions(): Promise<number>;
}

export interface FindOptions {
    limit?: number;
    skip?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
