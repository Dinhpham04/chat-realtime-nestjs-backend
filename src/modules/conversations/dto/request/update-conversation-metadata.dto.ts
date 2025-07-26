/**
 * Update Conversation Metadata DTO
 * 
 * 🎯 Purpose: Validation for conversation metadata updates
 * 📱 Mobile-First: Optimized for group info editing
 * 🔒 Security: Input validation and authorization
 */

import {
    IsString,
    IsOptional,
    IsUrl,
    MinLength,
    MaxLength,
    ValidateNested,
    IsBoolean,
    IsNumber
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { GroupSettingsDto } from './create-group-conversation.dto';

export class UpdateConversationMetadataDto {
    @ApiPropertyOptional({
        description: 'Updated group name',
        example: 'New Project Team Name',
        minLength: 1,
        maxLength: 100
    })
    @IsOptional()
    @IsString()
    @MinLength(1, { message: 'Group name cannot be empty' })
    @MaxLength(100, { message: 'Group name cannot exceed 100 characters' })
    name?: string;

    @ApiPropertyOptional({
        description: 'Updated group description',
        example: 'Updated description for the project team',
        maxLength: 500
    })
    @IsOptional()
    @IsString()
    @MaxLength(500, { message: 'Group description cannot exceed 500 characters' })
    description?: string;

    @ApiPropertyOptional({
        description: 'Updated group avatar URL',
        example: 'https://example.com/new-avatar.jpg'
    })
    @IsOptional()
    @IsString()
    @IsUrl({}, { message: 'Avatar URL must be a valid URL' })
    avatarUrl?: string;

    @ApiPropertyOptional({
        description: 'Updated group settings',
        type: GroupSettingsDto
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => GroupSettingsDto)
    settings?: Partial<GroupSettingsDto>;
}
