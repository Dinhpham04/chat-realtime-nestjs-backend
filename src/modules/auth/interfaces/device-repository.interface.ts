import { UserDevice } from "../../users/schemas";
import { DeviceInfo } from "./auth.interfaces";

/**
 * Device Repository Interface
 * 
 * Following Clean Architecture principles:
 * - Repository layer handles all device data persistence
 * - Service layer handles business logic only
 * - Clear separation of concerns between data access and business rules
 */
export interface IDeviceRepository {
  // Core CRUD operations
  create(deviceData: Partial<UserDevice>): Promise<UserDevice>;
  findById(deviceId: string): Promise<UserDevice | null>;
  findByUserId(userId: string): Promise<UserDevice[]>;
  findByUserIdAndDeviceId(userId: string, deviceId: string): Promise<UserDevice | null>;
  updateById(deviceId: string, updateData: Partial<UserDevice>): Promise<UserDevice | null>;
  softDelete(deviceId: string): Promise<boolean>;
  updateDeviceInfo(userId: string, deviceId: string, deviceInfo: Partial<DeviceInfo>): Promise<UserDevice>;

  // Device-specific queries
  findActiveDevicesByUserId(userId: string): Promise<UserDevice[]>;
  findActiveDevicesSortedByCreatedAt(userId: string, sortOrder?: 'asc' | 'desc'): Promise<UserDevice[]>;
  countActiveDevicesByUserId(userId: string): Promise<number>;

  // Device management operations
  deactivateDevice(userId: string, deviceId: string): Promise<boolean>;
  deactivateAllUserDevices(userId: string): Promise<number>;
  updateDevicePushToken(userId: string, deviceId: string, pushToken: string): Promise<UserDevice | null>;
  updateDeviceLastActive(userId: string, deviceId: string): Promise<boolean>;

  // Advanced queries for device management
  findOldestActiveDevice(userId: string): Promise<UserDevice | null>;
  isDeviceActiveForUser(userId: string, deviceId: string): Promise<boolean>;
  findDevicesByPlatform(userId: string, platform: string): Promise<UserDevice[]>;

  // Bulk operations
  createOrUpdateDevice(userId: string, deviceInfo: DeviceInfo): Promise<UserDevice>;
  cleanupInactiveDevices(olderThanDays: number): Promise<number>;
}