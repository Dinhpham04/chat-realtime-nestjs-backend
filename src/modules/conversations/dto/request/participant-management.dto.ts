/**
 * Participant Management DTOs
 * 
 * 🎯 Purpose: Request validation for participant operations
 * 🔒 Security: Input validation and business rule enforcement
 * 📱 Mobile-First: Optimized for mobile group management UX
 */

import {
    IsArray,
    IsString,
    IsEnum,
    IsOptional,
    ArrayMinSize,
    ArrayMaxSize,
    IsUUID
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ParticipantRole } from '../../types/conversation.types';

/**
 * Add participants to group conversation
 */
export class AddParticipantsDto {
    @ApiProperty({
        description: 'Array of user IDs to add to the conversation',
        example: ['user-123', 'user-456'],
        type: [String],
        minItems: 1,
        maxItems: 50
    })
    @IsArray()
    @ArrayMinSize(1, { message: 'At least one user ID is required' })
    @ArrayMaxSize(50, { message: 'Cannot add more than 50 users at once' })
    @IsString({ each: true })
    @Transform(({ value }) => Array.isArray(value) ? [...new Set(value)] : value) // Remove duplicates
    userIds: string[];

    @ApiPropertyOptional({
        description: 'Role to assign to new participants',
        enum: ParticipantRole,
        default: ParticipantRole.MEMBER,
        example: ParticipantRole.MEMBER
    })
    @IsOptional()
    @IsEnum(ParticipantRole, { message: 'Invalid participant role' })
    role?: ParticipantRole = ParticipantRole.MEMBER;
}

/**
 * Update participant role in conversation
 */
export class UpdateParticipantRoleDto {
    @ApiProperty({
        description: 'New role for the participant',
        enum: ParticipantRole,
        example: ParticipantRole.ADMIN
    })
    @IsEnum(ParticipantRole, { message: 'Invalid participant role' })
    role: ParticipantRole;
}

/**
 * Remove participant request (no body needed, userId in params)
 */
export class RemoveParticipantParams {
    @ApiProperty({
        description: 'ID of the conversation',
        example: '507f1f77bcf86cd799439011'
    })
    @IsString()
    conversationId: string;

    @ApiProperty({
        description: 'ID of the user to remove',
        example: 'user-123'
    })
    @IsString()
    userId: string;
}

/**
 * Leave conversation request (no body needed)
 */
export class LeaveConversationParams {
    @ApiProperty({
        description: 'ID of the conversation to leave',
        example: '507f1f77bcf86cd799439011'
    })
    @IsString()
    conversationId: string;
}
