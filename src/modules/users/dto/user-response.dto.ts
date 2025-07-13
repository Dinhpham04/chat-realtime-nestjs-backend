import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

export class UserResponseDto {
  @ApiProperty({
    description: 'User unique identifier',
    example: '64a7b8c9d1e2f3a4b5c6d7e8'
  })
  @Expose() // Expose để đảm bảo trường này được trả về trong response
  id: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com'
  })
  @Expose()
  email: string;

  @ApiProperty({
    description: 'Unique username',
    example: 'john_doe'
  })
  @Expose()
  username: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe'
  })
  @Expose()
  fullName: string;

  @ApiPropertyOptional({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg'
  })
  @Expose()
  avatarUrl?: string;

  @ApiProperty({
    description: 'User account status',
    enum: ['active', 'inactive', 'banned'],
    example: 'active'
  })
  @Expose()
  status: string;

  @ApiProperty({
    description: 'Last seen timestamp',
    example: '2024-01-15T10:30:00.000Z'
  })
  @Expose()
  @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
  lastSeen: string;

  @ApiProperty({
    description: 'Current online status',
    example: true
  })
  @Expose()
  isOnline: boolean;

  @ApiProperty({
    description: 'List of friend user IDs',
    type: [String],
    example: ['64a7b8c9d1e2f3a4b5c6d7e9', '64a7b8c9d1e2f3a4b5c6d7ea']
  })
  @Expose()
  friends: string[];

  @ApiProperty({
    description: 'Email verification status',
    example: true
  })
  @Expose()
  isEmailVerified: boolean;

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2024-01-01T00:00:00.000Z'
  })
  @Expose()
  @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
  createdAt: string;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-15T10:30:00.000Z'
  })
  @Expose()
  @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
  updatedAt: string;

  // Excluded fields (không trả về trong API response)
  @Exclude()
  passwordHash: string;

  @Exclude()
  refreshToken?: string;

  @Exclude()
  emailVerificationToken?: string;

  @Exclude()
  passwordResetToken?: string;

  @Exclude()
  passwordResetExpires?: Date;

  @Exclude()
  blocked: string[];
}

export class UserSearchResponseDto {
  @ApiProperty({
    description: 'User unique identifier',
    example: '64a7b8c9d1e2f3a4b5c6d7e8'
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Unique username',
    example: 'john_doe'
  })
  @Expose()
  username: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe'
  })
  @Expose()
  fullName: string;

  @ApiPropertyOptional({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg'
  })
  @Expose()
  avatarUrl?: string;

  @ApiProperty({
    description: 'Current online status',
    example: true
  })
  @Expose()
  isOnline: boolean;

  @ApiProperty({
    description: 'Is this user already a friend',
    example: false
  })
  @Expose()
  isFriend: boolean;
}

export class FindUsersResponseDto {
  @ApiProperty({
    description: 'List of user search results',
    type: [UserResponseDto],
  })
  @Expose()
  users: UserResponseDto[];

  @ApiProperty({
    description: 'Total number of users found',
    example: 150
  })
  @Expose()
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1
  })
  @Expose()
  page: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 8
  })
  @Expose()
  totalPages: number;

  @ApiProperty({
    description: 'Number of users per page',
    example: 20
  })
  @Expose()
  limit: number;
}