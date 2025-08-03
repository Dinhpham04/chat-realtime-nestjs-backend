import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus, ActivityStatus } from '../enums';

/**
 * Search Users DTO
 * 
 * 🎯 Purpose: Advanced user search with filters
 * 📱 Mobile-First: Optimized for mobile search UI
 * 🛡️ Security: Input validation and sanitization
 */
export class SearchUsersDto {
    @ApiPropertyOptional({
        description: 'Search query (name, username, phone)',
        example: 'john'
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => value?.trim())
    query?: string;

    @ApiPropertyOptional({
        description: 'Filter by user status',
        example: UserStatus.ACTIVE,
        enum: UserStatus
    })
    @IsOptional()
    @IsEnum(UserStatus)
    status?: UserStatus;

    @ApiPropertyOptional({
        description: 'Filter by activity status',
        example: ActivityStatus.ONLINE,
        enum: ActivityStatus
    })
    @IsOptional()
    @IsEnum(ActivityStatus)
    activityStatus?: ActivityStatus;

    @ApiPropertyOptional({
        description: 'Page number for pagination',
        example: 1,
        minimum: 1
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({
        description: 'Number of users per page',
        example: 10,
        minimum: 1,
        maximum: 50
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    limit?: number = 10;
}
