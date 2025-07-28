import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { File, FileDocument } from '../schemas/file.schema';
import { IFileRepository, FindOptions } from '../interfaces/repository.interface';

@Injectable()
export class FileRepository implements IFileRepository {
    constructor(
        @InjectModel(File.name) private fileModel: Model<FileDocument>,
    ) { }

    async create(fileData: Partial<File>): Promise<File> {
        const file = new this.fileModel(fileData);
        return file.save();
    }

    async findById(fileId: string): Promise<File | null> {
        return this.fileModel.findOne({
            fileId,
            isActive: true
        }).exec();
    }

    async findByChecksum(checksum: string, mimeType: string): Promise<File | null> {
        return this.fileModel.findOne({
            checksum,
            mimeType,
            isActive: true,
            virusScanStatus: 'clean'
        }).exec();
    }

    async findByUserId(userId: string, options: FindOptions = {}): Promise<File[]> {
        const {
            limit = 50,
            skip = 0,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = options;

        const sortOptions: Record<string, 1 | -1> = {
            [sortBy]: sortOrder === 'desc' ? -1 : 1
        };

        return this.fileModel
            .find({
                uploadedBy: userId,
                isActive: true
            })
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .exec();
    }

    async updateById(fileId: string, updateData: Partial<File>): Promise<File | null> {
        return this.fileModel.findOneAndUpdate(
            { fileId, isActive: true },
            {
                ...updateData,
                updatedAt: new Date()
            },
            { new: true }
        ).exec();
    }

    async deleteById(fileId: string): Promise<boolean> {
        const result = await this.fileModel.deleteOne({ fileId }).exec();
        return result.deletedCount > 0;
    }

    async softDeleteById(fileId: string): Promise<boolean> {
        const result = await this.fileModel.updateOne(
            { fileId },
            {
                isActive: false,
                updatedAt: new Date()
            }
        ).exec();
        return result.modifiedCount > 0;
    }

    async findUnusedFiles(daysOld: number): Promise<File[]> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        // Find files that:
        // 1. Haven't been accessed in X days
        // 2. Are not linked to any active messages
        return this.fileModel.aggregate([
            {
                $match: {
                    isActive: true,
                    $or: [
                        { lastAccessedAt: { $lt: cutoffDate } },
                        { lastAccessedAt: { $exists: false }, createdAt: { $lt: cutoffDate } }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'message_attachments',
                    localField: 'fileId',
                    foreignField: 'fileId',
                    as: 'attachments'
                }
            },
            {
                $match: {
                    attachments: { $size: 0 } // No active attachments
                }
            }
        ]).exec();
    }

    async updateAccessTime(fileId: string): Promise<void> {
        await this.fileModel.updateOne(
            { fileId },
            {
                lastAccessedAt: new Date(),
                updatedAt: new Date()
            }
        ).exec();
    }

    async incrementDownloadCount(fileId: string): Promise<void> {
        await this.fileModel.updateOne(
            { fileId },
            {
                $inc: { downloadCount: 1 },
                lastAccessedAt: new Date(),
                updatedAt: new Date()
            }
        ).exec();
    }
}
