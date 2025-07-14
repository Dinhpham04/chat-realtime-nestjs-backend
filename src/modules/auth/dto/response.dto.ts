import { ApiProperty } from '@nestjs/swagger';

/**
 * Device Information Response DTO
 * Following Senior Guidelines:
 * - Complete type definitions
 * - Detailed API documentation
 * - Real-world examples
 */
export class DeviceInfoResponseDto {
  @ApiProperty({
    description: 'Unique device identifier',
    example: 'device_1234567890abcdef',
    minLength: 10,
    maxLength: 50,
  })
  deviceId: string;

  @ApiProperty({
    description: 'Human-readable device name',
    example: 'iPhone 15 Pro',
    maxLength: 100,
  })
  deviceName: string;

  @ApiProperty({
    description: 'Device type category',
    example: 'mobile',
    enum: ['mobile', 'web', 'desktop'],
  })
  deviceType: string;

  @ApiProperty({
    description: 'Operating system platform',
    example: 'ios',
    enum: ['ios', 'android', 'web', 'windows', 'macos'],
  })
  platform: string;

  @ApiProperty({
    description: 'Push notification token for the device',
    example: 'expo_push_token_xyz789',
    required: false,
  })
  pushToken?: string;

  @ApiProperty({
    description: 'Push notification provider',
    example: 'APNS',
    enum: ['APNS', 'FCM'],
  })
  pushProvider: string;

  @ApiProperty({
    description: 'Device registration timestamp',
    example: '2024-01-15T10:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last activity timestamp',
    example: '2024-01-15T15:45:30.000Z',
    type: String,
    format: 'date-time',
  })
  lastActiveAt: Date;

  @ApiProperty({
    description: 'Device active status',
    example: true,
    type: Boolean,
  })
  isActive: boolean;
}

/**
 * User Profile Response DTO
 */
export class UserProfileResponseDto {
  @ApiProperty({
    description: 'Unique user identifier',
    example: '507f1f77bcf86cd799439011',
    pattern: '^[0-9a-fA-F]{24}$',
  })
  id: string;

  @ApiProperty({
    description: 'User phone number with country code',
    example: '+84901234567',
    pattern: '^\\+[1-9]\\d{1,14}$',
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'User full name',
    example: 'Nguyen Van A',
    maxLength: 50,
  })
  fullName?: string;

  @ApiProperty({
    description: 'User account status',
    example: 'ACTIVE',
    enum: ['ACTIVE', 'INACTIVE', 'BANNED', 'PENDING'],
  })
  status: string;

  @ApiProperty({
    description: 'Phone number verification status',
    example: true,
  })
  isPhoneVerified: boolean;

  @ApiProperty({
    description: 'User online status',
    example: true,
  })
  isOnline: boolean;

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2024-01-15T10:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last profile update timestamp',
    example: '2024-01-15T15:45:30.000Z',
    type: String,
    format: 'date-time',
  })
  updatedAt: Date;
}

/**
 * JWT Token Pair Response DTO
 */
export class TokenPairResponseDto {
  @ApiProperty({
    description: 'JWT access token for API authentication',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTEiLCJwaG9uZU51bWJlciI6Iis4NDkwMTIzNDU2NyIsImRldmljZUlkIjoiZGV2aWNlXzEyMzQ1Njc4OTBhYmNkZWYiLCJyb2xlcyI6WyJ1c2VyIl0sImlhdCI6MTY0MjI0MjYwMCwiZXhwIjoxNjQyMjQzNTAwfQ.signature',
    minLength: 100,
  })
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh token for token renewal',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTEiLCJkZXZpY2VJZCI6ImRldmljZV8xMjM0NTY3ODkwYWJjZGVmIiwiaWF0IjoxNjQyMjQyNjAwLCJleHAiOjE2NDI4NDc0MDB9.refresh_signature',
    minLength: 100,
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Access token expiration time',
    example: '15m',
  })
  accessTokenExpiresIn: string;

  @ApiProperty({
    description: 'Refresh token expiration time',
    example: '7d',
  })
  refreshTokenExpiresIn: string;
}

/**
 * Authentication Response DTO
 */
export class AuthResponseDto {
  @ApiProperty({
    description: 'Authenticated user information',
    type: UserProfileResponseDto,
  })
  user: UserProfileResponseDto;

  @ApiProperty({
    description: 'JWT token pair for authentication',
    type: TokenPairResponseDto,
  })
  tokens: TokenPairResponseDto;

  @ApiProperty({
    description: 'Device information used for authentication',
    type: DeviceInfoResponseDto,
  })
  device: DeviceInfoResponseDto;
}

/**
 * Standard API Error Response DTO
 */
export class ApiErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
    minimum: 400,
    maximum: 599,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Error message(s)',
    oneOf: [
      { type: 'string', example: 'Invalid phone number format' },
      {
        type: 'array',
        items: { type: 'string' },
        example: ['Phone number is required', 'Password must be at least 8 characters']
      }
    ],
  })
  message: string | string[];

  @ApiProperty({
    description: 'Error type identifier',
    example: 'Bad Request',
  })
  error: string;

  @ApiProperty({
    description: 'Request timestamp',
    example: '2024-01-15T10:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  timestamp: string;

  @ApiProperty({
    description: 'API endpoint path',
    example: '/api/v1/auth/register',
  })
  path: string;
}

/**
 * Pagination Metadata DTO
 */
export class PaginationMetaDto {
  @ApiProperty({
    description: 'Current page number',
    example: 1,
    minimum: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of items',
    example: 150,
    minimum: 0,
  })
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 8,
    minimum: 0,
  })
  totalPages: number;

  @ApiProperty({
    description: 'Has next page flag',
    example: true,
  })
  hasNext: boolean;

  @ApiProperty({
    description: 'Has previous page flag',
    example: false,
  })
  hasPrev: boolean;
}

/**
 * Paginated Response DTO
 */
export class PaginatedResponseDto<T> {
  @ApiProperty({
    description: 'Array of items for current page',
    isArray: true,
  })
  data: T[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  meta: PaginationMetaDto;
}

/**
 * Token Refresh Response DTO
 */
export class TokenRefreshResponseDto {
  @ApiProperty({
    description: 'New JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Token expiration time in seconds',
    example: 900,
  })
  expiresIn: number;
}

/**
 * Logout Response DTO
 */
export class LogoutResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Successfully logged out',
  })
  message: string;

  @ApiProperty({
    description: 'Logout timestamp',
    example: '2024-01-15T10:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  timestamp: Date;
}
