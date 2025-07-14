import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { HttpStatus } from '@nestjs/common';
import { DeviceInfoDto } from '../dto/device-info.dto';
import {
  DeviceInfoResponseDto,
  ApiErrorResponseDto,
  PaginatedResponseDto
} from '../dto/response.dto';

/**
 * Swagger Documentation for Device Controller
 * 
 * Following instruction-senior.md:
 * - Clean separation of concerns
 * - Reusable documentation components
 * - Comprehensive API documentation
 */

// Common error responses for authenticated endpoints
const deviceErrorResponses = {
  unauthorized: {
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - invalid or expired token',
    type: ApiErrorResponseDto,
    example: {
      statusCode: 401,
      message: 'Unauthorized',
      error: 'Unauthorized',
      timestamp: '2024-01-15T10:30:00.000Z',
      path: '/api/v1/devices/*'
    }
  },
  forbidden: {
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - insufficient permissions',
    type: ApiErrorResponseDto,
    example: {
      statusCode: 403,
      message: 'Forbidden resource',
      error: 'Forbidden',
      timestamp: '2024-01-15T10:30:00.000Z',
      path: '/api/v1/devices/*'
    }
  },
  notFound: {
    status: HttpStatus.NOT_FOUND,
    description: 'Device not found',
    type: ApiErrorResponseDto,
    example: {
      statusCode: 404,
      message: 'Device not found',
      error: 'Not Found',
      timestamp: '2024-01-15T10:30:00.000Z',
      path: '/api/v1/devices/*'
    }
  },
  badRequest: {
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation errors in request data',
    type: ApiErrorResponseDto,
    example: {
      statusCode: 400,
      message: ['Validation error messages'],
      error: 'Bad Request',
      timestamp: '2024-01-15T10:30:00.000Z',
      path: '/api/v1/devices/*'
    }
  }
};

/**
 * Get All User Devices endpoint documentation
 */
export function GetAllDevicesApiDocs() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get all user devices',
      description: `
## Get User Devices

Retrieve all registered devices for the authenticated user.

### Business Rules:
- Only returns devices belonging to the authenticated user
- Includes device status and last activity information
- Supports pagination for large device lists
- Devices are ordered by last activity (most recent first)

### Security Features:
- JWT authentication required
- User isolation (only own devices visible)
- Rate limiting: 100 requests per minute per user

### Response:
Returns paginated list of user devices with:
- Device identification and metadata
- Activity status and timestamps
- Platform and version information
- Security and registration details
      `,
    }),
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      description: 'Page number (default: 1)',
      example: 1
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Items per page (default: 10, max: 50)',
      example: 10
    }),
    ApiQuery({
      name: 'status',
      required: false,
      type: String,
      enum: ['active', 'inactive', 'all'],
      description: 'Filter by device status (default: all)',
      example: 'active'
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'User devices retrieved successfully',
      type: PaginatedResponseDto,
      example: {
        data: [
          {
            id: '507f1f77bcf86cd799439011',
            deviceId: 'mobile_device_12345',
            deviceName: 'iPhone 15 Pro',
            deviceType: 'mobile',
            platform: 'ios',
            appVersion: '1.2.3',
            isActive: true,
            lastActiveAt: '2024-01-15T10:30:00.000Z',
            createdAt: '2024-01-10T08:00:00.000Z'
          },
          {
            id: '507f1f77bcf86cd799439012',
            deviceId: 'web_device_67890',
            deviceName: 'Chrome Browser',
            deviceType: 'web',
            platform: 'web',
            appVersion: '2.1.0',
            isActive: false,
            lastActiveAt: '2024-01-12T15:45:00.000Z',
            createdAt: '2024-01-05T12:30:00.000Z'
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1
        }
      }
    }),
    ApiResponse(deviceErrorResponses.unauthorized)
  );
}

/**
 * Get Device by ID endpoint documentation
 */
export function GetDeviceByIdApiDocs() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get device by ID',
      description: `
## Get Specific Device

Retrieve detailed information about a specific device.

### Business Rules:
- Only device owner can access device details
- Returns complete device information including metadata
- Device must belong to authenticated user

### Security Features:
- JWT authentication required
- Ownership validation
- Device ID must be valid MongoDB ObjectId

### Response:
Returns complete device information with activity history.
      `,
    }),
    ApiParam({
      name: 'deviceId',
      description: 'Device unique identifier',
      type: String,
      example: '507f1f77bcf86cd799439011'
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Device information retrieved successfully',
      type: DeviceInfoResponseDto,
      example: {
        id: '507f1f77bcf86cd799439011',
        deviceId: 'mobile_device_12345',
        deviceName: 'iPhone 15 Pro',
        deviceType: 'mobile',
        platform: 'ios',
        appVersion: '1.2.3',
        pushToken: 'expo_push_token_xyz789',
        isActive: true,
        lastActiveAt: '2024-01-15T10:30:00.000Z',
        createdAt: '2024-01-10T08:00:00.000Z',
        metadata: {
          ipAddress: '192.168.1.100',
          userAgent: 'MyApp/1.2.3 (iOS 17.0)',
          location: {
            country: 'Vietnam',
            city: 'Ho Chi Minh City'
          }
        }
      }
    }),
    ApiResponse(deviceErrorResponses.unauthorized),
    ApiResponse(deviceErrorResponses.notFound)
  );
}

/**
 * Register New Device endpoint documentation
 */
export function RegisterDeviceApiDocs() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Register new device',
      description: `
## Register New Device

Register a new device for the authenticated user.

### Business Rules:
- Maximum 5 devices per user account
- Device ID must be unique across the system
- Each device type has specific validation rules
- Push tokens are required for mobile devices

### Security Features:
- JWT authentication required
- Device fingerprinting for security
- Automatic device deactivation for excess devices
- Rate limiting: 10 registrations per hour per user

### Response:
Returns registered device information with security metadata.
      `,
    }),
    ApiBody({
      type: DeviceInfoDto,
      description: 'Device registration information',
      examples: {
        'Mobile Device': {
          summary: 'Register mobile device',
          value: {
            deviceId: 'mobile_device_67890',
            deviceName: 'Samsung Galaxy S24',
            deviceType: 'mobile',
            platform: 'android',
            appVersion: '1.2.3',
            pushToken: 'fcm_token_abc123'
          }
        },
        'Web Device': {
          summary: 'Register web browser',
          value: {
            deviceId: 'web_device_54321',
            deviceName: 'Firefox Browser',
            deviceType: 'web',
            platform: 'web',
            appVersion: '2.1.0'
          }
        },
        'Desktop App': {
          summary: 'Register desktop application',
          value: {
            deviceId: 'desktop_device_98765',
            deviceName: 'Windows Desktop App',
            deviceType: 'desktop',
            platform: 'windows',
            appVersion: '3.0.1'
          }
        }
      }
    }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Device registered successfully',
      type: DeviceInfoResponseDto,
      example: {
        id: '507f1f77bcf86cd799439013',
        deviceId: 'mobile_device_67890',
        deviceName: 'Samsung Galaxy S24',
        deviceType: 'mobile',
        platform: 'android',
        appVersion: '1.2.3',
        pushToken: 'fcm_token_abc123',
        isActive: true,
        lastActiveAt: '2024-01-15T10:30:00.000Z',
        createdAt: '2024-01-15T10:30:00.000Z'
      }
    }),
    ApiResponse(deviceErrorResponses.badRequest),
    ApiResponse(deviceErrorResponses.unauthorized),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Device already registered or device limit exceeded',
      type: ApiErrorResponseDto,
      example: {
        statusCode: 409,
        message: 'Device limit exceeded. Maximum 5 devices allowed per user.',
        error: 'Conflict',
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/devices'
      }
    })
  );
}

/**
 * Update Device endpoint documentation
 */
export function UpdateDeviceApiDocs() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Update device information',
      description: `
## Update Device

Update device information and metadata.

### Business Rules:
- Only device owner can update device information
- Device ID and type cannot be changed
- Push token updates are tracked for security
- Activity timestamps are automatically updated

### Security Features:
- JWT authentication required
- Ownership validation
- Change audit logging
- Rate limiting: 50 updates per hour per device

### Response:
Returns updated device information.
      `,
    }),
    ApiParam({
      name: 'deviceId',
      description: 'Device unique identifier',
      type: String,
      example: '507f1f77bcf86cd799439011'
    }),
    ApiBody({
      type: DeviceInfoDto,
      description: 'Updated device information',
      examples: {
        'Update Name': {
          summary: 'Update device name',
          value: {
            deviceName: 'My iPhone 15 Pro Max'
          }
        },
        'Update Push Token': {
          summary: 'Update push notification token',
          value: {
            pushToken: 'new_expo_push_token_xyz789'
          }
        },
        'Update App Version': {
          summary: 'Update app version',
          value: {
            appVersion: '1.3.0'
          }
        }
      }
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Device updated successfully',
      type: DeviceInfoResponseDto
    }),
    ApiResponse(deviceErrorResponses.badRequest),
    ApiResponse(deviceErrorResponses.unauthorized),
    ApiResponse(deviceErrorResponses.notFound)
  );
}

/**
 * Delete Device endpoint documentation
 */
export function DeleteDeviceApiDocs() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Delete device',
      description: `
## Delete Device

Remove a registered device from user account.

### Business Rules:
- Only device owner can delete their devices
- Cannot delete currently active session device
- All associated tokens are invalidated
- Audit log entry is created for security tracking

### Security Features:
- JWT authentication required
- Ownership validation
- Token invalidation and cleanup
- Security audit logging
- Prevents deletion of current session device

### Response:
Returns confirmation of device deletion.
      `,
    }),
    ApiParam({
      name: 'deviceId',
      description: 'Device unique identifier to delete',
      type: String,
      example: '507f1f77bcf86cd799439011'
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Device deleted successfully',
      example: {
        message: 'Device deleted successfully',
        deviceId: '507f1f77bcf86cd799439011'
      }
    }),
    ApiResponse(deviceErrorResponses.unauthorized),
    ApiResponse(deviceErrorResponses.notFound),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Cannot delete current session device',
      type: ApiErrorResponseDto,
      example: {
        statusCode: 409,
        message: 'Cannot delete current session device. Please logout first.',
        error: 'Conflict',
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/devices/507f1f77bcf86cd799439011'
      }
    })
  );
}

/**
 * Deactivate Device endpoint documentation
 */
export function DeactivateDeviceApiDocs() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Deactivate device',
      description: `
## Deactivate Device

Deactivate a device without deleting it.

### Business Rules:
- Only device owner can deactivate their devices
- Device remains in database but becomes inactive
- All associated tokens are invalidated
- Device can be reactivated later

### Security Features:
- JWT authentication required
- Ownership validation
- Token invalidation
- Audit logging

### Response:
Returns confirmation of device deactivation.
      `,
    }),
    ApiParam({
      name: 'deviceId',
      description: 'Device unique identifier to deactivate',
      type: String,
      example: '507f1f77bcf86cd799439011'
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Device deactivated successfully',
      example: {
        message: 'Device deactivated successfully',
        deviceId: '507f1f77bcf86cd799439011'
      }
    }),
    ApiResponse(deviceErrorResponses.unauthorized),
    ApiResponse(deviceErrorResponses.notFound)
  );
}

/**
 * Get Current Device endpoint documentation
 */
export function GetCurrentDeviceApiDocs() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get current device information',
      description: `
## Get Current Device

Get information about the device used for current session.

### Business Rules:
- Returns device information for current JWT token
- Includes current session metadata
- Shows device activity and status

### Security Features:
- JWT authentication required
- Returns only current session device
- Activity tracking included

### Response:
Returns current device information with session details.
      `,
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Current device information retrieved successfully',
      type: DeviceInfoResponseDto,
      example: {
        id: '507f1f77bcf86cd799439011',
        deviceId: 'mobile_device_12345',
        deviceName: 'iPhone 15 Pro',
        deviceType: 'mobile',
        platform: 'ios',
        appVersion: '1.2.3',
        isActive: true,
        isCurrent: true,
        lastActiveAt: '2024-01-15T10:30:00.000Z',
        createdAt: '2024-01-10T08:00:00.000Z'
      }
    }),
    ApiResponse(deviceErrorResponses.unauthorized)
  );
}
