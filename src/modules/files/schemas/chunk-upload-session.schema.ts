import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ChunkUploadSessionDocument = ChunkUploadSession & Document;

@Schema({
    timestamps: true,
    collection: 'chunk_upload_sessions'
})
export class ChunkUploadSession {
    @Prop({ required: true, unique: true })
    uploadId: string; // UUID for upload session

    @Prop({ required: true })
    uploadedBy: string; // Who is uploading

    @Prop({ required: true })
    fileName: string; // Original filename

    @Prop({ required: true })
    mimeType: string;

    @Prop({ required: true, type: Number })
    totalSize: number; // Total file size

    @Prop({ required: true, type: Number })
    totalChunks: number; // Expected number of chunks

    @Prop({ required: true, type: Number })
    chunkSize: number; // Size of each chunk

    @Prop({ type: [Number], default: [] })
    uploadedChunks: number[]; // Completed chunk numbers

    @Prop({ type: [Number], default: [] })
    failedChunks: number[]; // Failed chunk numbers

    @Prop({ default: 'initiated' })
    status: string; // initiated, uploading, completed, failed, cancelled, expired

    @Prop()
    finalFileId?: string; // FileId after assembly

    @Prop()
    errorMessage?: string; // Error details if failed

    @Prop({ required: true })
    expiresAt: Date; // Session expiration

    @Prop()
    checksum?: string; // For integrity check

    @Prop({ default: Date.now })
    createdAt: Date;

    @Prop({ default: Date.now })
    updatedAt: Date;
}

export const ChunkUploadSessionSchema = SchemaFactory.createForClass(ChunkUploadSession);

// Indexes
ChunkUploadSessionSchema.index({ uploadId: 1 });
ChunkUploadSessionSchema.index({ userId: 1, createdAt: -1 });
ChunkUploadSessionSchema.index({ status: 1 });
ChunkUploadSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
