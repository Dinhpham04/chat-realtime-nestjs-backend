/**
 * Get User Conversations Query DTO
 * 
 * 🎯 Purpose: Validation for conversations list queries
 * 📱 Mobile-First: Optimized pagination and filtering
 * 🔒 Security: Query parameter validation
 */

import {
    IsOptional,
    IsEnum,
    IsNumber,
    IsString,
    Min,
    Max,
    IsBoolean
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum ConversationTypeFilter {
    DIRECT = 'direct',
    GROUP = 'group',
    ALL = 'all'
}

export enum ConversationStatusFilter {
    ACTIVE = 'active',
    ARCHIVED = 'archived',
    ALL = 'all'
}

export enum ConversationSortBy {
    UPDATED = 'updated',
    CREATED = 'created',
    NAME = 'name'
}

export class GetUserConversationsQueryDto {
    @ApiPropertyOptional({
        description: 'Filter by conversation type',
        enum: ConversationTypeFilter,
        default: ConversationTypeFilter.ALL,
        example: ConversationTypeFilter.ALL
    })
    @IsOptional()
    @IsEnum(ConversationTypeFilter)
    type?: ConversationTypeFilter = ConversationTypeFilter.ALL;

    @ApiPropertyOptional({
        description: 'Filter by conversation status',
        enum: ConversationStatusFilter,
        default: ConversationStatusFilter.ACTIVE,
        example: ConversationStatusFilter.ACTIVE
    })
    @IsOptional()
    @IsEnum(ConversationStatusFilter)
    status?: ConversationStatusFilter = ConversationStatusFilter.ACTIVE;

    @ApiPropertyOptional({
        description: 'Number of conversations to return',
        default: 20,
        minimum: 1,
        maximum: 100,
        example: 20
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @ApiPropertyOptional({
        description: 'Number of conversations to skip',
        default: 0,
        minimum: 0,
        example: 0
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    offset?: number = 0;

    @ApiPropertyOptional({
        description: 'Search term for conversation name or last message',
        example: 'project',
        maxLength: 100
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({
        description: 'Sort conversations by',
        enum: ConversationSortBy,
        default: ConversationSortBy.UPDATED,
        example: ConversationSortBy.UPDATED
    })
    @IsOptional()
    @IsEnum(ConversationSortBy)
    sortBy?: ConversationSortBy = ConversationSortBy.UPDATED;

    @ApiPropertyOptional({
        description: 'Include only pinned conversations',
        default: false,
        example: false
    })
    @IsOptional()
    @Transform(({ value }) => value === 'true')
    @IsBoolean()
    pinnedOnly?: boolean = false;

    @ApiPropertyOptional({
        description: 'Include only unread conversations',
        default: false,
        example: false
    })
    @IsOptional()
    @Transform(({ value }) => value === 'true')
    @IsBoolean()
    unreadOnly?: boolean = false;
}
