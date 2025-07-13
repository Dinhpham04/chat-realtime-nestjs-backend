import { UserCore, UserDocument } from "../schemas";
import { FindUsersParams, FindUsersResponse } from "../types/user.types";

export interface IUsersRepository {
  // Basic CRUD 
  create(userData: Partial<UserCore>): Promise<UserDocument>;
  findById(id: string): Promise<UserDocument | null>;
  findByEmail(email: string): Promise<UserDocument | null>;
  updateById(id: string, updateData: Partial<UserCore>): Promise<UserDocument | null>;
  softDelete(id: string): Promise<boolean>;

  // Search and pagination 
  findWithPagination(params: FindUsersParams): Promise<FindUsersResponse>;
  searchUsers(searchTerm: string, excludeIds?: string[], limit?: number): Promise<UserDocument[]>;

  // Friend management
  addFriend(userId: string, friendId: string): Promise<boolean>;
  removeFriend(userId: string, friendId: string): Promise<boolean>;
  areFriends(userId1: string, userId2: string): Promise<boolean>;
  getFriendsWithDetails(userId: string): Promise<UserDocument[]>;

  // Status management
  updateOnlineStatus(id: string, isOnline: boolean): Promise<UserDocument | null>;
  updateRefreshToken(id: string, refreshToken: string | null): Promise<UserDocument | null>;

  // Block functionality
  blockUser(userId: string, blockedUserId: string): Promise<boolean>;
  unblockUser(userId: string, blockedUserId: string): Promise<boolean>;

  // Analytics
  getCountByStatus(): Promise<{ [key: string]: number }>; // example: { active: 10, inactive: 5, banned: 2 }
}