import { IsOptional, IsString, IsDateString, IsEnum, IsUrl, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '../enums';

/**
 * Update Profile DTO
 * 
 * 🎯 Purpose: Validate profile update requests
 * 📱 Mobile-First: Optimized for mobile profile editing
 * 🛡️ Security: Input validation and sanitization
 */
export class UpdateProfileDto {
    @ApiPropertyOptional({
        description: 'User full name',
        example: 'Nguyễn Văn A',
        maxLength: 100
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => value?.trim())
    @MaxLength(100, { message: 'Full name must not exceed 100 characters' })
    fullName?: string;

    @ApiPropertyOptional({
        description: 'User bio/about section',
        example: 'Love coding and coffee ☕',
        maxLength: 500
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => value?.trim())
    @MaxLength(500, { message: 'Bio must not exceed 500 characters' })
    bio?: string;

    @ApiPropertyOptional({
        description: 'Date of birth',
        example: '1995-05-15'
    })
    @IsOptional()
    @IsDateString({}, { message: 'Date of birth must be a valid date' })
    dateOfBirth?: string;

    @ApiPropertyOptional({
        description: 'User gender',
        example: Gender.MALE,
        enum: Gender
    })
    @IsOptional()
    @IsEnum(Gender, { message: 'Gender must be a valid enum value' })
    gender?: Gender;

    @ApiPropertyOptional({
        description: 'Unique username',
        example: 'john_doe_95',
        minLength: 3,
        maxLength: 30
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => value?.trim().toLowerCase())
    @MinLength(3, { message: 'Username must be at least 3 characters' })
    @MaxLength(30, { message: 'Username must not exceed 30 characters' })
    username?: string;
}
