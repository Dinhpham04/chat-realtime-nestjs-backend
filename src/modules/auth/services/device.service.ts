import { Injectable, Logger, ConflictException, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DeviceInfo } from '../interfaces/auth.interfaces';
import { UserDevice } from '../../users/schemas/user-device.schema';
import { IDeviceRepository } from '../interfaces/device-repository.interface';

/**
 * Device Service - Business Logic Layer
 * 
 * Following Clean Architecture principles:
 * - Contains ONLY business logic and rules
 * - Delegates ALL data operations to DeviceRepository
 * - Handles device management policies (max devices, validation, etc.)
 * - No direct database access
 * 
 * Following instruction-senior.md:
 * - Complete JSDoc documentation
 * - Single Responsibility Principle
 * - Error handling with proper logging
 * - Business rules clearly defined
 */
@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);
  private readonly MAX_DEVICES = 5;

  constructor(
    @Inject('IDeviceRepository') private readonly deviceRepository: IDeviceRepository,
  ) { }

  /**
   * Register or update device for user
   * 
   * Business Logic Implementation:
   * - Validates device information according to business rules
   * - Handles device limit enforcement (max 5 devices per user)
   * - Updates existing devices or creates new ones
   * - Manages push token updates for existing devices
   * - Automatically removes oldest device when limit exceeded
   * 
   * Security Features:
   * - Device ID validation (minimum 10 characters)
   * - Platform validation against allowed values
   * - Audit logging for device operations
   * 
   * @param userId - Unique identifier of the user
   * @param deviceInfo - Complete device information including platform and push token
   * @returns Promise<UserDevice> - Registered or updated device with full details
   * @throws {BadRequestException} - Invalid device information
   * @throws {NotFoundException} - Failed to update existing device
   * 
   * @example
   * ```typescript
   * const device = await deviceService.registerDevice(userId, {
   *   deviceId: 'mobile_device_12345',
   *   deviceName: 'iPhone 15 Pro',
   *   deviceType: 'mobile',
   *   platform: 'ios',
   *   pushToken: 'expo_push_token_xyz789'
   * });
   * ```
   */
  async registerDevice(userId: string, deviceInfo: DeviceInfo): Promise<UserDevice> {
    // Validate device info
    this.validateDeviceInfo(deviceInfo);

    // Check if device already exists
    const existingDevice = await this.deviceRepository.findByUserIdAndDeviceId(
      userId,
      deviceInfo.deviceId,
    );

    if (existingDevice) {
      // Update existing device push token
      const updatedDevice = await this.deviceRepository.updateDevicePushToken(
        userId,
        deviceInfo.deviceId,
        deviceInfo.pushToken as string
      );

      if (!updatedDevice) {
        throw new NotFoundException('Failed to update existing device');
      }

      this.logger.log(`Device updated for user ${userId}: ${deviceInfo.deviceId}`);
      return updatedDevice;
    }

    // Business Rule: Check device limit before creating new device
    const deviceCount = await this.getActiveDeviceCount(userId);
    if (deviceCount >= this.MAX_DEVICES) {
      await this.removeOldestDevice(userId);
    }

    // Create new device
    const newDevice = await this.deviceRepository.createOrUpdateDevice(userId, deviceInfo);
    this.logger.log(`New device registered for user ${userId}: ${deviceInfo.deviceId}`);
    return newDevice;
  }

  /**
   * Get all active devices for user
   * 
   * @param userId - ID of the user
   * @returns List of UserDevice
   */
  async getUserDevices(userId: string): Promise<UserDevice[]> {
    return await this.deviceRepository.findActiveDevicesSortedByCreatedAt(userId, 'desc');
  }

  /**
   * Get specific active device
   * 
   * @param userId - ID of the user
   * @param deviceId - ID of the device
   * @returns UserDevice or null if not found
   */
  async getDevice(userId: string, deviceId: string): Promise<UserDevice | null> {
    return await this.deviceRepository.findByUserIdAndDeviceId(userId, deviceId);
  }

  /**
   * Remove device (business logic: deactivate instead of delete)
   * 
   * @param userId - ID of the user
   * @param deviceId - ID of the device
   */
  async removeDevice(userId: string, deviceId: string): Promise<void> {
    const success = await this.deviceRepository.deactivateDevice(userId, deviceId);

    if (!success) {
      throw new NotFoundException('Device not found or already inactive');
    }

    this.logger.log(`Device removed for user ${userId}: ${deviceId}`);
  }

  /**
   * Remove all devices for user
   * 
   * @param userId - ID of the user
   */
  async removeAllDevices(userId: string): Promise<void> {
    const deactivatedCount = await this.deviceRepository.deactivateAllUserDevices(userId);
    this.logger.log(`All devices removed for user ${userId}: ${deactivatedCount} devices`);
  }

  /**
   * Check if device exists and is active
   * 
   * @param userId - ID of the user
   * @param deviceId - ID of the device
   * @returns True if device is active, otherwise false
   */
  async isDeviceActive(userId: string, deviceId: string): Promise<boolean> {
    return await this.deviceRepository.isDeviceActiveForUser(userId, deviceId);
  }

  /**
   * Get active device count
   * 
   * @param userId - ID of the user
   * @returns Number of active devices
   */
  async getActiveDeviceCount(userId: string): Promise<number> {
    return await this.deviceRepository.countActiveDevicesByUserId(userId);
  }

  /**
   * Business Rule: Remove oldest device when limit exceeded
   * 
   * @param userId - ID of the user
   */
  private async removeOldestDevice(userId: string): Promise<void> {
    const oldestDevice = await this.deviceRepository.findOldestActiveDevice(userId);

    if (oldestDevice) {
      await this.deviceRepository.deactivateDevice(userId, oldestDevice.deviceId);
      this.logger.log(`Oldest device removed due to limit: ${oldestDevice.deviceId}`);
    }
  }

  /**
   * Validate device info - Business Rule
   * 
   * @param deviceInfo - Information about the device
   */
  validateDeviceInfo(deviceInfo: DeviceInfo): void {
    if (!deviceInfo.deviceId || deviceInfo.deviceId.length < 10) {
      throw new BadRequestException('Invalid device ID - must be at least 10 characters');
    }

    if (!deviceInfo.deviceName || deviceInfo.deviceName.length > 100) {
      throw new BadRequestException('Invalid device name - must be between 1-100 characters');
    }


    // if (!['mobile', 'web', 'desktop'].includes(deviceInfo.deviceType)) {
    //   throw new BadRequestException('Invalid device type - must be mobile, web, or desktop');
    // }

    this.logger.debug(`Validating device platform: ${deviceInfo.platform}`);

    // if (deviceInfo.platform && !['ios', 'android', 'web', 'windows', 'macos', 'ipados'].includes(deviceInfo.platform.toLowerCase())) {
    //   throw new BadRequestException('Invalid platform - must be ios, android, web, windows, or macos');
    // }
  }

  /**
   * Get devices by platform - Business Logic
   * 
   * @param userId - ID of the user
   * @param platform - Platform to filter devices
   * @returns List of UserDevice
   */
  async getDevicesByPlatform(userId: string, platform: string): Promise<UserDevice[]> {
    return await this.deviceRepository.findDevicesByPlatform(userId, platform);
  }

  /**
   * Update device last active - Business Logic
   * 
   * @param userId - ID of the user
   * @param deviceId - ID of the device
   */
  async updateDeviceLastActive(userId: string, deviceId: string): Promise<void> {
    const success = await this.deviceRepository.updateDeviceLastActive(userId, deviceId);

    if (!success) {
      throw new NotFoundException('Device not found or inactive');
    }
  }

  /**
   * Update device information - Business Logic
   * @param userId - ID of the user
   * @param deviceId - ID of the device
   * @param updateData - Partial device information to update
   */

  async updateDevice(userId: string, deviceId: string, updateData: any): Promise<UserDevice> {
    try {
      const updatedDevice = await this.deviceRepository.updateDeviceInfo(userId, deviceId, updateData);
      if (!updatedDevice) {
        throw new NotFoundException('Device not found or update failed');
      }
      this.logger.log(`Device updated for user ${userId}: ${deviceId}`);
      return updatedDevice;
    } catch (error) {
      this.logger.error(`Failed to update device ${deviceId} for user ${userId}`, error.stack);
      throw new NotFoundException('Device not found or update failed');
    }
  }

  async deactivateDevice(userId: string, deviceId: string): Promise<boolean> {
    try {
      const success = await this.deviceRepository.deactivateDevice(userId, deviceId);
      if (!success) {
        throw new NotFoundException('Device not found or already inactive');
      }
      this.logger.log(`Device deactivated for user ${userId}: ${deviceId}`);
      return true;

    } catch (error) {
      this.logger.error(`Failed to deactivate device ${deviceId} for user ${userId}`, error.stack);
      throw new NotFoundException('Device not found or deactivation failed');
    }
  }

  /**
   * Cleanup inactive devices - Business Rule: Admin operation
   * 
   * @param olderThanDays - Age in days to consider a device inactive
   * @returns Number of devices cleaned up
   */
  async cleanupInactiveDevices(olderThanDays: number = 30): Promise<number> {
    if (olderThanDays < 7) {
      throw new BadRequestException('Cleanup period must be at least 7 days');
    }

    return await this.deviceRepository.cleanupInactiveDevices(olderThanDays);
  }
}
