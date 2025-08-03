import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';
import { UserStatus, ActivityStatus, Gender } from '../enums';

/**
 * Profile Response DTO
 * 
 * 🎯 Purpose: Standardized profile response format
 * 📱 Mobile-First: Optimized data structure for mobile apps
 * 🛡️ Security: Exclude sensitive fields
 */
export class ProfileResponseDto {
    @ApiProperty({
        description: 'User unique identifier',
        example: '64a7b8c9d1e2f3a4b5c6d7e8'
    })
    @Expose()
    id: string;

    @ApiProperty({
        description: 'Phone number (primary identifier)',
        example: '+84901234567'
    })
    @Expose()
    phoneNumber: string;

    @ApiProperty({
        description: 'Phone verification status',
        example: true
    })
    @Expose()
    isPhoneVerified: boolean;

    @ApiPropertyOptional({
        description: 'Email address',
        example: 'user@example.com'
    })
    @Expose()
    email?: string;

    @ApiPropertyOptional({
        description: 'Unique username',
        example: 'john_doe'
    })
    @Expose()
    username?: string;

    @ApiProperty({
        description: 'User full name',
        example: 'Nguyễn Văn A'
    })
    @Expose()
    fullName: string;

    @ApiPropertyOptional({
        description: 'User bio/about section',
        example: 'Love coding and coffee ☕'
    })
    @Expose()
    bio?: string;

    @ApiPropertyOptional({
        description: 'Date of birth',
        example: '1995-05-15T00:00:00.000Z'
    })
    @Expose()
    dateOfBirth?: Date;

    @ApiPropertyOptional({
        description: 'User gender',
        example: Gender.MALE,
        enum: Gender
    })
    @Expose()
    gender?: Gender;

    @ApiPropertyOptional({
        description: 'Avatar image URL',
        example: 'https://cdn.example.com/avatars/user123.jpg'
    })
    @Expose()
    avatarUrl?: string;

    @ApiProperty({
        description: 'Account status',
        example: UserStatus.ACTIVE,
        enum: UserStatus
    })
    @Expose()
    status: UserStatus;

    @ApiProperty({
        description: 'Current activity status',
        example: ActivityStatus.ONLINE,
        enum: ActivityStatus
    })
    @Expose()
    activityStatus: ActivityStatus;

    @ApiPropertyOptional({
        description: 'Last seen timestamp',
        example: '2024-08-03T10:30:00.000Z'
    })
    @Expose()
    lastSeen?: Date;

    @ApiProperty({
        description: 'Email verification status',
        example: true
    })
    @Expose()
    isEmailVerified: boolean;

    @ApiProperty({
        description: 'Account creation timestamp',
        example: '2024-01-15T09:00:00.000Z'
    })
    @Expose()
    createdAt: Date;

    @ApiProperty({
        description: 'Last update timestamp',
        example: '2024-08-03T10:30:00.000Z'
    })
    @Expose()
    updatedAt: Date;

    // Security: Exclude sensitive fields
    @Exclude()
    passwordHash?: string;

    @Exclude()
    emailVerificationToken?: string;

    @Exclude()
    passwordResetToken?: string;

    @Exclude()
    passwordResetExpires?: Date;

    @Exclude()
    phoneVerificationCode?: string;

    @Exclude()
    phoneVerificationExpires?: Date;

    @Exclude()
    friends?: any[];

    @Exclude()
    blocked?: any[];
}
