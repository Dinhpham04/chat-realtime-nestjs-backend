import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChunkUploadSession, ChunkUploadSessionDocument } from '../schemas/chunk-upload-session.schema';
import { IChunkUploadSessionRepository } from '../interfaces/repository.interface';

@Injectable()
export class ChunkUploadSessionRepository implements IChunkUploadSessionRepository {
    constructor(
        @InjectModel(ChunkUploadSession.name)
        private sessionModel: Model<ChunkUploadSessionDocument>,
    ) { }

    async create(sessionData: Partial<ChunkUploadSession>): Promise<ChunkUploadSession> {
        const session = new this.sessionModel(sessionData);
        return session.save();
    }

    async findByUploadId(uploadId: string): Promise<ChunkUploadSession | null> {
        return this.sessionModel.findOne({ uploadId, status: { $nin: ['expired'] } }).exec();
    }

    async findByUserId(userId: string): Promise<ChunkUploadSession[]> {
        return this.sessionModel
            .find({ uploadedBy: userId, status: { $nin: ['expired'] } })
            .sort({ createdAt: -1 })
            .exec();
    }

    async markChunkCompleted(uploadId: string, chunkNumber: number): Promise<void> {
        await this.sessionModel.updateOne(
            { uploadId },
            {
                $addToSet: { uploadedChunks: chunkNumber },
                $set: { status: 'uploading', updatedAt: new Date() },
            },
        ).exec();
    }

    async markChunkFailed(uploadId: string, chunkNumber: number): Promise<void> {
        await this.sessionModel.updateOne(
            { uploadId },
            {
                $addToSet: { failedChunks: chunkNumber },
                $set: { updatedAt: new Date() },
            },
        ).exec();
    }

    async removeFailedChunk(uploadId: string, chunkNumber: number): Promise<void> {
        await this.sessionModel.updateOne(
            { uploadId },
            {
                $pull: { failedChunks: chunkNumber },
                $set: { updatedAt: new Date() },
            },
        ).exec();
    }

    async markSessionCompleted(uploadId: string, finalFileId: string): Promise<void> {
        await this.sessionModel.updateOne(
            { uploadId },
            {
                $set: {
                    status: 'completed',
                    finalFileId,
                    updatedAt: new Date(),
                },
            },
        ).exec();
    }

    async markSessionFailed(uploadId: string, errorMessage: string): Promise<void> {
        await this.sessionModel.updateOne(
            { uploadId },
            {
                $set: {
                    status: 'failed',
                    errorMessage,
                    updatedAt: new Date(),
                },
            },
        ).exec();
    }

    async markSessionCancelled(uploadId: string): Promise<void> {
        await this.sessionModel.updateOne(
            { uploadId },
            {
                $set: {
                    status: 'cancelled',
                    updatedAt: new Date(),
                },
            },
        ).exec();
    }

    async cleanupExpiredSessions(): Promise<number> {
        const result = await this.sessionModel.updateMany(
            {
                expiresAt: { $lt: new Date() },
                status: { $nin: ['completed', 'failed', 'cancelled'] },
            },
            {
                $set: {
                    status: 'expired',
                    updatedAt: new Date(),
                },
            },
        ).exec();

        return result.modifiedCount;
    }
}
