/**
 * Users Service Interface
 * 
 * 🎯 Purpose: Define contract for user-related operations
 * 📱 Domain: Users module - owns user business logic
 * 🏗️ Architecture: Interface in Users domain, imported by other modules
 */

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
}
