import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MessageAttachmentDocument = MessageAttachment & Document;

@Schema({
    timestamps: true,
    collection: 'message_attachments'
})
export class MessageAttachment {
    @Prop({ required: true, unique: true })
    attachmentId: string; // Unique identifier for the attachment

    @Prop({ required: true })
    messageId: string; // Reference to Message

    @Prop({ required: true })
    fileId: string; // Reference to File

    @Prop()
    caption?: string; // Optional caption for images

    @Prop({ default: 0 })
    attachmentOrder: number; // Order in message (for multiple files)

    @Prop({ default: true })
    isActive: boolean; // Soft delete

    @Prop({ default: Date.now })
    createdAt: Date;

    @Prop({ default: Date.now })
    updatedAt: Date;
}

export const MessageAttachmentSchema = SchemaFactory.createForClass(MessageAttachment);

// Indexes
MessageAttachmentSchema.index({ messageId: 1 }); // Get files by message
MessageAttachmentSchema.index({ fileId: 1 }); // Get messages by file
MessageAttachmentSchema.index({ messageId: 1, fileId: 1 }, { unique: true }); // Prevent duplicates
