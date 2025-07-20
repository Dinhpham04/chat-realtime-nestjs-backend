import { ApiProperty } from '@nestjs/swagger';

/**
 * FriendListResponseDto - Friends list response structure
 * 
 * 🎯 Purpose: Standardize friends list response format
 * 📱 Mobile-First: Include pagination and essential friend data
 * 🚀 Single Responsibility: Only friends list response structure
 */
export class FriendListResponseDto {
    @ApiProperty({
        description: 'List of friends'
    })
    friends: Array<{
        id: string;
        fullName: string;
        username: string;
        phoneNumber: string;
        avatarUrl?: string;
        isOnline: boolean;
        lastSeen?: Date;
        mutualFriends: number;
        addedAt: Date;
    }>;

    @ApiProperty({
        description: 'Pagination metadata'
    })
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
