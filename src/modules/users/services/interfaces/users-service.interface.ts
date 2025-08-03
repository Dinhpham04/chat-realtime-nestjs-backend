/**
 * Users Service Interface
 * 
 * 🎯 Purpose: Define contract for user-related operations
 * 📱 Domain: Users module - owns user business logic
 * 🏗️ Architecture: Interface in Users domain, imported by other modules
 */

import { UpdateProfileDto, UpdateAvatarDto, UpdateOnlineStatusDto, SearchUsersDto } from '../../dto';
import { UserDocument } from '../../schemas';

export interface IUsersService {
  /**
   * Find user by ID with basic profile info
   */
  findById(userId: string): Promise<{
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
    isOnline?: boolean;
    lastSeen?: Date;
  } | null>;

  /**
   * Check if user exists
   */
  exists(userId: string): Promise<boolean>;

  /**
   * Get users by IDs (for bulk operations)
   */
  findByIds(userIds: string[]): Promise<Array<{
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
    isOnline?: boolean;
    lastSeen?: Date;
  }>>;

  // Profile Management Methods

  /**
   * Get complete user profile
   */
  getProfile(userId: string): Promise<UserDocument | null>;

  /**
   * Get public profile (respects privacy settings)
   */
  getPublicProfile(userId: string, viewerId?: string): Promise<Partial<UserDocument> | null>;

  /**
   * Update user profile
   */
  updateProfile(userId: string, updateData: UpdateProfileDto): Promise<UserDocument | null>;

  /**
   * Update user avatar
   */
  updateAvatar(userId: string, avatarData: UpdateAvatarDto): Promise<UserDocument | null>;

  /**
   * Remove user avatar
   */
  removeAvatar(userId: string): Promise<UserDocument | null>;

  /**
   * Update online status
   */
  updateOnlineStatus(userId: string, statusData: UpdateOnlineStatusDto): Promise<UserDocument | null>;

  /**
   * Search users with advanced filters
   */
  searchUsers(searchData: SearchUsersDto): Promise<{
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
  }>;
}
