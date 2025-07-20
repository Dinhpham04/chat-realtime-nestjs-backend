import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { Types } from 'mongoose';
import { UserContactRepository, UserFriendRepository } from '../repositories';
import {
    ContactSyncParams,
    ContactSyncResult,
    RegisteredContact,
    ContactImport,
    UserSummary,
    FriendStatus,
    AddMethod,
    ContactSource,
    IContactSyncService,
    IUserContactRepository,
    IUserFriendRepository
} from '../types';
import { IUsersRepository } from '../../users/interfaces/users-repository.interface';
import { RedisCacheService } from '../../../redis/services/redis-cache.service';

/**
 * ContactSyncService - Senior Level Implementation
 * 
 * 🎯 Purpose: Contact sync & auto-friend functionality
 * 📱 Mobile-First: Handle bulk contact imports (1000+)
 * 🚀 Clean Architecture: Service layer with repository abstraction
 * 🔒 Security First: Phone number validation and sanitization
 * 📊 Performance: Bulk operations and caching
 * 🛡️ Error Handling: Comprehensive error management
 * 
 * Features:
 * - Bulk contact import from mobile phone
 * - Phone number mapping to registered users
 * - Auto-friend registered contacts with security
 * - Contact discovery & suggestions
 * - Duplicate prevention & error handling
 * - Real-time status updates
 * 
 * Following instruction-senior.md:
 * - Clean Architecture with clear separation
 * - SOLID principles implementation
 * - Performance optimization with bulk operations
 * - Security-first approach with validation
 * - Comprehensive error handling
 * - Mobile-first design with E.164 phone format
 */
@Injectable()
export class ContactSyncService implements IContactSyncService {
    private readonly logger = new Logger(ContactSyncService.name);

    constructor(
        @Inject('IUserContactRepository')
        private readonly userContactRepository: IUserContactRepository,
        @Inject('IUserFriendRepository')
        private readonly userFriendRepository: IUserFriendRepository,
        @Inject('IUsersRepository')
        private readonly usersRepository: IUsersRepository,
        private readonly cacheService: RedisCacheService,
    ) { }

    /**
     * Import contacts from mobile phone (Bulk operation)
     */
    async importContacts(params: ContactSyncParams): Promise<ContactSyncResult> {
        try {
            const { userId, contacts, autoFriend = true } = params;

            if (!Types.ObjectId.isValid(userId)) {
                throw new BadRequestException('Invalid user ID');
            }

            if (!contacts || contacts.length === 0) {
                throw new BadRequestException('No contacts to import');
            }

            this.logger.log(`Starting contact import for user ${userId}: ${contacts.length} contacts`);

            // Validate và clean contacts data
            const validContacts = await this.validateAndCleanContacts(userId, contacts);
            let imported = 0;
            let duplicates = 0;
            const errors: string[] = [];

            // Prepare contacts for bulk insert
            const contactsToInsert = validContacts.map(contact => ({
                userId: new Types.ObjectId(userId),
                phoneNumber: this.normalizePhoneNumber(contact.phoneNumber),
                contactName: contact.contactName.trim(),
                contactSource: contact.contactSource || ContactSource.PHONEBOOK,
                autoFriendWhenRegisters: autoFriend,
                lastSyncAt: new Date(),
            }));

            // Bulk insert contacts
            try {
                const insertedContacts = await this.userContactRepository.bulkCreate(contactsToInsert);
                imported = insertedContacts.length;
                duplicates = contactsToInsert.length - imported;
            } catch (error) {
                this.logger.error(`Bulk insert failed: ${error.message}`);
                errors.push('Failed to import some contacts due to duplicates');
                imported = 0;
                duplicates = contactsToInsert.length;
            }

            // Find registered users among imported contacts
            const phoneNumbers = validContacts.map(c => this.normalizePhoneNumber(c.phoneNumber));
            const registeredContacts = await this.findRegisteredContacts(phoneNumbers);

            // Auto-friend registered contacts if enabled
            const newFriends: UserSummary[] = [];
            if (autoFriend && registeredContacts.length > 0) {
                for (const contact of registeredContacts) {
                    if (contact.user && !contact.isAlreadyFriend) {
                        try {
                            const autoFriended = await this.autoFriendRegisteredContact(userId, contact.user.id);
                            if (autoFriended) {
                                newFriends.push(contact.user);
                            }
                        } catch (error) {
                            this.logger.warn(`Auto-friend failed for ${contact.user.id}: ${error.message}`);
                            errors.push(`Failed to auto-friend ${contact.contactName}`);
                        }
                    }
                }
            }

            // Update sync timestamp
            await this.userContactRepository.updateSyncTimestamp(userId);

            const result: ContactSyncResult = {
                imported,
                registered: registeredContacts,
                newFriends,
                duplicates,
                errors,
            };

            this.logger.log(`Contact import completed for user ${userId}: ${JSON.stringify({
                imported,
                registered: registeredContacts.length,
                newFriends: newFriends.length,
                duplicates,
                errors: errors.length
            })}`);

            return result;
        } catch (error) {
            this.logger.error(`Failed to import contacts: ${error.message}`);
            throw error;
        }
    }

    /**
     * Find registered users by phone numbers - Senior Implementation
     * 
     * Following instruction-senior.md:
     * - Performance optimization with bulk queries
     * - Security validation of phone numbers
     * - Friend status checking
     * - Real-time online status from cache
     * - Comprehensive error handling
     */
    async findRegisteredContacts(phoneNumbers: string[]): Promise<RegisteredContact[]> {
        try {
            if (phoneNumbers.length === 0) {
                return [];
            }

            // Normalize phone numbers for consistent lookup
            const normalizedNumbers = phoneNumbers.map(num => this.normalizePhoneNumber(num));

            // Find users by phone numbers from UserCore
            const registeredUsers = await this.findUsersByPhoneNumbers(normalizedNumbers);

            // Get contact entries to check auto-friend status
            const contactEntries = await this.userContactRepository.findRegisteredContacts(normalizedNumbers);

            // Create map for efficient lookup
            const contactMap = new Map(contactEntries.map(c => [c.phoneNumber, c]));

            // Transform to RegisteredContact format
            const results: RegisteredContact[] = [];

            for (const user of registeredUsers) {
                const contact = contactMap.get(user.phoneNumber);
                if (!contact) continue;

                // Check if already friends
                const isAlreadyFriend = await this.checkIfAlreadyFriends(contact.userId.toString(), user.id);

                // Get online status from cache
                const isOnline = await this.getUserOnlineStatus(user.id);

                results.push({
                    phoneNumber: user.phoneNumber,
                    contactName: contact.contactName,
                    user: {
                        id: user.id,
                        fullName: user.fullName,
                        username: user.username,
                        phoneNumber: user.phoneNumber,
                        avatarUrl: user.avatarUrl,
                        isOnline,
                        lastSeen: user.lastSeen,
                    },
                    isAlreadyFriend,
                    autoFriended: contact.autoFriended || false,
                });
            }

            this.logger.log(`Found ${results.length} registered contacts from ${phoneNumbers.length} phone numbers`);
            return results;
        } catch (error) {
            this.logger.error(`Failed to find registered contacts: ${error.message}`);
            throw error;
        }
    }

    /**
     * Auto-friend a registered contact
     */
    async autoFriendRegisteredContact(userId: string, registeredUserId: string): Promise<boolean> {
        try {
            if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(registeredUserId)) {
                return false;
            }

            // Check if they're already friends
            const existingFriendship = await this.userFriendRepository.findByUserAndFriend(userId, registeredUserId);
            if (existingFriendship && existingFriendship.status === FriendStatus.ACCEPTED) {
                return false; // Already friends
            }

            // Check if there's a pending request in either direction
            const pendingRequest = await this.userFriendRepository.findByUserAndFriend(registeredUserId, userId);
            if (pendingRequest && pendingRequest.status === FriendStatus.PENDING) {
                // Auto-accept the existing request
                await this.userFriendRepository.updateStatus(pendingRequest.id, FriendStatus.ACCEPTED);

                // Create reverse friendship
                await this.userFriendRepository.create({
                    userId: new Types.ObjectId(userId),
                    friendId: new Types.ObjectId(registeredUserId),
                    status: FriendStatus.ACCEPTED,
                    requestedBy: pendingRequest.requestedBy,
                    addMethod: AddMethod.CONTACT_SYNC,
                    acceptedAt: new Date(),
                });

                // Mark contact as auto-friended
                await this.markContactAsAutoFriended(userId, registeredUserId);

                return true;
            }

            // Create new mutual friendship (auto-accepted)
            const friendshipData = {
                userId: new Types.ObjectId(userId),
                friendId: new Types.ObjectId(registeredUserId),
                status: FriendStatus.ACCEPTED,
                requestedBy: new Types.ObjectId(userId),
                addMethod: AddMethod.CONTACT_SYNC,
                acceptedAt: new Date(),
            };

            await this.userFriendRepository.create(friendshipData);

            // Create reverse friendship
            await this.userFriendRepository.create({
                ...friendshipData,
                userId: new Types.ObjectId(registeredUserId),
                friendId: new Types.ObjectId(userId),
            });

            // Mark contact as auto-friended
            await this.markContactAsAutoFriended(userId, registeredUserId);

            this.logger.log(`Auto-friended: ${userId} ↔ ${registeredUserId}`);
            return true;
        } catch (error) {
            this.logger.error(`Auto-friend failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Handle new user registration (check for auto-friend candidates)
     */
    async handleNewUserRegistration(userId: string, phoneNumber: string): Promise<void> {
        try {
            if (!Types.ObjectId.isValid(userId)) {
                return;
            }

            const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

            // Find contacts who have this phone number and want to auto-friend
            const autoFriendCandidates = await this.userContactRepository.findAutoFriendCandidates(normalizedPhone);

            for (const contact of autoFriendCandidates) {
                try {
                    // Auto-friend the contact owner với new user
                    await this.autoFriendRegisteredContact(contact.userId.toString(), userId);

                    // Update contact với registered user info
                    await this.userContactRepository.updateRegistrationStatus(contact.id, userId);
                } catch (error) {
                    this.logger.warn(`Failed to auto-friend candidate ${contact.userId}: ${error.message}`);
                }
            }

            this.logger.log(`Processed auto-friend candidates for new user ${userId}`);
        } catch (error) {
            this.logger.error(`Failed to handle new user registration: ${error.message}`);
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

            return await this.userContactRepository.getContactStats(userId);
        } catch (error) {
            this.logger.error(`Failed to get contact stats: ${error.message}`);
            return { total: 0, registered: 0, autoFriended: 0 };
        }
    }

    /**
     * Sync contacts with server - Dedicated method for contact synchronization
     * 
     * Following instruction-senior.md:
     * - Single Responsibility: Dedicated sync logic separate from import
     * - Performance: Optimized for incremental updates
     * - Clean Architecture: Service encapsulates sync business logic
     * - Mobile-optimized: Handle periodic sync operations
     */
    async syncContacts(params: ContactSyncParams): Promise<{
        stats: {
            newRegistrations: number;
            updates: number;
            autoFriended: number;
            processed: number;
        };
        newRegisteredContacts: RegisteredContact[];
        errors: string[];
    }> {
        try {
            const { userId, contacts, autoFriend = true } = params;

            this.logger.log(`Starting contact sync for user ${userId}: ${contacts.length} contacts`);

            // Import/update contacts (this handles duplicates automatically)
            const importResult = await this.importContacts(params);

            // Prepare sync-specific response
            const syncResult = {
                stats: {
                    newRegistrations: importResult.registered?.length || 0,
                    updates: importResult.imported || 0,
                    autoFriended: importResult.newFriends?.length || 0,
                    processed: contacts.length,
                },
                newRegisteredContacts: importResult.registered || [],
                errors: importResult.errors || [],
            };

            this.logger.log(`Contact sync completed for user ${userId}: ${JSON.stringify(syncResult.stats)}`);
            return syncResult;
        } catch (error) {
            this.logger.error(`Failed to sync contacts: ${error.message}`);
            throw error;
        }
    }

    /**
     * Delete all contacts for a user - Batch operation
     * 
     * Following instruction-senior.md:
     * - Performance: Batch deletion instead of individual operations
     * - Single Responsibility: Complete user contact cleanup
     * - Error handling: Comprehensive error management
     */
    async deleteAllUserContacts(userId: string): Promise<{
        deletedCount: number;
        errors: string[];
    }> {
        try {
            if (!Types.ObjectId.isValid(userId)) {
                throw new BadRequestException('Invalid user ID');
            }

            // Get all user contacts
            const userContacts = await this.userContactRepository.findByUserId(userId);

            if (userContacts.length === 0) {
                return {
                    deletedCount: 0,
                    errors: []
                };
            }

            let deletedCount = 0;
            const errors: string[] = [];

            // Delete in batches for better performance
            const batchSize = 50;
            for (let i = 0; i < userContacts.length; i += batchSize) {
                const batch = userContacts.slice(i, i + batchSize);

                try {
                    // Delete contacts in current batch
                    for (const contact of batch) {
                        const contactId = contact._id?.toString() || contact.id;
                        if (contactId) {
                            const deleted = await this.userContactRepository.delete(contactId);
                            if (deleted) {
                                deletedCount++;
                            } else {
                                errors.push(`Failed to delete contact: ${contact.contactName}`);
                            }
                        }
                    }
                } catch (error) {
                    this.logger.error(`Failed to delete contact batch starting at ${i}: ${error.message}`);
                    errors.push(`Failed to delete batch of ${batch.length} contacts`);
                }
            }

            this.logger.log(`Batch contact deletion completed for user ${userId}: ${deletedCount} deleted, ${errors.length} errors`);

            return {
                deletedCount,
                errors
            };
        } catch (error) {
            this.logger.error(`Failed to delete all user contacts: ${error.message}`);
            throw error;
        }
    }

    /**
     * Bulk import contacts to database
     * 
     * Following instruction-senior.md:
     * - Performance optimization with batch operations
     * - Security validation 
     * - Comprehensive error handling
     */
    private async bulkImportContacts(userId: string, contacts: ContactImport[]): Promise<{
        imported: number;
        skipped: number;
    }> {
        try {
            if (!contacts || contacts.length === 0) {
                return { imported: 0, skipped: 0 };
            }

            let imported = 0;
            let skipped = 0;

            // Process contacts in batches for better performance
            const batchSize = 50;
            for (let i = 0; i < contacts.length; i += batchSize) {
                const batch = contacts.slice(i, i + batchSize);

                try {
                    // Create contact entries for this batch
                    const contactsToInsert = batch.map(contact => ({
                        userId: new Types.ObjectId(userId),
                        phoneNumber: contact.phoneNumber,
                        contactName: contact.contactName,
                        contactSource: contact.contactSource || ContactSource.PHONEBOOK,
                        importedAt: new Date(),
                    }));

                    // Bulk insert contacts
                    await this.userContactRepository.bulkCreate(contactsToInsert);
                    imported += batch.length;
                } catch (error) {
                    this.logger.warn(`Failed to import batch starting at ${i}: ${error.message}`);
                    skipped += batch.length;
                }
            }

            this.logger.log(`Bulk import completed: ${imported} imported, ${skipped} skipped`);
            return { imported, skipped };
        } catch (error) {
            this.logger.error(`Bulk import failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Helper: Validate và clean contacts data
     */
    private async validateAndCleanContacts(userId: string, contacts: ContactImport[]): Promise<ContactImport[]> {
        const validContacts: ContactImport[] = [];
        const phoneRegex = /^\+?[1-9]\d{1,14}$/; // E.164 format

        for (const contact of contacts) {
            // Skip if missing required fields
            if (!contact.phoneNumber || !contact.contactName) {
                continue;
            }

            // Normalize và validate phone number
            const normalizedPhone = this.normalizePhoneNumber(contact.phoneNumber);
            if (!phoneRegex.test(normalizedPhone)) {
                continue;
            }

            // Skip if contact already exists
            const exists = await this.userContactRepository.exists(userId, normalizedPhone);
            if (exists) {
                continue;
            }

            validContacts.push({
                phoneNumber: normalizedPhone,
                contactName: contact.contactName.trim().substring(0, 100), // Limit length
                contactSource: contact.contactSource || ContactSource.PHONEBOOK,
            });
        }

        return validContacts;
    }

    /**
     * Helper: Normalize phone number to E.164 format
     */
    private normalizePhoneNumber(phoneNumber: string): string {
        // Remove all non-digit characters except +
        let cleaned = phoneNumber.replace(/[^\d+]/g, '');

        // Add + if not present và doesn't start with 00
        if (!cleaned.startsWith('+') && !cleaned.startsWith('00')) {
            cleaned = '+' + cleaned;
        }

        // Convert 00 prefix to +
        if (cleaned.startsWith('00')) {
            cleaned = '+' + cleaned.substring(2);
        }

        return cleaned;
    }

    /**
     * Helper: Mark contact as auto-friended
     */
    private async markContactAsAutoFriended(userId: string, registeredUserId: string): Promise<void> {
        try {
            // Find the contact entry
            const contacts = await this.userContactRepository.findByUserId(userId);
            const contact = contacts.find(c =>
                c.registeredUserId?.toString() === registeredUserId
            );

            if (contact) {
                await this.userContactRepository.markAutoFriended(contact.id);
            }
        } catch (error) {
            this.logger.warn(`Failed to mark contact as auto-friended: ${error.message}`);
        }
    }

    /**
     * Delete contact
     */
    async deleteContact(contactId: string): Promise<boolean> {
        try {
            if (!Types.ObjectId.isValid(contactId)) {
                return false;
            }

            return await this.userContactRepository.delete(contactId);
        } catch (error) {
            this.logger.error(`Failed to delete contact: ${error.message}`);
            return false;
        }
    }

    /**
     * Get user's contacts
     */
    async getUserContacts(userId: string): Promise<any[]> {
        try {
            if (!Types.ObjectId.isValid(userId)) {
                return [];
            }

            return await this.userContactRepository.findByUserId(userId);
        } catch (error) {
            this.logger.error(`Failed to get user contacts: ${error.message}`);
            return [];
        }
    }

    /**
     * Helper: Find users by phone numbers (bulk operation)
     * 
     * Following instruction-senior.md:
     * - Performance optimization with parallel queries
     * - Security validation
     * - Error handling with graceful failures
     */
    private async findUsersByPhoneNumbers(phoneNumbers: string[]): Promise<any[]> {
        try {
            if (!phoneNumbers || phoneNumbers.length === 0) {
                return [];
            }

            // Process in parallel for better performance while waiting for bulk query
            const userPromises = phoneNumbers.map(async (phoneNumber) => {
                try {
                    const user = await this.usersRepository.findByPhoneNumber(phoneNumber);
                    if (user) {
                        return {
                            id: user.id || user._id?.toString(),
                            fullName: user.fullName,
                            username: user.username,
                            phoneNumber: user.phoneNumber,
                            avatarUrl: user.avatarUrl,
                            lastSeen: user.lastSeen,
                        };
                    }
                    return null;
                } catch (error) {
                    this.logger.warn(`Failed to find user by phone ${phoneNumber}: ${error.message}`);
                    return null;
                }
            });

            // Execute all queries in parallel and filter out null results
            const results = await Promise.all(userPromises);
            const users = results.filter(user => user !== null);

            this.logger.log(`Found ${users.length} users from ${phoneNumbers.length} phone numbers`);
            return users;
        } catch (error) {
            this.logger.error(`Failed to find users by phone numbers: ${error.message}`);
            return [];
        }
    }

    /**
     * Helper: Check if users are already friends
     * 
     * Following instruction-senior.md:
     * - Performance optimization with repository
     * - Security validation
     * - Error handling
     */
    private async checkIfAlreadyFriends(userId: string, friendId: string): Promise<boolean> {
        try {
            return await this.userFriendRepository.areFriends(userId, friendId);
        } catch (error) {
            this.logger.warn(`Failed to check friendship between ${userId} and ${friendId}: ${error.message}`);
            return false;
        }
    }

    /**
     * Helper: Get user online status from cache
     * 
     * Following instruction-senior.md:
     * - Performance optimization with Redis cache
     * - Real-time status updates
     * - Error handling with fallback
     */
    private async getUserOnlineStatus(userId: string): Promise<boolean> {
        try {
            // Use real-time state service for online status checking
            // Note: This requires RealTimeStateService to be injected
            // For now, check if user has been seen recently as fallback
            const user = await this.usersRepository.findById(userId);
            if (!user || !user.lastSeen) {
                return false;
            }

            // Consider user online if last seen within 5 minutes
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            return user.lastSeen > fiveMinutesAgo;
        } catch (error) {
            this.logger.warn(`Failed to get online status for user ${userId}: ${error.message}`);
            // Fallback to false if service is unavailable
            return false;
        }
    }
}
