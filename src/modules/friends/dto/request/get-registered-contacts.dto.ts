import { IsOptional, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * GetRegisteredContactsDto - Query parameters for registered contacts
 * 
 * 🎯 Purpose: Validate registered contacts query parameters
 * 📱 Mobile-First: Pagination and filtering optimization
 * 🚀 Single Responsibility: Only query validation
 */
export class GetRegisteredContactsDto {
    @ApiPropertyOptional({
        description: 'Maximum number of contacts to return',
        example: 50,
        minimum: 1,
        maximum: 100
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number = 50;

    @ApiPropertyOptional({
        description: 'Number of contacts to skip',
        example: 0,
        minimum: 0
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    offset?: number = 0;

    @ApiPropertyOptional({
        description: 'Include contacts who are already friends',
        example: false
    })
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    includeAlreadyFriends?: boolean = false;
}
