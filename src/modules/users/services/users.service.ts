/**
 * Users Service Implementation
 * 
 * 🎯 Purpose: Core business logic for user operations
 * 📱 Mobile-First: Optimized for mobile messaging apps
 * 🏗️ Clean Architecture: Service layer implementation
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { IUsersService } from './interfaces';
import { IUsersRepository } from '../interfaces/users-repository.interface';
import { Types } from 'mongoose';

@Injectable()
export class UsersService implements IUsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject('IUsersRepository')
    private readonly usersRepository: IUsersRepository,
  ) { }

  /**
   * Find user by ID with basic profile info
   * 
   * 🎯 Purpose: Get user data for conversations, contacts, etc.
   * 📱 Optimized: Returns only essential fields for mobile apps
   */
  async findById(userId: string): Promise<{
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
    isOnline?: boolean;
    lastSeen?: Date;
  } | null> {
    this.logger.log(`Finding user by ID: ${userId}`);

    try {
      // Validate ObjectId format
      if (!Types.ObjectId.isValid(userId)) {
        this.logger.warn(`Invalid user ID format: ${userId}`);
        return null;
      }

      const user = await this.usersRepository.findById(userId);

      if (!user) {
        this.logger.log(`User not found: ${userId}`);
        return null;
      }

      // Transform to interface format
      const result = {
        id: user._id?.toString() || user.id,
        username: user.username || user.phoneNumber, // Fallback to phoneNumber if no username
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        isOnline: user.activityStatus === 'online', // From schema enum
        lastSeen: user.lastSeen, // Remove updatedAt fallback for now
      };

      this.logger.log(`User found: ${result.id} - ${result.fullName}`);
      return result;

    } catch (error) {
      this.logger.error(`Failed to find user by ID ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if user exists
   * 
   * 🎯 Purpose: Quick existence check for validations
   * 📱 Performance: Lightweight query for mobile apps
   */
  async exists(userId: string): Promise<boolean> {
    this.logger.log(`Checking if user exists: ${userId}`);

    try {
      // Validate ObjectId format
      if (!Types.ObjectId.isValid(userId)) {
        this.logger.warn(`Invalid user ID format: ${userId}`);
        return false;
      }

      const user = await this.usersRepository.findById(userId);
      const exists = !!user;

      this.logger.log(`User ${userId} exists: ${exists}`);
      return exists;

    } catch (error) {
      this.logger.error(`Failed to check user existence ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get users by IDs (for bulk operations)
   * 
   * 🎯 Purpose: Bulk fetch for participant lists, friend lists, etc.
   * 📱 Optimized: Single query for multiple users
   */
  async findByIds(userIds: string[]): Promise<Array<{
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
    isOnline?: boolean;
    lastSeen?: Date;
  }>> {
    this.logger.log(`Finding users by IDs: ${userIds.length} users`);

    try {
      // Filter valid ObjectIds
      const validIds = userIds.filter(id => Types.ObjectId.isValid(id));

      if (validIds.length === 0) {
        this.logger.warn(`No valid user IDs provided: ${JSON.stringify(userIds)}`);
        return [];
      }

      const users = await this.usersRepository.findByIds(validIds);

      // Transform to interface format
      const results = users.map(user => ({
        id: user._id?.toString() || user.id,
        username: user.username || user.phoneNumber, // Fallback to phoneNumber
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        isOnline: user.activityStatus === 'online', // From schema enum
        lastSeen: user.lastSeen, // Remove updatedAt fallback for now
      }));

      this.logger.log(`Found ${results.length} users out of ${validIds.length} requested`);
      return results;

    } catch (error) {
      this.logger.error(`Failed to find users by IDs: ${error.message}`);
      throw error;
    }
  }
}