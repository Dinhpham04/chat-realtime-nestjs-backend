import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { MessageAttachment, MessageAttachmentDocument } from '../schemas/message-attachment.schema';
import { IMessageAttachmentRepository } from '../interfaces/repository.interface';

@Injectable()
export class MessageAttachmentRepository implements IMessageAttachmentRepository {
    constructor(
        @InjectModel(MessageAttachment.name)
        private attachmentModel: Model<MessageAttachmentDocument>,
    ) { }

    async create(attachmentData: Partial<MessageAttachment>): Promise<MessageAttachment> {
        const attachment = new this.attachmentModel(attachmentData);
        return attachment.save();
    }

    async findByMessageId(messageId: string): Promise<MessageAttachment[]> {
        return this.attachmentModel
            .find({
                messageId,
                isActive: true
            })
            .sort({ attachmentOrder: 1 })
            .exec();
    }

    async findByFileId(fileId: string): Promise<MessageAttachment[]> {
        return this.attachmentModel
            .find({
                fileId,
                isActive: true
            })
            .sort({ createdAt: -1 })
            .exec();
    }

    async linkFileToMessage(
        fileId: string,
        messageId: string,
        caption?: string
    ): Promise<MessageAttachment> {
        // Get current attachment count for ordering
        const attachmentCount = await this.attachmentModel
            .countDocuments({ messageId, isActive: true });

        return this.create({
            attachmentId: uuidv4(),
            messageId,
            fileId,
            caption,
            attachmentOrder: attachmentCount
        });
    }

    async unlinkFileFromMessage(fileId: string, messageId: string): Promise<boolean> {
        const result = await this.attachmentModel.updateOne(
            { fileId, messageId },
            {
                isActive: false,
                updatedAt: new Date()
            }
        ).exec();

        return result.modifiedCount > 0;
    }

    async deleteByMessageId(messageId: string): Promise<void> {
        await this.attachmentModel.updateMany(
            { messageId },
            {
                isActive: false,
                updatedAt: new Date()
            }
        ).exec();
    }
}
