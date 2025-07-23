import { applyDecorators } from '@nestjs/common';
import {
    ApiOperation,
    ApiResponse,
    ApiBody,
    ApiBearerAuth,
    ApiQuery,
    ApiConsumes,
} from '@nestjs/swagger';
import { HttpStatus } from '@nestjs/common';

/**
 * Contact API Documentation
 * 
 * Following instruction-senior.md:
 * - Domain Separation: Contact documentation in friends module (correct location)
 * - Single Responsibility: Each function documents one endpoint
 * - Clean Architecture: Documentation separated from controller logic
 * - DRY Principle: Reusable error responses
 */

// Common error responses
const commonErrorResponses = {
    badRequest: {
        status: HttpStatus.BAD_REQUEST,
        description: 'Validation errors in request data',
        example: {
            statusCode: 400,
            message: ['Validation error messages'],
            error: 'Bad Request',
            timestamp: '2024-01-15T10:30:00.000Z',
            path: '/api/v1/contacts/*'
        }
    },
    unauthorized: {
        status: HttpStatus.UNAUTHORIZED,
        description: 'Unauthorized - invalid or missing JWT token',
        example: {
            statusCode: 401,
            message: 'Unauthorized',
            error: 'Unauthorized',
            timestamp: '2024-01-15T10:30:00.000Z',
            path: '/api/v1/contacts/*'
        }
    },
    payloadTooLarge: {
        status: HttpStatus.PAYLOAD_TOO_LARGE,
        description: 'Request payload too large - contact list exceeds limit',
        example: {
            statusCode: 413,
            message: 'Payload too large. Maximum 1000 contacts per request.',
            error: 'Payload Too Large',
            timestamp: '2024-01-15T10:30:00.000Z',
            path: '/api/v1/contacts/*'
        }
    },
    tooManyRequests: {
        status: HttpStatus.TOO_MANY_REQUESTS,
        description: 'Rate limit exceeded',
        example: {
            statusCode: 429,
            message: 'Too many requests. Please try again later.',
            error: 'Too Many Requests',
            timestamp: '2024-01-15T10:30:00.000Z',
            path: '/api/v1/contacts/*'
        }
    }
};

/**
 * Bulk Contact Import endpoint documentation
 */
export function BulkContactImportApiDocs() {
    return applyDecorators(
        ApiBearerAuth('JWT'),
        ApiConsumes('application/json'),
        ApiOperation({
            summary: 'Import contacts in bulk from mobile device',
            description: `
## Bulk Contact Import

Import up to 1000 contacts from user's mobile device in a single request.
            `,
        }),
        ApiBody({
            description: 'Bulk contact import data with mobile device context',
            examples: {
                'Mobile Contacts': {
                    summary: 'Import from mobile phone book with device context',
                    value: {
                        contacts: [
                            {
                                phoneNumber: '+84901234567',
                                contactName: 'Nguyen Van A',
                                contactSource: 'phonebook',
                                // networkType: 'wifi'
                            },
                            {
                                phoneNumber: '+84987654321',
                                contactName: 'Tran Thi B',
                                contactSource: 'phonebook',
                                // networkType: '4g'
                            }
                        ],
                        autoFriend: true,
                        // deviceContactsHash: 'sha256_hash_of_all_contacts',
                        // totalContactsOnDevice: 150,
                        // platform: 'ios',
                        // batteryLevel: 85,
                        // networkType: 'wifi',
                        // lowDataMode: false
                    }
                },
                'Low Data Mode': {
                    summary: 'Import with low data mode optimization',
                    value: {
                        contacts: [
                            {
                                phoneNumber: '+84901234567',
                                contactName: 'Nguyen Van A',
                                contactSource: 'PHONEBOOK'
                            }
                        ],
                        autoFriend: true,
                        platform: 'android',
                        batteryLevel: 15,
                        networkType: '3g',
                        lowDataMode: true
                    }
                }
            }
        }),
        ApiResponse({
            status: HttpStatus.CREATED,
            description: 'Contacts imported successfully with mobile optimization',
            example: {
                imported: 148,
                updated: 2,
                failed: 0,
                totalProcessed: 150,
                registeredContacts: [
                    {
                        id: '507f1f77bcf86cd799439011',
                        phoneNumber: '+84901234567',
                        fullName: 'Nguyen Van A',
                        avatarUrl: 'https://example.com/avatar1.jpg',
                        isOnline: true
                    }
                ],
                failedContacts: [],
                processingTimeMs: 2341,
                duplicates: 5,
                errors: [],
                optimization: {
                    lowDataMode: false,
                    networkOptimized: 'high',
                    batteryImpact: 'normal'
                }
            }
        }),
        ApiResponse(commonErrorResponses.badRequest),
        ApiResponse(commonErrorResponses.unauthorized),
        ApiResponse(commonErrorResponses.payloadTooLarge),
        ApiResponse(commonErrorResponses.tooManyRequests),
    );
}

/**
 * Find Registered Contacts endpoint documentation
 */
export function FindRegisteredContactsApiDocs() {
    return applyDecorators(
        ApiBearerAuth('JWT'),
        ApiOperation({
            summary: 'Find which contacts are registered on platform',
            description: `
## Find Registered Contacts
Check which contacts from user's phone book are registered on the platform.
### Use Cases:
- Friend suggestion system
- Quick user discovery
- Platform growth analytics
            `,
        }),
        ApiBody({
            description: 'Phone numbers to check',
            examples: {
                'Contact Check': {
                    summary: 'Check if contacts are registered',
                    value: {
                        phoneNumbers: ['+84901234567', '+84987654321', '+84912345678']
                    }
                }
            }
        }),
        ApiResponse({
            status: HttpStatus.OK,
            description: 'Registered contacts found successfully',
            example: {
                registered: [
                    {
                        phoneNumber: '+84901234567',
                        contactName: 'Nguyen Van A',
                        user: {
                            id: '507f1f77bcf86cd799439011',
                            fullName: 'Nguyen Van A',
                            avatarUrl: 'https://example.com/avatar1.jpg',
                            isOnline: true,
                            mutualFriendsCount: 5,
                            friendshipStatus: 'NONE',
                            joinedAt: '2024-01-01T00:00:00.000Z'
                        }
                    }
                ],
                notRegistered: ['+84987654321'],
                stats: {
                    totalChecked: 3,
                    totalRegistered: 1,
                    registrationRate: 33.33
                }
            }
        }),
        ApiResponse(commonErrorResponses.badRequest),
        ApiResponse(commonErrorResponses.unauthorized),
        ApiResponse(commonErrorResponses.tooManyRequests),
    );
}

/**
 * Get Registered Contacts endpoint documentation (Paginated version)
 */
export function GetRegisteredContactsApiDocs() {
    return applyDecorators(
        ApiBearerAuth('JWT'),
        ApiOperation({
            summary: 'Get paginated list of registered contacts',
            description: `
## Get Registered Contacts (Paginated)

Get a paginated list of user's contacts that are registered on the platform.

### Query Parameters:
- limit: Maximum contacts per page (1-100)
- offset: Skip number of contacts  
- includeAlreadyFriends: Include existing friends
            `,
        }),
        ApiQuery({
            name: 'limit',
            required: false,
            type: Number,
            description: 'Maximum number of contacts to return (1-100)',
            example: 50
        }),
        ApiQuery({
            name: 'offset',
            required: false,
            type: Number,
            description: 'Number of contacts to skip',
            example: 0
        }),
        ApiQuery({
            name: 'includeAlreadyFriends',
            required: false,
            type: Boolean,
            description: 'Include contacts who are already friends',
            example: false
        }),
        ApiResponse({
            status: HttpStatus.OK,
            description: 'Registered contacts retrieved successfully',
            example: {
                contacts: [
                    {
                        phoneNumber: '+84901234567',
                        contactName: 'Nguyen Van A',
                        user: {
                            id: '507f1f77bcf86cd799439011',
                            fullName: 'Nguyen Van A',
                            avatarUrl: 'https://example.com/avatar1.jpg',
                            isOnline: true
                        },
                        isAlreadyFriend: false
                    }
                ],
                total: 23,
                limit: 50,
                offset: 0,
                hasMore: false,
                stats: {
                    totalContacts: 150,
                    registeredCount: 23,
                    availableToFriend: 18
                }
            }
        }),
        ApiResponse(commonErrorResponses.badRequest),
        ApiResponse(commonErrorResponses.unauthorized),
        ApiResponse(commonErrorResponses.tooManyRequests),
    );
}

/**
 * Get Registered Contacts endpoint documentation (DEPRECATED - use find-registered instead)
 */
export function ImportContactsApiDocs() {
    return applyDecorators(
        ApiBearerAuth('JWT'),
        ApiOperation({
            summary: 'Import user contacts from mobile device',
            description: `
## Import Contacts

Import contacts from user's mobile device for friend suggestions.
            `,
        }),
        ApiBody({
            description: 'Contact import data',
            examples: {
                'Contact Import': {
                    summary: 'Import contacts from device',
                    value: {
                        contacts: [
                            {
                                phoneNumber: '+84901234567',
                                displayName: 'John Doe',
                                firstName: 'John',
                                lastName: 'Doe'
                            }
                        ]
                    }
                }
            }
        }),
        ApiResponse({
            status: HttpStatus.CREATED,
            description: 'Contacts imported successfully',
            example: {
                imported: 50,
                duplicates: 5,
                invalid: 2,
                totalProcessed: 57
            }
        }),
        ApiResponse(commonErrorResponses.badRequest),
        ApiResponse(commonErrorResponses.unauthorized),
        ApiResponse(commonErrorResponses.tooManyRequests),
    );
}

/**
 * Delete Contact endpoint documentation
 */
export function DeleteContactApiDocs() {
    return applyDecorators(
        ApiBearerAuth('JWT'),
        ApiOperation({
            summary: 'Delete a specific contact',
            description: `
## Delete Contact
Remove a specific contact from user's imported contacts.
            `,
        }),
        ApiResponse({
            status: HttpStatus.OK,
            description: 'Contact deleted successfully',
        }),
        ApiResponse(commonErrorResponses.unauthorized),
        ApiResponse(commonErrorResponses.tooManyRequests),
    );
}

/**
 * Contact Sync endpoint documentation
 */
export function ContactSyncApiDocs() {
    return applyDecorators(
        ApiBearerAuth('JWT'),
        ApiOperation({
            summary: 'Sync contacts with server',
            description: `
## Contact Sync

Synchronize contacts with server for updates and newly registered users.
            `,
        }),
        ApiConsumes('application/json'),
        ApiBody({
            description: 'Contact sync data',
            schema: {
                type: 'object',
                properties: {
                    contacts: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                phoneNumber: { type: 'string', example: '+84901234567' },
                                contactName: { type: 'string', example: 'John Doe' },
                                contactSource: { type: 'string', example: 'PHONEBOOK' }
                            }
                        }
                    },
                    autoFriend: { type: 'boolean', example: true },
                    forceResync: { type: 'boolean', example: false }
                },
                example: {
                    contacts: [
                        {
                            phoneNumber: '+84901234567',
                            contactName: 'John Doe',
                            contactSource: 'PHONEBOOK'
                        }
                    ],
                    autoFriend: true,
                    forceResync: false
                }
            }
        }),
        ApiResponse({
            status: HttpStatus.OK,
            description: 'Contact sync completed successfully',
            example: {
                stats: {
                    newRegistrations: 3,
                    updates: 5,
                    autoFriended: 2,
                    processed: 10
                },
                newRegisteredContacts: [
                    {
                        contactName: 'John Doe',
                        phoneNumber: '+84901234567',
                        user: {
                            id: '507f1f77bcf86cd799439011',
                            displayName: 'John D.',
                            avatar: null
                        },
                        isAlreadyFriend: false
                    }
                ]
            }
        }),
        ApiResponse(commonErrorResponses.badRequest),
        ApiResponse(commonErrorResponses.unauthorized),
        ApiResponse(commonErrorResponses.tooManyRequests),
    );
}

/**
 * Get Contact Stats endpoint documentation
 */
export function GetContactStatsApiDocs() {
    return applyDecorators(
        ApiBearerAuth('JWT'),
        ApiOperation({
            summary: 'Get contact statistics and insights',
            description: `
## Contact Statistics

Retrieve comprehensive statistics about user's imported contacts.
            `,
        }),
        ApiResponse({
            status: HttpStatus.OK,
            description: 'Contact statistics retrieved successfully',
            example: {
                totalContacts: 156,
                registeredContacts: 23,
                unregisteredContacts: 133,
                autoFriendedCount: 18,
                contactSources: {
                    PHONEBOOK: 150,
                    MANUAL: 6
                },
                lastSyncAt: '2024-01-15T10:30:00.000Z'
            }
        }),
        ApiResponse(commonErrorResponses.unauthorized),
        ApiResponse(commonErrorResponses.tooManyRequests),
    );
}

/**
 * Delete All Contacts endpoint documentation
 * 
 * Updated to match enhanced controller response following instruction-senior.md:
 * - Comprehensive error reporting
 * - Detailed operation statistics  
 * - Success/failure indicators
 */
export function DeleteAllContactsApiDocs() {
    return applyDecorators(
        ApiBearerAuth('JWT'),
        ApiOperation({
            summary: 'Delete all imported contacts',
            description: `
## Delete All Contacts

Remove all imported contacts for privacy or cleanup purposes.
            `,
        }),
        ApiResponse({
            status: HttpStatus.OK,
            description: 'Contact deletion completed (may include partial failures)',
            example: {
                message: 'Successfully deleted 152 contacts',
                deletedCount: 152,
                errors: [
                    'Contact 507f1f77bcf86cd799439012: Document not found',
                    'Contact 507f1f77bcf86cd799439013: Deletion failed due to constraint'
                ],
                success: false
            }
        }),
        ApiResponse({
            status: HttpStatus.OK,
            description: 'All contacts deleted successfully',
            example: {
                message: 'Successfully deleted 156 contacts',
                deletedCount: 156,
                errors: [],
                success: true
            }
        }),
        ApiResponse(commonErrorResponses.unauthorized),
        ApiResponse(commonErrorResponses.tooManyRequests),
    );
}
