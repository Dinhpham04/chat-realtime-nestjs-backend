/**
 * Create Group Conversation DTO
 * 
 * 🎯 Purpose: Validation for group conversation creation
 * 📱 Mobile-First: Optimized for mobile group chat creation
 * 🔒 Security: Input validation and sanitization
 */

import {
    IsString,
    IsArray,
    IsOptional,
    IsUrl,
    IsBoolean,
    IsNumber,
    MinLength,
    MaxLength,
    ArrayMinSize,
    ArrayMaxSize,
    ValidateNested,
    IsUUID
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GroupSettingsDto {
    @ApiPropertyOptional({
        description: 'Allow members to add other members',
        default: true,
        example: true
    })
    @IsOptional()
    @IsBoolean()
    allowMembersToAdd?: boolean = true;

    @ApiPropertyOptional({
        description: 'Allow all members to send messages',
        default: true,
        example: true
    })
    @IsOptional()
    @IsBoolean()
    allowAllToSend?: boolean = true;

    @ApiPropertyOptional({
        description: 'Mute notifications for group',
        default: false,
        example: false
    })
    @IsOptional()
    @IsBoolean()
    muteNotifications?: boolean = false;

    @ApiPropertyOptional({
        description: 'Auto-delete messages after hours (0 = disabled)',
        default: 0,
        example: 24,
        minimum: 0,
        maximum: 8760
    })
    @IsOptional()
    @IsNumber()
    disappearingMessages?: number = 0;
}

export class CreateGroupConversationDto {
    @ApiProperty({
        description: 'Group name',
        example: 'Project Team Alpha',
        minLength: 1,
        maxLength: 100
    })
    @IsString()
    @MinLength(1, { message: 'Group name cannot be empty' })
    @MaxLength(100, { message: 'Group name cannot exceed 100 characters' })
    name: string;

    @ApiPropertyOptional({
        description: 'Group description',
        example: 'Discussion for Project Alpha development',
        maxLength: 500
    })
    @IsOptional()
    @IsString()
    @MaxLength(500, { message: 'Group description cannot exceed 500 characters' })
    description?: string;

    @ApiProperty({
        description: 'Array of participant user IDs (minimum 2, maximum 999)',
        example: ['user1', 'user2', 'user3'],
        type: [String],
        minItems: 2,
        maxItems: 999
    })
    @IsArray()
    @ArrayMinSize(2, { message: 'Group must have at least 2 other participants' })
    @ArrayMaxSize(999, { message: 'Group cannot have more than 999 participants' })
    @IsString({ each: true })
    participantIds: string[];

    @ApiPropertyOptional({
        description: 'Group avatar URL',
        example: 'https://example.com/avatar.jpg'
    })
    @IsOptional()
    @IsString()
    @IsUrl({}, { message: 'Avatar URL must be a valid URL' })
    avatarUrl?: string;

    @ApiPropertyOptional({
        description: 'Group settings configuration',
        type: GroupSettingsDto
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => GroupSettingsDto)
    settings?: GroupSettingsDto;

    @ApiPropertyOptional({
        description: 'Initial message to send when creating group',
        example: 'Welcome to our project team!',
        maxLength: 4000
    })
    @IsOptional()
    @IsString()
    @MaxLength(4000, { message: 'Initial message cannot exceed 4000 characters' })
    initialMessage?: string;
}
