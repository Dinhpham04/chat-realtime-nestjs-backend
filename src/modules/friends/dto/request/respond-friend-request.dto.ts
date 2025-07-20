import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * RespondToFriendRequestDto - Response to friend request validation
 * 
 * 🎯 Purpose: Validate friend request response action
 * 📱 Mobile-First: Simple accept/decline actions
 * 🚀 Single Responsibility: Only response action validation
 */
export class RespondToFriendRequestDto {
    @ApiProperty({
        description: 'Action to take on friend request',
        enum: ['ACCEPT', 'DECLINE'],
        example: 'ACCEPT'
    })
    @IsEnum(['ACCEPT', 'DECLINE'])
    @IsNotEmpty()
    action: 'ACCEPT' | 'DECLINE';
}
