import { ApiProperty } from '@nestjs/swagger';

/**
 * Authentication Response Data Transfer Object
 * Standardized response format for authentication endpoints
 * 
 * Used for:
 * - Login responses
 * - Registration responses
 * - Token refresh responses
 */
export class AuthResponseDto {
  @ApiProperty({
    description: 'User information',
    example: {
      id: '507f1f77bcf86cd799439011',
      phoneNumber: '+84901234567',
      isActive: true,
      createdAt: '2025-07-14T10:30:00.000Z'
    }
  })
  user: {
    id: string;
    phoneNumber: string;
    isActive: boolean;
    createdAt: Date;
  };

  @ApiProperty({
    description: 'JWT tokens',
    example: {
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      expiresIn: 900
    }
  })
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };

  @ApiProperty({
    description: 'Device information',
    example: {
      deviceId: 'device-uuid-12345',
      deviceType: 'mobile',
      deviceName: 'iPhone 14 Pro',
      platform: 'ios',
      appVersion: '1.0.0'
    }
  })
  device: {
    deviceId: string;
    deviceType: string;
    deviceName: string;
    platform: string;
    appVersion: string;
  };
}

/**
 * Token Refresh Response Data Transfer Object
 * Response format for token refresh endpoint
 */
export class TokenRefreshResponseDto {
  @ApiProperty({
    description: 'New access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  accessToken: string;

  @ApiProperty({
    description: 'Token expiration time in seconds',
    example: 900
  })
  expiresIn: number;
}

/**
 * Logout Response Data Transfer Object
 * Response format for logout endpoints
 */
export class LogoutResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Logged out successfully'
  })
  message: string;
}

/**
 * User Profile Response Data Transfer Object
 * Response format for profile endpoint
 */
export class UserProfileResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: '507f1f77bcf86cd799439011'
  })
  id: string;

  @ApiProperty({
    description: 'User phone number',
    example: '+84901234567'
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'User active status',
    example: true
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Current device ID',
    example: 'device-uuid-12345'
  })
  deviceId: string;

  @ApiProperty({
    description: 'User roles',
    example: ['user']
  })
  roles: string[];
}
