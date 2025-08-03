import { IsUrl, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Update Avatar DTO
 * 
 * 🎯 Purpose: Validate avatar URL updates
 * 📱 Mobile-First: Handle avatar from file upload service
 * 🛡️ Security: URL validation
 */
export class UpdateAvatarDto {
    @ApiPropertyOptional({
        description: 'Avatar image URL from file service',
        example: 'https://cdn.example.com/avatars/user123.jpg'
    })
    @IsOptional()
    @IsUrl({}, { message: 'Avatar URL must be a valid URL' })
    avatarUrl?: string;
}
