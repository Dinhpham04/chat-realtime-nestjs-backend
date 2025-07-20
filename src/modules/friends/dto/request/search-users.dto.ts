import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * SearchUsersDto - Query parameters for user search
 * 
 * 🎯 Purpose: Validate user search query parameters
 * 📱 Mobile-First: Smart auto-detection của search type
 * 🚀 Single Responsibility: Only user search validation
 */
export class SearchUsersDto {
    @ApiProperty({
        description: 'Search query - auto-detects phone numbers vs names',
        example: 'Nguyen Van A',
        examples: {
            name: { value: 'Nguyen Van A', description: 'Search by name' },
            phone: { value: '+84901234567', description: 'Search by phone number' }
        },
        maxLength: 50
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    query: string;

    // Remove type parameter - auto-detect instead

    @ApiPropertyOptional({
        description: 'Page number',
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
        example: 10,
        minimum: 1,
        maximum: 50
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(50)
    limit?: number = 10;
}
