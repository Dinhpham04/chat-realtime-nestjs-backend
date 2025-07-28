import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FileDocument = File & Document;

@Schema({
    timestamps: true,
    collection: 'files'
})
export class File {
    @Prop({ required: true, unique: true })
    fileId: string; // UUID v4

    @Prop({ required: true })
    originalFilename: string;

    @Prop({ required: true })
    fileName: string; // Stored filename (with extension)

    @Prop({ required: true })
    mimeType: string;

    @Prop({ required: true, type: Number })
    fileSize: number; // Bytes

    @Prop({ required: true })
    checksum: string; // SHA-256 for deduplication

    @Prop({ required: true })
    storagePath: string; // S3/local storage path

    @Prop()
    thumbnailPath?: string; // For images/videos

    @Prop()
    previewPath?: string; // For documents/videos

    @Prop({ required: true })
    uploadedBy: string; // User ID

    @Prop({ default: false })
    isProcessed: boolean; // Async processing status

    @Prop({ default: 'pending' })
    virusScanStatus: string; // pending, clean, infected, failed

    @Prop()
    virusScanResult?: string; // Scan details

    @Prop({ default: true })
    isActive: boolean; // Soft delete

    @Prop({ default: 0 })
    downloadCount: number; // Usage tracking

    @Prop()
    lastAccessedAt?: Date; // For cleanup policy

    @Prop({
        type: {
            width: Number,
            height: Number,
            duration: Number, // For video/audio
            compression: String,
            encoding: String
        }
    })
    metadata?: {
        width?: number;
        height?: number;
        duration?: number; // For video/audio
        compression?: string;
        encoding?: string;
    };

    @Prop({ default: Date.now })
    createdAt: Date;

    @Prop({ default: Date.now })
    updatedAt: Date;
}

export const FileSchema = SchemaFactory.createForClass(File);

// Indexes for performance
FileSchema.index({ checksum: 1, mimeType: 1 }); // Deduplication
FileSchema.index({ uploadedBy: 1, createdAt: -1 }); // User files
FileSchema.index({ isActive: 1, createdAt: -1 }); // Active files
FileSchema.index({ virusScanStatus: 1 }); // Scan status
FileSchema.index({ lastAccessedAt: 1 }); // Cleanup policy
