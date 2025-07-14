import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserDevice } from '../../users/schemas';
import { DeviceInfo } from '../interfaces/auth.interfaces';
import { IDeviceRepository } from '../interfaces/device-repository.interface';

/**
 * Device Repository Implementation
 * 
 * Handles ALL device data persistence operations:
 * - CRUD operations for UserDevice
 * - Device queries and filtering
 * - Bulk operations
 * 
 * Following Clean Architecture:
 * - No business logic, only data access
 * - All database operations centralized here
 * - Service layer delegates all data operations to this repository
 */
@Injectable()
export class DeviceRepository implements IDeviceRepository {
  private readonly logger = new Logger(DeviceRepository.name);

  constructor(
    @InjectModel(UserDevice.name) private readonly deviceModel: Model<UserDevice>
  ) { }


  async updateDeviceInfo(userId: string, deviceId: string, deviceInfo: Partial<DeviceInfo>): Promise<UserDevice> {
    try {
      if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(deviceId)) {
        throw new NotFoundException('Invalid user ID or device ID');
      }

      const device = await this.deviceModel.findOneAndUpdate(
        { userId: new Types.ObjectId(userId), deviceId, isActive: true },
        { ...deviceInfo, updatedAt: new Date() },
        { new: true }
      ).exec();

      if (!device) {
        throw new NotFoundException('Active device not found');
      }

      this.logger.log(`Device info updated for user ${userId} and device ${deviceId}`);
      return device;
    } catch (error) {
      this.logger.error(`Failed to update device info for user ${userId} and device ${deviceId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Core CRUD operations
  async create(deviceData: Partial<UserDevice>): Promise<UserDevice> {
    try {
      const device = new this.deviceModel({
        ...deviceData,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      const savedDevice = await device.save();
      this.logger.log(`Device created with ID: ${savedDevice._id}`);
      return savedDevice;
    } catch (error) {
      this.logger.error(`Failed to create device: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findById(deviceId: string): Promise<UserDevice | null> {
    try {
      if (!Types.ObjectId.isValid(deviceId)) {
        return null;
      }
      return await this.deviceModel.findById(deviceId).exec();
    } catch (error) {
      this.logger.error(`Failed to find device by ID ${deviceId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<UserDevice[]> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return [];
      }
      return await this.deviceModel.find({ userId }).exec();
    } catch (error) {
      this.logger.error(`Failed to find devices for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findByUserIdAndDeviceId(userId: string, deviceId: string): Promise<UserDevice | null> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return null;
      }
      return await this.deviceModel.findOne({
        userId: new Types.ObjectId(userId),
        deviceId: deviceId
      }).exec();
    } catch (error) {
      this.logger.error(`Failed to find device ${deviceId} for user ${userId}`, error.stack);
      throw error;
    }
  }

  async updateById(deviceId: string, updateData: Partial<UserDevice>): Promise<UserDevice | null> {
    try {
      if (!Types.ObjectId.isValid(deviceId)) {
        return null;
      }
      return await this.deviceModel.findByIdAndUpdate(
        deviceId,
        { ...updateData, updatedAt: new Date() },
        { new: true }
      ).exec();
    } catch (error) {
      this.logger.error(`Failed to update device ${deviceId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async softDelete(deviceId: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(deviceId)) {
        return false;
      }
      const result = await this.deviceModel.findByIdAndUpdate(
        deviceId,
        { isActive: false, updatedAt: new Date() },
        { new: true }
      ).exec();
      return !!result;
    } catch (error) {
      this.logger.error(`Failed to soft delete device ${deviceId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Device-specific queries
  async findActiveDevicesByUserId(userId: string): Promise<UserDevice[]> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return [];
      }
      return await this.deviceModel.find({
        userId: new Types.ObjectId(userId),
        isActive: true
      }).exec();
    } catch (error) {
      this.logger.error(`Failed to find active devices for user ${userId}`, error.stack);
      throw error;
    }
  }

  async findActiveDevicesSortedByCreatedAt(userId: string, sortOrder: 'asc' | 'desc' = 'desc'): Promise<UserDevice[]> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return [];
      }
      const sortValue = sortOrder === 'asc' ? 1 : -1;
      return await this.deviceModel
        .find({ userId: new Types.ObjectId(userId), isActive: true })
        .sort({ createdAt: sortValue })
        .exec();
    } catch (error) {
      this.logger.error(`Failed to find sorted active devices for user ${userId}`, error.stack);
      throw error;
    }
  }

  async countActiveDevicesByUserId(userId: string): Promise<number> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return 0;
      }
      return await this.deviceModel.countDocuments({
        userId: new Types.ObjectId(userId),
        isActive: true
      }).exec();
    } catch (error) {
      this.logger.error(`Failed to count active devices for user ${userId}`, error.stack);
      throw error;
    }
  }

  // Device management operations
  async deactivateDevice(userId: string, deviceId: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return false;
      }
      const result = await this.deviceModel.updateOne(
        { userId: new Types.ObjectId(userId), deviceId },
        { isActive: false, updatedAt: new Date() }
      ).exec();

      if (result.matchedCount === 0) {
        throw new NotFoundException('Device not found');
      }

      const success = result.modifiedCount > 0;
      if (success) {
        this.logger.log(`Device deactivated for user ${userId}: ${deviceId}`);
      }
      return success;
    } catch (error) {
      this.logger.error(`Failed to deactivate device ${deviceId} for user ${userId}`, error.stack);
      throw error;
    }
  }

  async deactivateAllUserDevices(userId: string): Promise<number> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return 0;
      }
      const result = await this.deviceModel.updateMany(
        { userId: new Types.ObjectId(userId), isActive: true },
        { isActive: false, updatedAt: new Date() }
      ).exec();

      if (result.modifiedCount > 0) {
        this.logger.log(`All devices deactivated for user ${userId}: ${result.modifiedCount} devices`);
      }
      return result.modifiedCount;
    } catch (error) {
      this.logger.error(`Failed to deactivate all devices for user ${userId}`, error.stack);
      throw error;
    }
  }

  async updateDevicePushToken(userId: string, deviceId: string, pushToken: string): Promise<UserDevice | null> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return null;
      }
      const device = await this.deviceModel.findOneAndUpdate(
        { userId: new Types.ObjectId(userId), deviceId, isActive: true },
        { pushToken, updatedAt: new Date() },
        { new: true }
      ).exec();

      if (!device) {
        throw new NotFoundException('Active device not found');
      }

      this.logger.log(`Push token updated for device ${deviceId} of user ${userId}`);
      return device;
    } catch (error) {
      this.logger.error(`Failed to update push token for device ${deviceId} of user ${userId}`, error.stack);
      throw error;
    }
  }

  async updateDeviceLastActive(userId: string, deviceId: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return false;
      }
      const result = await this.deviceModel.updateOne(
        { userId: new Types.ObjectId(userId), deviceId, isActive: true },
        { lastActiveAt: new Date(), updatedAt: new Date() }
      ).exec();

      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to update last active for device ${deviceId} of user ${userId}`, error.stack);
      throw error;
    }
  }

  // Advanced queries for device management
  async findOldestActiveDevice(userId: string): Promise<UserDevice | null> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return null;
      }
      return await this.deviceModel
        .findOne({ userId: new Types.ObjectId(userId), isActive: true })
        .sort({ createdAt: 1 })
        .exec();
    } catch (error) {
      this.logger.error(`Failed to find oldest active device for user ${userId}`, error.stack);
      throw error;
    }
  }

  async isDeviceActiveForUser(userId: string, deviceId: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return false;
      }
      const device = await this.deviceModel.findOne({
        userId: new Types.ObjectId(userId),
        deviceId,
        isActive: true
      }).exec();

      return !!device;
    } catch (error) {
      this.logger.error(`Failed to check if device ${deviceId} is active for user ${userId}`, error.stack);
      throw error;
    }
  }

  async findDevicesByPlatform(userId: string, platform: string): Promise<UserDevice[]> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return [];
      }
      return await this.deviceModel.find({
        userId: new Types.ObjectId(userId),
        platform,
        isActive: true
      }).exec();
    } catch (error) {
      this.logger.error(`Failed to find devices by platform ${platform} for user ${userId}`, error.stack);
      throw error;
    }
  }

  // Bulk operations
  async createOrUpdateDevice(userId: string, deviceInfo: DeviceInfo): Promise<UserDevice> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID');
      }

      const filter = { userId: new Types.ObjectId(userId), deviceId: deviceInfo.deviceId };
      const update = {
        userId: new Types.ObjectId(userId),
        deviceId: deviceInfo.deviceId,
        platform: this.mapToPlatform(deviceInfo.platform),
        pushToken: deviceInfo.pushToken,
        pushProvider: this.mapToPushProvider(deviceInfo.platform),
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        isActive: true,
        lastActiveAt: new Date(),
        updatedAt: new Date()
      };

      const device = await this.deviceModel.findOneAndUpdate(
        filter,
        update,
        { new: true, upsert: true }
      ).exec();

      this.logger.log(`Device created/updated for user ${userId}: ${deviceInfo.deviceId}`);
      return device;
    } catch (error) {
      this.logger.error(`Failed to create/update device for user ${userId}`, error.stack);
      throw error;
    }
  }

  async cleanupInactiveDevices(olderThanDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.deviceModel.deleteMany({
        isActive: false,
        updatedAt: { $lt: cutoffDate }
      }).exec();

      if (result.deletedCount > 0) {
        this.logger.log(`Cleaned up ${result.deletedCount} inactive devices older than ${olderThanDays} days`);
      }
      return result.deletedCount;
    } catch (error) {
      this.logger.error(`Failed to cleanup inactive devices: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Private helper methods
  private mapToPlatform(platform: string): string {
    const platformMap: Record<string, string> = {
      'ios': 'IOS',
      'android': 'ANDROID',
      'web': 'WEB',
      'windows': 'WINDOWS',
      'macos': 'MACOS',
    };
    return platformMap[platform.toLowerCase()] || 'OTHER';
  }

  private mapToPushProvider(platform: string): string {
    const providerMap: Record<string, string> = {
      'ios': 'APNS',
      'android': 'FCM',
      'web': 'FCM',
    };
    return providerMap[platform.toLowerCase()] || 'FCM';
  }
}