import { IsOptional, IsString, IsUrl, MaxLength, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'User full name',
    example: 'John Doe Updated',
    maxLength: 100
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  fullName?: string;

  @ApiPropertyOptional({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg'
  })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}

export class UpdateUserStatusDto {
  @ApiPropertyOptional({
    description: 'User online status',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;
}

export class UpdateUserPasswordDto {
  @ApiPropertyOptional({
    description: 'Current password for verification',
    example: 'currentPassword123'
  })
  @IsString()
  currentPassword: string;

  @ApiPropertyOptional({
    description: 'New password',
    example: 'newPassword123!',
    minLength: 6
  })
  @IsString()
  @MaxLength(128)
  newPassword: string;
}

