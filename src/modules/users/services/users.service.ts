/**
 * Users Service Implementation
 * 
 * 🎯 Purpose: Core business logic for user operations
 * 📱 Mobile-First: Optimized for mobile messaging apps
 * 🏗️ Clean Architecture: Service layer implementation
 */

import { Injectable, Logger, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { IUsersService } from './interfaces';
import { IUsersRepository } from '../interfaces/users-repository.interface';
import { UpdateProfileDto, UpdateAvatarDto, UpdateOnlineStatusDto, SearchUsersDto } from '../dto';
import { UserDocument } from '../schemas';
import { UserStatus } from '../enums';
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

  /**
   * Get complete user profile
   * 
   * 🎯 Purpose: Get full profile for profile page
   * 📱 Optimized: Complete profile data for mobile apps
   */
  async getProfile(userId: string): Promise<UserDocument | null> {
    this.logger.log(`Getting complete profile for user: ${userId}`);

    try {
      if (!Types.ObjectId.isValid(userId)) {
        this.logger.warn(`Invalid user ID format: ${userId}`);
        return null;
      }

      const user = await this.usersRepository.findById(userId);

      if (!user) {
        this.logger.log(`User not found: ${userId}`);
        return null;
      }

      this.logger.log(`Profile retrieved for user: ${userId}`);
      return user;

    } catch (error) {
      this.logger.error(`Failed to get profile for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get public profile (respects privacy settings)
   * 
   * 🎯 Purpose: Get profile visible to other users
   * 📱 Security: Respect privacy settings
   */
  async getPublicProfile(userId: string, viewerId?: string): Promise<Partial<UserDocument> | null> {
    this.logger.log(`Getting public profile for user: ${userId}, viewer: ${viewerId}`);

    try {
      if (!Types.ObjectId.isValid(userId)) {
        this.logger.warn(`Invalid user ID format: ${userId}`);
        return null;
      }

      const user = await this.usersRepository.findById(userId);

      if (!user || user.status !== 'active') {
        this.logger.log(`User not found or inactive: ${userId}`);
        return null;
      }

      // For now, return basic public info
      // TODO: Implement privacy settings logic when privacy module is ready
      const publicProfile: Partial<UserDocument> & { createdAt?: Date } = {
        _id: user._id,
        fullName: user.fullName,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        activityStatus: user.activityStatus,
        lastSeen: user.lastSeen,
        status: user.status,
        createdAt: (user as any).createdAt
      };

      this.logger.log(`Public profile retrieved for user: ${userId}`);
      return publicProfile;

    } catch (error) {
      this.logger.error(`Failed to get public profile for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user profile
   * 
   * 🎯 Purpose: Update user profile information
   * 📱 Mobile-First: Handle mobile profile updates
   * 🛡️ Security: Validate input and check permissions
   */
  async updateProfile(userId: string, updateData: UpdateProfileDto): Promise<UserDocument | null> {
    this.logger.log(`Updating profile for user: ${userId}`);

    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID format');
      }

      // Check if user exists
      const existingUser = await this.usersRepository.findById(userId);
      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      // Check username uniqueness if provided
      if (updateData.username) {
        // Create a method to find by username - for now use email field
        const existingUsers = await this.usersRepository.searchUsers(updateData.username);
        const userWithUsername = existingUsers.find(u => u.username === updateData.username);
        if (userWithUsername && (userWithUsername as any)._id.toString() !== userId) {
          throw new BadRequestException('Username already taken');
        }
      }

      // Prepare update data
      const updatePayload: any = {};
      if (updateData.fullName !== undefined) updatePayload.fullName = updateData.fullName;
      if (updateData.bio !== undefined) updatePayload.bio = updateData.bio;
      if (updateData.dateOfBirth !== undefined) updatePayload.dateOfBirth = new Date(updateData.dateOfBirth);
      if (updateData.gender !== undefined) updatePayload.gender = updateData.gender;
      if (updateData.username !== undefined) updatePayload.username = updateData.username;

      const updatedUser = await this.usersRepository.updateById(userId, updatePayload);

      if (!updatedUser) {
        throw new BadRequestException('Failed to update profile');
      }

      this.logger.log(`Profile updated for user: ${userId}`);
      return updatedUser;

    } catch (error) {
      this.logger.error(`Failed to update profile for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user avatar
   * 
   * 🎯 Purpose: Update user avatar URL
   * 📱 Mobile-First: Handle avatar from file upload service
   */
  async updateAvatar(userId: string, avatarData: UpdateAvatarDto): Promise<UserDocument | null> {
    this.logger.log(`Updating avatar for user: ${userId}`);

    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID format');
      }

      const updatedUser = await this.usersRepository.updateById(userId, {
        avatarUrl: avatarData.avatarUrl
      });

      if (!updatedUser) {
        throw new NotFoundException('User not found');
      }

      this.logger.log(`Avatar updated for user: ${userId}`);
      return updatedUser;

    } catch (error) {
      this.logger.error(`Failed to update avatar for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove user avatar
   * 
   * 🎯 Purpose: Remove user avatar
   * 📱 Mobile-First: Reset to default avatar
   */
  async removeAvatar(userId: string): Promise<UserDocument | null> {
    this.logger.log(`Removing avatar for user: ${userId}`);

    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID format');
      }

      const updatedUser = await this.usersRepository.updateById(userId, {
        avatarUrl: undefined  // Remove avatar by setting to undefined
      });

      if (!updatedUser) {
        throw new NotFoundException('User not found');
      }

      this.logger.log(`Avatar removed for user: ${userId}`);
      return updatedUser;

    } catch (error) {
      this.logger.error(`Failed to remove avatar for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update online status
   * 
   * 🎯 Purpose: Update user activity status
   * 📱 Real-time: Handle app state changes
   */
  async updateOnlineStatus(userId: string, statusData: UpdateOnlineStatusDto): Promise<UserDocument | null> {
    this.logger.log(`Updating online status for user: ${userId} to ${statusData.activityStatus}`);

    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID format');
      }

      if (!statusData.activityStatus) {
        throw new BadRequestException('Activity status is required');
      }

      const isOnline = statusData.activityStatus === 'online';
      const updatedUser = await this.usersRepository.updateOnlineStatus(userId, isOnline);

      if (!updatedUser) {
        throw new NotFoundException('User not found');
      }

      this.logger.log(`Online status updated for user: ${userId}`);
      return updatedUser;

    } catch (error) {
      this.logger.error(`Failed to update online status for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search users with advanced filters
   * 
   * 🎯 Purpose: Advanced user search functionality
   * 📱 Mobile-First: Optimized for mobile search UI
   */
  async searchUsers(searchData: SearchUsersDto): Promise<{
    users: Array<{
      id: string;
      username?: string;
      fullName: string;
      avatarUrl?: string;
      activityStatus: string;
      lastSeen?: Date;
    }>;
    total: number;
    page: number;
    totalPages: number;
  }> {
    this.logger.log(`Searching users with query: ${searchData.query}`);

    try {
      const {
        query,
        status = UserStatus.ACTIVE,
        activityStatus,
        page = 1,
        limit = 10
      } = searchData;

      // Use existing repository method for pagination
      const result = await this.usersRepository.findWithPagination({
        page,
        limit,
        search: query,
        status,
        activityStatus
      });

      // Transform to search response format
      const searchResults = {
        users: result.users.map(user => ({
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl,
          activityStatus: user.activityStatus,
          lastSeen: user.lastSeen
        })),
        total: result.total,
        page: result.page,
        totalPages: result.totalPages
      };

      this.logger.log(`Found ${searchResults.users.length} users matching search criteria`);
      return searchResults;

    } catch (error) {
      this.logger.error(`Failed to search users: ${error.message}`);
      throw error;
    }
  }
}