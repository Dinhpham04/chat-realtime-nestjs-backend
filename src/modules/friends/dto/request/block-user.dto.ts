import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * BlockUserDto - Request validation for blocking users
 * 
 * 🎯 Purpose: Validate block user input data
 * 📱 Mobile-First: Simple block functionality
 * 🚀 Single Responsibility: Only block user validation
 */
export class BlockUserDto {
    @ApiPropertyOptional({
        description: 'Block reason',
        example: 'Inappropriate behavior',
        maxLength: 200
    })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    reason?: string;
}
