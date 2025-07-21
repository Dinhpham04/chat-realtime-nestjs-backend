import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Query,
    UseGuards,
    HttpStatus,
    HttpCode,
    Logger,
    Request,
} from '@nestjs/common';
import {
    ApiTags,
    ApiBearerAuth,
    ApiConsumes,
    ApiProduces,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ContactSyncService } from '../services/contact-sync.service';
import {
    BulkContactImportApiDocs,
    FindRegisteredContactsApiDocs,
    GetRegisteredContactsApiDocs,
    ContactSyncApiDocs,
    GetContactStatsApiDocs,
    DeleteAllContactsApiDocs,
} from '../documentation/contact.api-docs';
import {
    ImportContactsDto,
    ContactSyncDto,
    GetRegisteredContactsDto,
    FindRegisteredContactsDto,
} from '../dto';

/**
 * Contact Controller
 * 
 * Following instruction-senior.md:
 * - Clean Architecture: Separation of concerns
 * - Single Responsibility: Each method handles one operation
 * - Documentation: Separated into swagger files
 * - Validation: DTOs handle input validation
 * - Security: JWT authentication required
 */
@Controller('contacts')
@ApiTags('Contacts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiConsumes('application/json')
@ApiProduces('application/json')
export class ContactController {
    private readonly logger = new Logger(ContactController.name);

    constructor(private readonly contactSyncService: ContactSyncService) { }

    /**
     * Import contacts in bulk from mobile device
     * Enhanced with Mobile-First features
     */
    @Post('bulk-import')
    @HttpCode(HttpStatus.CREATED)
    @BulkContactImportApiDocs()
    async bulkImportContacts(
        @Request() req: any,
        @Body() importContactsDto: ImportContactsDto,
    ) {
        const userId = req.user.userId;
        const startTime = Date.now();
        this.logger.log(`User ${userId} importing ${importContactsDto.contacts?.length || 0} contacts from ${importContactsDto.platform || 'unknown'} device`);

        // Mobile-First: Extract device context
        const deviceContext = {
            platform: importContactsDto.platform,
            batteryLevel: importContactsDto.batteryLevel,
            networkType: importContactsDto.networkType,
            lowDataMode: importContactsDto.lowDataMode,
        };

        const result = await this.contactSyncService.importContacts({
            userId,
            contacts: importContactsDto.contacts,
            autoFriend: importContactsDto.autoFriend ?? true,
            deviceContext,
        });

        const processingTimeMs = Date.now() - startTime;

        // Transform to match Swagger documentation structure
        const response = {
            imported: result.imported,
            updated: 0, // Service doesn't distinguish between new/updated // TODO: Implement if needed
            failed: result.errors.length,
            totalProcessed: importContactsDto.contacts.length,
            registeredContacts: result.registered.map(contact => ({
                id: contact.user.id,
                phoneNumber: contact.phoneNumber,
                fullName: contact.user.fullName,
                avatarUrl: contact.user.avatarUrl,
                isOnline: contact.user.isOnline,
            })),
            failedContacts: result.errors,
            processingTimeMs,
            duplicates: result.duplicates,
            errors: result.errors,
            // Mobile-First: Include device optimization info
            optimization: {
                lowDataMode: deviceContext.lowDataMode,
                networkOptimized: deviceContext.networkType === 'wifi' ? 'high' : 'medium',
                batteryImpact: deviceContext.batteryLevel && deviceContext.batteryLevel < 20 ? 'optimized' : 'normal',
            }
        };

        this.logger.log(`Bulk import completed for user ${userId}: ${result.imported} imported, ${result.duplicates} duplicates, processing: ${processingTimeMs}ms`);
        return response;
    }

    /**
     * Find which contacts are registered on platform
     * 
     * Following instruction-senior.md:
     * - Single Responsibility: Check registration status only
     * - Performance: Bulk phone number lookup
     * - Privacy: No contact storage, just lookup
     */
    @Post('find-registered')
    @HttpCode(HttpStatus.OK)
    @FindRegisteredContactsApiDocs()
    async findRegisteredContacts(
        @Request() req: any,
        @Body() findContactsDto: FindRegisteredContactsDto,
    ) {
        const userId = req.user.userId;
        this.logger.log(`User ${userId} checking registration for ${findContactsDto.phoneNumbers?.length || 0} contacts`);

        try {
            const registeredContacts = await this.contactSyncService.findRegisteredContacts(findContactsDto.phoneNumbers, userId);
            console.log('found registered contacts:', registeredContacts);
            const registered = registeredContacts.map(contact => ({
                phoneNumber: contact.phoneNumber,
                contactName: contact.contactName,
                user: {
                    id: contact.user.id,
                    fullName: contact.user.fullName,
                    avatarUrl: contact.user.avatarUrl,
                    isOnline: contact.user.isOnline,
                    mutualFriendsCount: 0, // TODO: Implement mutual friends count
                    friendshipStatus: contact.isAlreadyFriend ? 'FRIEND' : 'NONE',
                    joinedAt: new Date().toISOString(), // TODO: Get actual join date
                }
            }));

            const registeredPhoneNumbers = registered.map(c => c.phoneNumber);
            const notRegistered = findContactsDto.phoneNumbers.filter(
                phone => !registeredPhoneNumbers.includes(phone)
            );

            const result = {
                registered,
                notRegistered,
                stats: {
                    totalChecked: findContactsDto.phoneNumbers.length,
                    totalRegistered: registered.length,
                    registrationRate: registered.length / findContactsDto.phoneNumbers.length * 100,
                }
            };

            this.logger.log(`Found ${registered.length} registered contacts for user ${userId}`);
            return result;
        } catch (error) {
            this.logger.error(`Failed to find registered contacts for user ${userId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get contacts that are registered on the platform
     * 
     * Following instruction-senior.md:
     * - Clean separation: Service handles business logic
     * - Performance: Direct service call without manual transformations
     * - Error handling: Comprehensive try-catch
     * - Mobile-optimized: Pagination and filtering
     */
    @Get('registered')
    @HttpCode(HttpStatus.OK)
    @GetRegisteredContactsApiDocs()
    async getRegisteredContacts(
        @Request() req: any,
        @Query() queryDto: GetRegisteredContactsDto,
    ) {
        const userId = req.user.userId;
        this.logger.log(`User ${userId} retrieving registered contacts`);

        try {
            // Get user's contacts first
            const userContacts = await this.contactSyncService.getUserContacts(userId);
            if (userContacts.length === 0) {
                return {
                    contacts: [],
                    total: 0,
                    limit: queryDto.limit || 50,
                    offset: queryDto.offset || 0,
                    message: 'No contacts found. Please import contacts first.'
                };
            }

            // Extract phone numbers and find registered ones
            const phoneNumbers = userContacts.map(contact => contact.phoneNumber);
            const registeredContacts = await this.contactSyncService.findRegisteredContacts(phoneNumbers, userId);
            // Apply filtering - exclude already friends if requested
            const filtered = queryDto.includeAlreadyFriends
                ? registeredContacts
                : registeredContacts.filter(contact => contact.isAlreadyFriend === false);

            // Apply pagination
            const total = filtered.length;
            const offset = queryDto.offset || 0;
            const limit = queryDto.limit || 50;
            const paginated = filtered.slice(offset, offset + limit);

            const result = {
                contacts: paginated,
                total,
                limit,
                offset,
                hasMore: offset + limit < total,
                stats: {
                    totalContacts: userContacts.length,
                    registeredCount: registeredContacts.length,
                    availableToFriend: registeredContacts.filter(c => !c.isAlreadyFriend).length
                }
            };

            this.logger.log(`Retrieved ${paginated.length} registered contacts for user ${userId} (${total} total)`);
            return result;
        } catch (error) {
            this.logger.error(`Failed to get registered contacts for user ${userId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Sync contacts with server for updates
     * 
     * Following instruction-senior.md:
     * - Single Responsibility: Use dedicated sync service method
     * - Performance: Optimized sync operations
     * - Clean Architecture: Service handles business logic
     * - Error handling: Comprehensive try-catch
     */
    @Post('sync')
    @HttpCode(HttpStatus.OK)
    @ContactSyncApiDocs()
    async syncContacts(
        @Request() req: any,
        @Body() contactSyncDto: ContactSyncDto,
    ) {
        const userId = req.user.userId;
        this.logger.log(`User ${userId} syncing ${contactSyncDto.contacts?.length || 0} contacts`);

        try {
            // Use dedicated sync method
            const result = await this.contactSyncService.syncContacts({
                userId,
                contacts: contactSyncDto.contacts,
                autoFriend: contactSyncDto.autoFriend ?? true,
            });

            this.logger.log(`Contact sync completed for user ${userId}: ${result.stats.newRegistrations} new, ${result.stats.updates} updated`);
            return result;
        } catch (error) {
            this.logger.error(`Failed to sync contacts for user ${userId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get contact statistics and insights
     */
    @Get('stats')
    @HttpCode(HttpStatus.OK)
    @GetContactStatsApiDocs()
    async getContactStats(
        @Request() req: any,
    ) {
        const userId = req.user.userId;
        this.logger.log(`User ${userId} retrieving contact statistics`);

        try {
            // Use enhanced stats method that matches Swagger documentation
            const result = await this.contactSyncService.getEnhancedContactStats(userId);
            return result;
        } catch (error) {
            this.logger.error(`Failed to get contact stats for user ${userId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Delete all imported contacts
     * 
     * Following instruction-senior.md:
     * - Performance: Use batch operations instead of loops
     * - Single Responsibility: Service handles deletion logic
     * - Error handling: Comprehensive error management
     * - Clean Architecture: Controller delegates to service
     */
    @Delete()
    @HttpCode(HttpStatus.OK)
    @DeleteAllContactsApiDocs()
    async deleteAllContacts(
        @Request() req: any,
    ) {
        const userId = req.user.userId;
        this.logger.log(`User ${userId} deleting all contacts`);

        try {
            // Use dedicated batch deletion method
            const result = await this.contactSyncService.deleteAllUserContacts(userId);

            const response = {
                message: `Successfully deleted ${result.deletedCount} contacts`,
                deletedCount: result.deletedCount,
                errors: result.errors,
                success: result.errors.length === 0
            };

            this.logger.log(`Contact deletion completed for user ${userId}: ${result.deletedCount} deleted, ${result.errors.length} errors`);
            return response;
        } catch (error) {
            this.logger.error(`Failed to delete all contacts for user ${userId}: ${error.message}`);
            throw error;
        }
    }
}
