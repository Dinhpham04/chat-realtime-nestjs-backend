import { ApiProperty } from '@nestjs/swagger';

/**
 * ContactSyncResultDto - Contact sync result response structure
 * 
 * 🎯 Purpose: Standardize contact sync response format
 * 📱 Mobile-First: Include sync statistics and registered contacts
 * 🚀 Single Responsibility: Only contact sync response structure
 */
export class ContactSyncResultDto {
    @ApiProperty({
        description: 'Number of contacts imported',
        example: 150
    })
    imported: number;

    @ApiProperty({
        description: 'Registered contacts found'
    })
    registered: Array<{
        phoneNumber: string;
        contactName: string;
        user: {
            id: string;
            fullName: string;
            username: string;
            phoneNumber: string;
            avatarUrl?: string;
            isOnline: boolean;
            lastSeen?: Date;
        };
        isAlreadyFriend: boolean;
        autoFriended: boolean;
    }>;

    @ApiProperty({
        description: 'New friends made through auto-friend'
    })
    newFriends: Array<{
        id: string;
        fullName: string;
        username: string;
        phoneNumber: string;
        avatarUrl?: string;
    }>;

    @ApiProperty({
        description: 'Number of duplicate contacts',
        example: 5
    })
    duplicates: number;

    @ApiProperty({
        description: 'Import errors',
        type: [String],
        example: ['Failed to process contact: Invalid phone number']
    })
    errors: string[];
}
