import { IsString, IsNotEmpty, MaxLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DeviceType, Platform } from '../../../shared/enums/device.enums';

/**
 * Device Information Data Transfer Object
 * Used for device registration and tracking across authentication flows
 * 
 * @example
 * {
 *   "deviceId": "device-uuid-12345",
 *   "deviceName": "iPhone 14 Pro",
 *   "deviceType": "mobile",
 *   "platform": "ios",
 *   "appVersion": "1.0.0"
 * }
 */
export class DeviceInfoDto {
  @ApiProperty({
    description: 'Unique device identifier (UUID recommended)',
    example: 'device-uuid-12345',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty({ message: 'Device ID is required' })
  @MaxLength(255, { message: 'Device ID must not exceed 255 characters' })
  deviceId: string;

  @ApiProperty({
    description: 'Human-readable device name',
    example: 'iPhone 14 Pro',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: 'Device name is required' })
  @MaxLength(100, { message: 'Device name must not exceed 100 characters' })
  deviceName: string;

  @ApiProperty({
    description: 'Type of device',
    example: 'mobile',
    enum: DeviceType,
  })
  @IsEnum(DeviceType, { message: 'Device type must be mobile, web, desktop, or tablet' })
  deviceType: DeviceType;

  @ApiProperty({
    description: 'Device platform/operating system',
    example: 'ios',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty({ message: 'Platform is required' })
  @MaxLength(50, { message: 'Platform must not exceed 50 characters' })
  platform: string;

  @ApiProperty({
    description: 'Application version',
    example: '1.0.0',
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty({ message: 'App version is required' })
  @MaxLength(20, { message: 'App version must not exceed 20 characters' })
  appVersion: string;

  @ApiProperty({
    description: 'Browser user agent string (optional for web devices)',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'User agent must not exceed 500 characters' })
  userAgent?: string;

  @ApiProperty({
    description: 'Push notification token for mobile devices (optional)',
    example: 'fGHj7k8l9m0n1o2p3q4r5s6t7u8v9w0x',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Push token must not exceed 255 characters' })
  pushToken?: string;
}
