import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { HttpStatus } from '@nestjs/common';
import { RegisterDto, LoginDto, RefreshTokenDto } from '../dto';
import {
  AuthResponseDto,
  TokenRefreshResponseDto,
  ApiErrorResponseDto
} from '../dto/response.dto';

/**
 * Swagger Documentation for Auth Controller
 * 
 * Following instruction-senior.md:
 * - Separation of concerns
 * - Clean Code principles
 * - Reusable documentation components
 */

// Common error responses
const commonErrorResponses = {
  badRequest: {
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation errors in request data',
    type: ApiErrorResponseDto,
    example: {
      statusCode: 400,
      message: ['Validation error messages'],
      error: 'Bad Request',
      timestamp: '2024-01-15T10:30:00.000Z',
      path: '/api/v1/auth/*'
    }
  },
  unauthorized: {
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - invalid credentials or token',
    type: ApiErrorResponseDto,
    example: {
      statusCode: 401,
      message: 'Unauthorized',
      error: 'Unauthorized',
      timestamp: '2024-01-15T10:30:00.000Z',
      path: '/api/v1/auth/*'
    }
  },
  tooManyRequests: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded',
    type: ApiErrorResponseDto,
    example: {
      statusCode: 429,
      message: 'Too many requests. Please try again later.',
      error: 'Too Many Requests',
      timestamp: '2024-01-15T10:30:00.000Z',
      path: '/api/v1/auth/*'
    }
  }
};

/**
 * Register endpoint documentation
 */
export function RegisterApiDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Register new user account',
      description: `
## Register New User

Creates a new user account with phone number and password authentication.

### Business Rules:
- Phone number must be unique
- Password must meet security requirements (min 8 characters)
- Device information is required for session management
- Maximum 5 devices per user account

### Security Features:
- Password hashing with bcrypt (salt rounds: 12)
- Device registration and tracking
- Audit logging for registration events
- Rate limiting: 5 requests per 15 minutes per IP

### Response:
Returns complete authentication response with:
- User profile information
- JWT access and refresh tokens
- Device registration confirmation
      `,
    }),
    ApiBody({
      type: RegisterDto,
      description: 'User registration data with device information',
      examples: {
        'Mobile User': {
          summary: 'Mobile app registration',
          value: {
            phoneNumber: '+84901234567',
            fullName: 'Nguyen Van A',
            password: 'SecurePassword123!',
            confirmPassword: 'SecurePassword123!',
            deviceInfo: {
              deviceId: 'mobile_device_12345',
              deviceName: 'iPhone 15 Pro',
              deviceType: 'mobile',
              platform: 'ios',
              pushToken: 'expo_push_token_xyz789'
            }
          }
        },
        'Web User': {
          summary: 'Web application registration',
          value: {
            phoneNumber: '+84987654321',
            fullName: 'Tran Thi B',
            password: 'MySecurePass456!',
            confirmPassword: 'MySecurePass456!',
            deviceInfo: {
              deviceId: 'web_device_67890',
              deviceName: 'Chrome Browser',
              deviceType: 'web',
              platform: 'web'
            }
          }
        }
      }
    }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'User successfully registered and authenticated',
      type: AuthResponseDto,
      example: {
        user: {
          id: '507f1f77bcf86cd799439011',
          phoneNumber: '+84901234567',
          fullName: 'Nguyen Van A',
          status: 'ACTIVE',
          isPhoneVerified: true,
          isOnline: true,
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z'
        },
        tokens: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          accessTokenExpiresIn: '15m',
          refreshTokenExpiresIn: '7d'
        },
        device: {
          deviceId: 'mobile_device_12345',
          deviceName: 'iPhone 15 Pro',
          deviceType: 'mobile',
          platform: 'ios',
          isActive: true,
          createdAt: '2024-01-15T10:30:00.000Z',
          lastActiveAt: '2024-01-15T10:30:00.000Z'
        }
      }
    }),
    ApiResponse(commonErrorResponses.badRequest),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Phone number already registered',
      type: ApiErrorResponseDto,
      example: {
        statusCode: 409,
        message: 'Phone number already registered',
        error: 'Conflict',
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/auth/register'
      }
    }),
    ApiResponse(commonErrorResponses.tooManyRequests)
  );
}

/**
 * Login endpoint documentation
 */
export function LoginApiDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'User login',
      description: `
## User Authentication

Authenticate user with phone number and password.

### Business Rules:
- Account must be active and not locked
- Device limit enforcement (max 5 devices)
- Login attempt tracking and rate limiting

### Security Features:
- Password verification with bcrypt
- Device fingerprinting and tracking
- Failed attempt counting and lockout
- Session management with JWT tokens

### Response:
Returns authentication response with user profile and tokens.
      `
    }),
    ApiBody({
      type: LoginDto,
      description: 'User login credentials with device information',
      examples: {
        'Mobile Login': {
          summary: 'Mobile app login',
          value: {
            phoneNumber: '+84901234567',
            password: 'SecurePassword123!',
            deviceInfo: {
              deviceId: 'mobile_device_12345',
              deviceName: 'iPhone 15 Pro',
              deviceType: 'mobile',
              platform: 'ios',
              pushToken: 'expo_push_token_xyz789'
            }
          }
        },
        'Web Login': {
          summary: 'Web application login',
          value: {
            phoneNumber: '+84987654321',
            password: 'MySecurePass456!',
            deviceInfo: {
              deviceId: 'web_device_67890',
              deviceName: 'Chrome Browser',
              deviceType: 'web',
              platform: 'web'
            }
          }
        }
      }
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'User successfully authenticated',
      type: AuthResponseDto
    }),
    ApiResponse(commonErrorResponses.unauthorized),
    ApiResponse(commonErrorResponses.tooManyRequests)
  );
}

/**
 * Refresh Token endpoint documentation
 */
export function RefreshTokenApiDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Refresh access token',
      description: `
## Token Refresh

Get new access token using refresh token.

### Business Rules:
- Refresh token must be valid and not expired
- Device must still be active and registered
- Rate limiting applies to prevent abuse

### Security Features:
- Refresh token rotation (optional)
- Device validation on refresh
- Token blacklisting on security events
      `
    }),
    ApiBody({
      type: RefreshTokenDto,
      description: 'Refresh token for generating new access token',
      examples: {
        'Token Refresh': {
          summary: 'Standard token refresh request',
          value: {
            refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
          }
        }
      }
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Token refreshed successfully',
      type: TokenRefreshResponseDto,
    }),
    ApiResponse(commonErrorResponses.unauthorized)
  );
}

/**
 * Logout endpoint documentation
 */
export function LogoutApiDocs() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Logout from current device',
      description: `
## Device Logout

Logout user from current device.

### Business Rules:
- Only affects current device session
- Invalidates current access and refresh tokens
- Device status updated to inactive

### Security Features:
- Token invalidation and blacklisting
- Audit logging for logout events
- Device session cleanup
      `
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'User logged out successfully',
      example: {
        message: 'Logged out successfully'
      }
    }),
    ApiResponse(commonErrorResponses.unauthorized)
  );
}

/**
 * Logout All endpoint documentation
 */
export function LogoutAllApiDocs() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Logout from all devices',
      description: `
## Global Logout

Logout user from all registered devices.

### Business Rules:
- Affects all user devices and sessions
- Invalidates all access and refresh tokens
- All devices marked as inactive

### Security Features:
- Complete session termination
- All tokens invalidated and blacklisted
- Security audit logging
- Force re-authentication required
      `
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'User logged out from all devices successfully',
      example: {
        message: 'Logged out from all devices successfully'
      }
    }),
    ApiResponse(commonErrorResponses.unauthorized)
  );
}

/**
 * Get Profile endpoint documentation
 */
export function GetProfileApiDocs() {
  return applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Get current user profile',
      description: `
## User Profile

Get authenticated user profile information.

### Response Data:
- User identification and contact info
- Account status and verification state
- Current device information
- User roles and permissions
      `
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'User profile retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '507f1f77bcf86cd799439011' },
          phoneNumber: { type: 'string', example: '+84901234567' },
          isActive: { type: 'boolean', example: true },
          deviceId: { type: 'string', example: 'mobile_device_12345' },
          roles: {
            type: 'array',
            items: { type: 'string' },
            example: ['user']
          },
        },
      },
    }),
    ApiResponse(commonErrorResponses.unauthorized)
  );
}

/**
 * Health Check endpoint documentation
 */
export function HealthCheckApiDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Auth service health check',
      description: 'Check if authentication service is running and healthy'
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Service is healthy',
      example: {
        status: 'healthy',
        service: 'auth',
        timestamp: '2024-01-15T10:30:00.000Z'
      }
    })
  );
}
