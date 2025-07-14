import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiConsumes, ApiProduces, ApiOperation, ApiBody, ApiResponse, ApiParam } from '@nestjs/swagger';

import { DeviceService } from '../services/device.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { DeviceInfoDto } from '../dto/device-info.dto';
import { DeviceInfo } from '../interfaces/auth.interfaces';
import {
  GetAllDevicesApiDocs,
  GetDeviceByIdApiDocs,
  RegisterDeviceApiDocs,
  UpdateDeviceApiDocs,
  DeleteDeviceApiDocs,
  DeactivateDeviceApiDocs,
  GetCurrentDeviceApiDocs,
} from '../documentation/device.swagger';
import { ApiErrorResponseDto, DeviceInfoResponseDto } from '../dto/response.dto';

/**
 * Device Management Controller
 * 
 * Following instruction-senior.md:
 * - Complete API documentation with OpenAPI/Swagger
 * - One controller per main domain/route
 * - Security-first approach with JWT authentication
 * - Error handling with proper status codes
 */
@ApiTags('Devices')
@Controller('devices')
@UseGuards(JwtAuthGuard)
@ApiConsumes('application/json')
@ApiProduces('application/json')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) { }

  /**
   * Get all user devices
   */
  @Get()
  @GetAllDevicesApiDocs()
  async getUserDevices(@CurrentUser() user: any) {
    return this.deviceService.getUserDevices(user.userId);
  }

  /**
   * Get specific device by ID
   */
  @Get(':deviceId')
  @GetDeviceByIdApiDocs()
  async getDevice(
    @CurrentUser() user: any,
    @Param('deviceId') deviceId: string,
  ) {
    return this.deviceService.getDevice(user.userId, deviceId);
  }

  /**
   * Register or update device
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register or update device',
    description: `
## Device Registration

Register a new device or update an existing device for the current user.

### Business Rules:
- Maximum 5 devices per user
- Oldest device automatically removed when limit exceeded
- Existing devices are updated with new push tokens
- Device ID must be unique per user

### Validation Rules:
- Device ID: minimum 10 characters
- Device name: maximum 100 characters  
- Device type: mobile, web, or desktop
- Platform: ios, android, web, windows, macos
    `,
  })
  @ApiBody({
    type: DeviceInfoDto,
    description: 'Device information to register',
    examples: {
      'iOS Device': {
        summary: 'iPhone registration',
        value: {
          deviceId: 'mobile_device_12345',
          deviceName: 'iPhone 15 Pro',
          deviceType: 'mobile',
          platform: 'ios',
          pushToken: 'expo_push_token_xyz789'
        }
      },
      'Web Device': {
        summary: 'Web browser registration',
        value: {
          deviceId: 'web_device_67890',
          deviceName: 'Chrome Browser',
          deviceType: 'web',
          platform: 'web'
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Device registered or updated successfully',
    type: DeviceInfoResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid device information',
    type: ApiErrorResponseDto,
  })
  async registerDevice(
    @CurrentUser() user: any,
    @Body() deviceInfoDto: DeviceInfoDto,
  ) {
    // Convert DTO to DeviceInfo interface with proper typing
    const deviceInfo: DeviceInfo = {
      deviceId: deviceInfoDto.deviceId,
      deviceName: deviceInfoDto.deviceName,
      deviceType: deviceInfoDto.deviceType as 'mobile' | 'web' | 'desktop',
      platform: deviceInfoDto.platform,
      appVersion: deviceInfoDto.appVersion,
      userAgent: deviceInfoDto.userAgent,
      pushToken: deviceInfoDto.pushToken,
      lastLoginAt: new Date(),
      isActive: true,
    };
    return this.deviceService.registerDevice(user.userId, deviceInfo);
  }

  /**
   * Remove device
   */
  @Delete(':deviceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove device',
    description: `
## Remove Device

Deactivate a specific device for the current user.

### Effects:
- Device is marked as inactive (soft delete)
- User is logged out from that device
- Push notifications are disabled
- Device cannot be used for authentication

### Security:
- Audit logging for device removal
- Current device session is terminated
    `,
  })
  @ApiParam({
    name: 'deviceId',
    description: 'Device ID to remove',
    example: 'mobile_device_12345',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Device removed successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Device not found or already inactive',
    type: ApiErrorResponseDto,
  })
  async removeDevice(
    @CurrentUser() user: any,
    @Param('deviceId') deviceId: string,
  ) {
    return this.deviceService.removeDevice(user.userId, deviceId);
  }

  /**
   * Remove all devices
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove all devices',
    description: `
## Remove All Devices

Deactivate all devices for the current user (logout from all devices).

### Effects:
- All user devices are marked as inactive
- User is logged out from all sessions
- All push notifications are disabled
- Forces user to re-authenticate on all devices

### Use Cases:
- Security incident response
- Account compromise recovery
- User-initiated logout from all devices
    `,
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'All devices removed successfully',
  })
  async removeAllDevices(@CurrentUser() user: any) {
    return this.deviceService.removeAllDevices(user.userId);
  }

  /**
   * Get devices by platform
   */
  @Get('platform/:platform')
  @ApiOperation({
    summary: 'Get devices by platform',
    description: 'Retrieve all active devices for a specific platform',
  })
  @ApiParam({
    name: 'platform',
    description: 'Device platform',
    enum: ['ios', 'android', 'web', 'windows', 'macos'],
    example: 'ios',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Platform devices retrieved successfully',
    type: [DeviceInfoResponseDto],
  })
  async getDevicesByPlatform(
    @CurrentUser() user: any,
    @Param('platform') platform: string,
  ) {
    return this.deviceService.getDevicesByPlatform(user.userId, platform);
  }

  /**
   * Update device last active timestamp
   */
  @Post(':deviceId/heartbeat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update device heartbeat',
    description: `
## Device Heartbeat

Update the last active timestamp for a device.

### Purpose:
- Track device activity
- Maintain active session status
- Enable accurate "last seen" timestamps
- Support device cleanup policies
    `,
  })
  @ApiParam({
    name: 'deviceId',
    description: 'Device ID to update',
    example: 'mobile_device_12345',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Device heartbeat updated successfully',
    example: { message: 'Device activity updated', timestamp: '2024-01-15T10:30:00.000Z' }
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Device not found or inactive',
    type: ApiErrorResponseDto,
  })
  async updateDeviceHeartbeat(
    @CurrentUser() user: any,
    @Param('deviceId') deviceId: string,
  ) {
    await this.deviceService.updateDeviceLastActive(user.userId, deviceId);
    return {
      message: 'Device activity updated',
      timestamp: new Date().toISOString(),
    };
  }
}
