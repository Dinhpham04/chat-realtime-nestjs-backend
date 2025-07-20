import { ApiProperty } from '@nestjs/swagger';

/**
 * FriendRequestResponseDto - Friend request response structure
 * 
 * 🎯 Purpose: Standardize friend request response format
 * 📱 Mobile-First: Include essential friend info
 * 🚀 Single Responsibility: Only friend request response structure
 */
export class FriendRequestResponseDto {
    @ApiProperty({
        description: 'Friend request ID',
        example: '67890abcdef1234567890123'
    })
    id: string;

    @ApiProperty({
        description: 'Friend info'
    })
    friend: {
        id: string;
        fullName: string;
        username: string;
        phoneNumber: string;
        avatarUrl?: string;
    };

    @ApiProperty({
        description: 'Request status',
        example: 'pending'
    })
    status: string;

    @ApiProperty({
        description: 'Optional message',
        example: 'Hi! Let\'s be friends'
    })
    message?: string;

    @ApiProperty({
        description: 'Created timestamp',
        example: '2024-01-15T10:30:00Z'
    })
    createdAt: Date;
}
