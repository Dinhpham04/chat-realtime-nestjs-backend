import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IAuthRepository } from '../interfaces/auth-repository.interface';
import { UserSecurity, UserDevice } from '../../users/schemas';

/**
 * Authentication Repository Implementation
 * 
 * Handles ONLY authentication-specific data operations:
 * - User security settings
 * - Device management
 * - Session management
 * - Security logging
 * 
 * Following Clean Architecture:
 * - User data operations delegated to UsersRepository via dependency injection
 */
@Injectable()
export class AuthRepository implements IAuthRepository {
  private readonly logger = new Logger(AuthRepository.name);

  constructor(
    @InjectModel(UserSecurity.name) private userSecurityModel: Model<UserSecurity>,
    @InjectModel(UserDevice.name) private userDeviceModel: Model<UserDevice>,
  ) { }

  // User Security operations
  async findUserSecurityByUserId(userId: string): Promise<any | null> {
    try {
      return await this.userSecurityModel.findOne({ userId }).exec();
    } catch (error) {
      this.logger.error(`Failed to find user security for userId: ${userId}`, error.stack);
      throw error;
    }
  }

  async createUserSecurity(userId: string, securityData: Partial<UserSecurity>): Promise<any> {
    try {
      const newSecurity = new this.userSecurityModel({
        userId,
        ...securityData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return await newSecurity.save();
    } catch (error) {
      this.logger.error(`Failed to create user security for userId: ${userId}`, error.stack);
      throw error;
    }
  }

  async updateUserSecurity(userId: string, updateData: Partial<UserSecurity>): Promise<any | null> {
    try {
      return await this.userSecurityModel.findOneAndUpdate(
        { userId },
        { ...updateData, updatedAt: new Date() },
        { new: true }
      ).exec();
    } catch (error) {
      this.logger.error(`Failed to update user security for userId: ${userId}`, error.stack);
      throw error;
    }
  }

  async incrementFailedLoginAttempts(userId: string): Promise<void> {
    try {
      await this.userSecurityModel.findOneAndUpdate(
        { userId },
        {
          $inc: { failedLoginAttempts: 1 },
          $set: { lastFailedLogin: new Date(), updatedAt: new Date() }
        }
      ).exec();
    } catch (error) {
      this.logger.error(`Failed to increment failed login attempts for userId: ${userId}`, error.stack);
      throw error;
    }
  }

  async resetFailedLoginAttempts(userId: string): Promise<void> {
    try {
      await this.userSecurityModel.findOneAndUpdate(
        { userId },
        {
          $set: {
            failedLoginAttempts: 0,
            lastFailedLogin: null,
            updatedAt: new Date()
          }
        }
      ).exec();
    } catch (error) {
      this.logger.error(`Failed to reset failed login attempts for userId: ${userId}`, error.stack);
      throw error;
    }
  }

  async lockUserAccount(userId: string, lockUntil: Date): Promise<void> {
    try {
      await this.userSecurityModel.findOneAndUpdate(
        { userId },
        {
          $set: {
            accountLocked: true,
            lockUntil,
            updatedAt: new Date()
          }
        }
      ).exec();
    } catch (error) {
      this.logger.error(`Failed to lock user account for userId: ${userId}`, error.stack);
      throw error;
    }
  }

  async addSecurityLog(userId: string, logEntry: any): Promise<void> {
    try {
      await this.userSecurityModel.findOneAndUpdate(
        { userId },
        {
          $push: { securityLogs: logEntry },
          $set: { updatedAt: new Date() }
        }
      ).exec();
    } catch (error) {
      this.logger.error(`Failed to add security log for userId: ${userId}`, error.stack);
      throw error;
    }
  }

  // User Device operations
  async findActiveDevicesByUserId(userId: string): Promise<any[]> {
    try {
      return await this.userDeviceModel.find({
        userId,
        isActive: true
      }).exec();
    } catch (error) {
      this.logger.error(`Failed to find active devices for userId: ${userId}`, error.stack);
      throw error;
    }
  }

  async createOrUpdateUserDevice(userId: string, deviceData: Partial<UserDevice>): Promise<any> {
    try {
      const filter = { userId, deviceId: deviceData.deviceId };
      const update = {
        ...deviceData,
        userId,
        isActive: true,
        lastActiveAt: new Date(),
        updatedAt: new Date()
      };

      return await this.userDeviceModel.findOneAndUpdate(
        filter,
        update,
        { new: true, upsert: true }
      ).exec();
    } catch (error) {
      this.logger.error(`Failed to create/update device for userId: ${userId}`, error.stack);
      throw error;
    }
  }

  async deactivateDevice(userId: string, deviceId: string): Promise<void> {
    try {
      await this.userDeviceModel.findOneAndUpdate(
        { userId, deviceId },
        {
          $set: {
            isActive: false,
            deactivatedAt: new Date(),
            updatedAt: new Date()
          }
        }
      ).exec();
    } catch (error) {
      this.logger.error(`Failed to deactivate device ${deviceId} for userId: ${userId}`, error.stack);
      throw error;
    }
  }

  async deactivateAllDevices(userId: string): Promise<void> {
    try {
      await this.userDeviceModel.updateMany(
        { userId },
        {
          $set: {
            isActive: false,
            deactivatedAt: new Date(),
            updatedAt: new Date()
          }
        }
      ).exec();
    } catch (error) {
      this.logger.error(`Failed to deactivate all devices for userId: ${userId}`, error.stack);
      throw error;
    }
  }

  async countActiveDevices(userId: string): Promise<number> {
    try {
      return await this.userDeviceModel.countDocuments({
        userId,
        isActive: true
      }).exec();
    } catch (error) {
      this.logger.error(`Failed to count active devices for userId: ${userId}`, error.stack);
      throw error;
    }
  }

  // Authentication session operations
  async createSession(userId: string, sessionData: any): Promise<any> {
    try {
      // Implementation depends on your session storage strategy
      // Could be JWT in database, Redis, or in-memory
      this.logger.log(`Creating session for userId: ${userId}`);
      return sessionData; // Placeholder implementation
    } catch (error) {
      this.logger.error(`Failed to create session for userId: ${userId}`, error.stack);
      throw error;
    }
  }

  async findSessionByToken(token: string): Promise<any | null> {
    try {
      // Implementation depends on your session storage strategy
      this.logger.log(`Finding session by token: ${token.substring(0, 10)}...`);
      return null; // Placeholder implementation
    } catch (error) {
      this.logger.error(`Failed to find session by token`, error.stack);
      throw error;
    }
  }

  async invalidateSession(sessionId: string): Promise<void> {
    try {
      // Implementation depends on your session storage strategy
      this.logger.log(`Invalidating session: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate session: ${sessionId}`, error.stack);
      throw error;
    }
  }

  async invalidateAllUserSessions(userId: string): Promise<void> {
    try {
      // Implementation depends on your session storage strategy
      this.logger.log(`Invalidating all sessions for userId: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate all sessions for userId: ${userId}`, error.stack);
      throw error;
    }
  }
}
