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
import {
  ApiTags,
  ApiConsumes,
  ApiProduces,
} from '@nestjs/swagger';
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

/**
 * Device Management Controller - Clean Architecture
 * 
 * Following instruction-senior.md:
 * - Complete API documentation with OpenAPI/Swagger
 * - One controller per main domain/route
 * - Security-first approach with JWT authentication
 * - Error handling with proper status codes
 * - Clean separation of documentation
 */
@ApiTags('Devices')
@Controller('devices')
@UseGuards(JwtAuthGuard)
@ApiConsumes('application/json')
@ApiProduces('application/json')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) { }

  /**
   * Get all user devices with pagination and filtering
   */
  @Get()
  @GetAllDevicesApiDocs()
  async getUserDevices(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string
  ) {
    return this.deviceService.getUserDevices(user.userId);
  }

  /**
   * Get current device information
   */
  @Get('current')
  @GetCurrentDeviceApiDocs()
  async getCurrentDevice(@CurrentUser() user: any) {
    return this.deviceService.getDevice(user.userId, user.deviceId);
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
   * Register new device
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RegisterDeviceApiDocs()
  async registerDevice(
    @CurrentUser() user: any,
    @Body() deviceInfo: DeviceInfoDto,
  ) {
    // Convert DTO to interface format
    const deviceData: DeviceInfo = {
      deviceId: deviceInfo.deviceId,
      deviceType: deviceInfo.deviceType as any,
      deviceName: deviceInfo.deviceName,
      platform: deviceInfo.platform,
      appVersion: deviceInfo.appVersion,
      pushToken: deviceInfo.pushToken,
      lastLoginAt: new Date(),
      isActive: true,
    };

    return this.deviceService.registerDevice(user.userId, deviceData);
  }

  /**
   * Update device information
   */
  @Post(':deviceId')
  @UpdateDeviceApiDocs()
  async updateDevice(
    @CurrentUser() user: any,
    @Param('deviceId') deviceId: string,
    @Body() updateData: Partial<DeviceInfoDto>,
  ) {
    return this.deviceService.updateDevice(user.userId, deviceId, updateData);
  }

  /**
   * Deactivate device (soft delete)
   */
  @Post(':deviceId/deactivate')
  @DeactivateDeviceApiDocs()
  async deactivateDevice(
    @CurrentUser() user: any,
    @Param('deviceId') deviceId: string,
  ) {
    return this.deviceService.deactivateDevice(user.userId, deviceId);
  }

  /**
   * Delete device permanently
   */
  @Delete(':deviceId')
  @DeleteDeviceApiDocs()
  async deleteDevice(
    @CurrentUser() user: any,
    @Param('deviceId') deviceId: string,
  ) {
    return this.deviceService.removeDevice(user.userId, deviceId);
  }
}
