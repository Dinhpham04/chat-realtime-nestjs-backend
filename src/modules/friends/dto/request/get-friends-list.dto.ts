import { IsString, IsOptional, IsNumber, IsBoolean, Min, Max, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * GetFriendsListDto - Query parameters for friends list
 * 
 * 🎯 Purpose: Validate friends list query parameters
 * 📱 Mobile-First: Pagination and search optimization
 * 🚀 Single Responsibility: Only friends list query validation
 */
export class GetFriendsListDto {
    @ApiPropertyOptional({
        description: 'Page number (1-based)',
        example: 1,
        minimum: 1
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({
        description: 'Items per page',
        example: 20,
        minimum: 1,
        maximum: 100
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @ApiPropertyOptional({
        description: 'Search query',
        example: 'john',
        maxLength: 50
    })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    search?: string;

    @ApiPropertyOptional({
        description: 'Filter results by online status (true=online only, false=offline only, undefined=all)',
        example: true
    })
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    onlineStatus?: boolean;

    @ApiPropertyOptional({
        description: 'Sort by criteria',
        example: 'recent',
        enum: ['recent', 'name', 'mutual']
    })
    @IsOptional()
    @IsString()
    @IsIn(['recent', 'name', 'mutual'])
    sortBy?: 'recent' | 'name' | 'mutual' = 'recent';
}
