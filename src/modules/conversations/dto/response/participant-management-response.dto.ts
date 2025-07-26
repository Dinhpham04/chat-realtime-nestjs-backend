/**
 * Participant Management Response DTOs
 * 
 * 🎯 Purpose: Structured responses for participant operations
 * 📱 Mobile-First: Optimized response format for mobile apps
 * 🚀 Performance: Minimal data transfer with essential info
 */

import { ApiProperty } from '@nestjs/swagger';
import { ParticipantRole } from '../../types/conversation.types';

/**
 * Individual participant information
 */
export class ParticipantDto {
    @ApiProperty({
        description: 'User unique identifier',
        example: 'user-123'
    })
    userId: string;

    @ApiProperty({
        description: 'Participant role in conversation',
        enum: ParticipantRole,
        example: ParticipantRole.MEMBER
    })
    role: ParticipantRole;

    @ApiProperty({
        description: 'When user joined the conversation',
        example: '2024-01-15T10:30:00.000Z'
    })
    joinedAt: string;

    @ApiProperty({
        description: 'User who added this participant',
        example: 'user-456'
    })
    addedBy: string;

    @ApiProperty({
        description: 'User basic information'
    })
    user: {
        id: string;
        username: string;
        fullName: string;
        avatarUrl?: string;
        isOnline: boolean;
    };
}

/**
 * Add participants operation result
 */
export class AddParticipantsResponseDto {
    @ApiProperty({
        description: 'Successfully added participants',
        type: [ParticipantDto]
    })
    added: ParticipantDto[];

    @ApiProperty({
        description: 'Failed to add participants with reasons',
        type: 'array',
        example: [
            { userId: 'user-789', reason: 'User not found' },
            { userId: 'user-101', reason: 'Already in conversation' }
        ]
    })
    failed: {
        userId: string;
        reason: string;
    }[];

    @ApiProperty({
        description: 'Total number of participants after operation',
        example: 15
    })
    totalParticipants: number;
}

/**
 * Update participant role result
 */
export class UpdateParticipantRoleResponseDto {
    @ApiProperty({
        description: 'Updated participant information',
        type: ParticipantDto
    })
    participant: ParticipantDto;

    @ApiProperty({
        description: 'Previous role before update',
        enum: ParticipantRole,
        example: ParticipantRole.MEMBER
    })
    previousRole: ParticipantRole;

    @ApiProperty({
        description: 'When the role was updated',
        example: '2024-01-15T10:30:00.000Z'
    })
    updatedAt: string;
}

/**
 * Remove participant success response
 */
export class RemoveParticipantResponseDto {
    @ApiProperty({
        description: 'Operation success status',
        example: true
    })
    success: true;

    @ApiProperty({
        description: 'ID of removed user',
        example: 'user-123'
    })
    removedUserId: string;

    @ApiProperty({
        description: 'When user was removed',
        example: '2024-01-15T10:30:00.000Z'
    })
    removedAt: string;

    @ApiProperty({
        description: 'Total participants remaining',
        example: 14
    })
    remainingParticipants: number;
}

/**
 * Leave conversation success response
 */
export class LeaveConversationResponseDto {
    @ApiProperty({
        description: 'Operation success status',
        example: true
    })
    success: true;

    @ApiProperty({
        description: 'When user left the conversation',
        example: '2024-01-15T10:30:00.000Z'
    })
    leftAt: string;

    @ApiProperty({
        description: 'Total participants remaining',
        example: 13
    })
    remainingParticipants: number;
}
