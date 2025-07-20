import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserContact, UserContactDocument } from '../schemas/user-contact.schema';
import { IUserContactRepository } from '../types';

/**
 * UserContactRepository - MVP Implementation
 * 
 * 🎯 Purpose: Data access layer cho contact sync & discovery
 * 📱 Mobile-First: Bulk operations cho contact import
 * 🚀 Clean Architecture: Repository pattern với interface abstraction
 * 
 * Features:
 * - Bulk contact import (1000+ contacts)
 * - Phone number discovery & mapping
 * - Auto-friend registered contacts
 * - Contact-to-user relationship tracking
 * - Efficient phone number lookups
 */
@Injectable()
export class UserContactRepository implements IUserContactRepository {
    private readonly logger = new Logger(UserContactRepository.name);

    constructor(
        @InjectModel(UserContact.name)
        private readonly userContactModel: Model<UserContactDocument>,
    ) { }

    /**
     * Create single contact entry
     */
    async create(params: Partial<UserContact>): Promise<UserContactDocument> {
        try {
            const contact = new this.userContactModel(params);
            const saved = await contact.save();

            this.logger.log(`Created contact: ${saved.phoneNumber} for user ${saved.userId}`);
            return saved;
        } catch (error) {
            this.logger.error(`Failed to create contact: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all contacts for a user
     */
    async findByUserId(userId: string): Promise<UserContactDocument[]> {
        try {
            if (!Types.ObjectId.isValid(userId)) {
                return [];
            }

            return await this.userContactModel
                .find({
                    userId: new Types.ObjectId(userId),
                    isDeleted: false
                })
                .populate('registeredUserId', 'fullName username phoneNumber avatarUrl activityStatus')
                .sort({ contactName: 1 })
                .exec();
        } catch (error) {
            this.logger.error(`Failed to find contacts for user ${userId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Find contacts by phone number (for discovery)
     */
    async findByPhoneNumber(phoneNumber: string): Promise<UserContactDocument[]> {
        try {
            return await this.userContactModel
                .find({
                    phoneNumber: phoneNumber.trim(),
                    isDeleted: false
                })
                .populate('userId', 'fullName username phoneNumber avatarUrl')
                .populate('registeredUserId', 'fullName username phoneNumber avatarUrl activityStatus')
                .exec();
        } catch (error) {
            this.logger.error(`Failed to find contacts by phone ${phoneNumber}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Bulk create contacts (Mobile contact import)
     */
    async bulkCreate(contacts: Partial<UserContact>[]): Promise<UserContactDocument[]> {
        try {
            if (contacts.length === 0) {
                return [];
            }

            // Add default values
            const contactsWithDefaults = contacts.map(contact => ({
                ...contact,
                lastSyncAt: new Date(),
                contactSource: contact.contactSource || 'phonebook'
            }));

            // Use insertMany với ordered: false để continue on errors
            const result = await this.userContactModel.insertMany(
                contactsWithDefaults,
                {
                    ordered: false,
                    rawResult: true
                }
            );

            this.logger.log(`Bulk created ${result.insertedCount} contacts out of ${contacts.length}`);

            // Return inserted documents
            const insertedIds = Object.values(result.insertedIds);
            return await this.userContactModel
                .find({ _id: { $in: insertedIds } })
                .exec();
        } catch (error) {
            // Handle duplicate key errors gracefully
            if (error.code === 11000) {
                this.logger.warn(`Some contacts already exist during bulk import`);
                // Return partial success - get what was actually created
                const insertedIds = error.result?.insertedIds ? Object.values(error.result.insertedIds) : [];
                if (insertedIds.length > 0) {
                    return await this.userContactModel
                        .find({ _id: { $in: insertedIds } })
                        .exec();
                }
                return [];
            }

            this.logger.error(`Failed to bulk create contacts: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update registration status when contact registers
     */
    async updateRegistrationStatus(contactId: string, registeredUserId: string): Promise<UserContactDocument> {
        try {
            if (!Types.ObjectId.isValid(contactId) || !Types.ObjectId.isValid(registeredUserId)) {
                throw new Error('Invalid contact or user ID');
            }

            const updated = await this.userContactModel
                .findByIdAndUpdate(
                    contactId,
                    {
                        registeredUserId: new Types.ObjectId(registeredUserId),
                        isRegistered: true,
                        registeredAt: new Date()
                    },
                    { new: true }
                )
                .populate('registeredUserId', 'fullName username phoneNumber avatarUrl activityStatus')
                .exec();

            if (!updated) {
                throw new Error('Contact not found');
            }

            this.logger.log(`Updated contact ${contactId} registration status`);
            return updated;
        } catch (error) {
            this.logger.error(`Failed to update registration status: ${error.message}`);
            throw error;
        }
    }

    /**
     * Find registered contacts by phone numbers (bulk lookup)
     */
    async findRegisteredContacts(phoneNumbers: string[]): Promise<UserContactDocument[]> {
        try {
            if (phoneNumbers.length === 0) {
                return [];
            }

            // Clean phone numbers
            const cleanNumbers = phoneNumbers.map(num => num.trim()).filter(num => num.length > 0);

            return await this.userContactModel
                .find({
                    phoneNumber: { $in: cleanNumbers },
                    isRegistered: true,
                    isDeleted: false
                })
                .populate('registeredUserId', 'fullName username phoneNumber avatarUrl activityStatus lastSeen')
                .populate('userId', 'fullName username')
                .exec();
        } catch (error) {
            this.logger.error(`Failed to find registered contacts: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get contacts ready for auto-friend (when they register)
     */
    async findAutoFriendCandidates(phoneNumber: string): Promise<UserContactDocument[]> {
        try {
            return await this.userContactModel
                .find({
                    phoneNumber: phoneNumber.trim(),
                    autoFriendWhenRegisters: true,
                    autoFriended: false,
                    isDeleted: false
                })
                .populate('userId', 'fullName username phoneNumber')
                .exec();
        } catch (error) {
            this.logger.error(`Failed to find auto-friend candidates for ${phoneNumber}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Mark contact as auto-friended
     */
    async markAutoFriended(contactId: string): Promise<boolean> {
        try {
            if (!Types.ObjectId.isValid(contactId)) {
                return false;
            }

            const result = await this.userContactModel
                .updateOne(
                    { _id: contactId },
                    {
                        autoFriended: true,
                        autoFriendedAt: new Date()
                    }
                )
                .exec();

            const success = result.modifiedCount > 0;
            if (success) {
                this.logger.log(`Marked contact ${contactId} as auto-friended`);
            }

            return success;
        } catch (error) {
            this.logger.error(`Failed to mark contact as auto-friended: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update contact sync timestamp
     */
    async updateSyncTimestamp(userId: string): Promise<void> {
        try {
            if (!Types.ObjectId.isValid(userId)) {
                return;
            }

            await this.userContactModel
                .updateMany(
                    { userId: new Types.ObjectId(userId) },
                    { lastSyncAt: new Date() }
                )
                .exec();
        } catch (error) {
            this.logger.error(`Failed to update sync timestamp for user ${userId}: ${error.message}`);
        }
    }

    /**
     * Delete contacts (soft delete)
     */
    async delete(contactId: string): Promise<boolean> {
        try {
            if (!Types.ObjectId.isValid(contactId)) {
                return false;
            }

            const result = await this.userContactModel
                .updateOne({ _id: contactId }, { isDeleted: true })
                .exec();

            return result.modifiedCount > 0;
        } catch (error) {
            this.logger.error(`Failed to delete contact ${contactId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get contact statistics for user
     */
    async getContactStats(userId: string): Promise<{
        total: number;
        registered: number;
        autoFriended: number;
    }> {
        try {
            if (!Types.ObjectId.isValid(userId)) {
                return { total: 0, registered: 0, autoFriended: 0 };
            }

            const stats = await this.userContactModel
                .aggregate([
                    {
                        $match: {
                            userId: new Types.ObjectId(userId),
                            isDeleted: false
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: 1 },
                            registered: {
                                $sum: { $cond: ['$isRegistered', 1, 0] }
                            },
                            autoFriended: {
                                $sum: { $cond: ['$autoFriended', 1, 0] }
                            }
                        }
                    }
                ])
                .exec();

            return stats[0] || { total: 0, registered: 0, autoFriended: 0 };
        } catch (error) {
            this.logger.error(`Failed to get contact stats for user ${userId}: ${error.message}`);
            return { total: 0, registered: 0, autoFriended: 0 };
        }
    }

    /**
     * Check if contact already exists (để avoid duplicates)
     */
    async exists(userId: string, phoneNumber: string): Promise<boolean> {
        try {
            if (!Types.ObjectId.isValid(userId)) {
                return false;
            }

            const contact = await this.userContactModel
                .findOne({
                    userId: new Types.ObjectId(userId),
                    phoneNumber: phoneNumber.trim(),
                    isDeleted: false
                })
                .select('_id')
                .exec();

            return !!contact;
        } catch (error) {
            this.logger.error(`Failed to check contact existence: ${error.message}`);
            return false;
        }
    }
}
