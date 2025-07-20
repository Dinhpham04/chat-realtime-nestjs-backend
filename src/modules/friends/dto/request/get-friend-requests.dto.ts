import { IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * GetFriendRequestsDto - Query parameters for friend requests
 * 
 * 🎯 Purpose: Validate friend requests query parameters
 * 📱 Mobile-First: Pagination and filtering
 * 🚀 Single Responsibility: Only query validation
 */
export class GetFriendRequestsDto {
    @ApiPropertyOptional({
        description: 'Type of friend requests to fetch',
        enum: ['incoming', 'outgoing', 'all'],
        example: 'all'
    })
    @IsOptional()
    @IsEnum(['incoming', 'outgoing', 'all'])
    type?: 'incoming' | 'outgoing' | 'all' = 'all';

    @ApiPropertyOptional({
        description: 'Status filter for requests',
        enum: ['PENDING', 'ACCEPTED', 'DECLINED'],
        example: 'PENDING'
    })
    @IsOptional()
    @IsEnum(['PENDING', 'ACCEPTED', 'DECLINED'])
    status?: 'PENDING' | 'ACCEPTED' | 'DECLINED';

    @ApiPropertyOptional({
        description: 'Maximum number of requests to return',
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
        description: 'Number of requests to skip',
        example: 0,
        minimum: 0
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    offset?: number = 0;
}
