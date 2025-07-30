import { Injectable, Logger } from '@nestjs/common';
// import { Injectable, Logger } from "@nestjs/common";
import { Model, Types, FilterQuery } from "mongoose";
import { UserCore, UserDocument } from "../schemas";
import { FindUsersParams, FindUsersResponse, UserCoreResponse } from '../types/user.types';
import { IUsersRepository } from "../interfaces/users-repository.interface";
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class UsersRepository implements IUsersRepository {
  private readonly logger = new Logger(UsersRepository.name);

  constructor(
    @InjectModel(UserCore.name) private readonly userModel: Model<UserDocument>
  ) { }

  async create(userData: Partial<UserCore>): Promise<UserDocument> {
    try {
      const user = new this.userModel(userData);
      const savedUser = await user.save();
      this.logger.log(`User created with ID: ${savedUser._id}`);
      return savedUser;
    } catch (error) {
      this.logger.error(`Failed to create user: ${error.message}`);
      throw error;
    }
  }

  async findById(id: string): Promise<UserDocument | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return null;
      }
      return await this.userModel.findById(id).exec(); // .exec() is used to return a promise
    } catch (error) {
      this.logger.error(`Failed to find user by ID ${id}: ${error.message}`);
      throw error;

    }
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    try {
      return await this.userModel
        .findOne({ email: email.toLowerCase() })
        .exec();
    } catch (error) {
      this.logger.error(`Failed to find user by email ${email}: ${error.message}`);
      throw error;
    }
  }

  async findByIds(ids: string[]): Promise<UserDocument[]> {
    try {
      // Filter valid ObjectIds
      const validIds = ids.filter(id => Types.ObjectId.isValid(id));

      if (validIds.length === 0) {
        return [];
      }

      const users = await this.userModel
        .find({ _id: { $in: validIds } })
        .select('-refreshToken -emailVerificationToken -passwordResetToken -passwordResetExpires') // Exclude sensitive fields
        .exec();

      this.logger.log(`Found ${users.length} users out of ${validIds.length} requested`);
      return users;
    } catch (error) {
      this.logger.error(`Failed to find users by IDs: ${error.message}`);
      throw error;
    }
  }

  async findByPhoneNumber(phoneNumber: string): Promise<UserDocument | null> {
    try {
      return await this.userModel
        .findOne({ phoneNumber: phoneNumber })
        .exec();
    } catch (error) {
      this.logger.error(`Failed to find user by phone number ${phoneNumber}: ${error.message}`);
      throw error;
    }
  }

  async updateById(id: string, updateData: Partial<UserCore>): Promise<UserDocument | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return null;
      }

      const updatedUser = await this.userModel
        .findByIdAndUpdate(
          id,
          { ...updateData, updatedAt: new Date() },
          { new: true, runValidators: true } // new: true returns the updated document
        ).exec();
      if (updatedUser) {
        this.logger.log(`User updated with ID: ${updatedUser._id}`);
      }
      return updatedUser;
    } catch (error) {
      this.logger.error(`Failed to update user by ID ${id}: ${error.message}`);
      throw error;
    }
  }

  async softDelete(id: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return false;
      }

      const result = await this.userModel
        .updateOne(
          { _id: id },
          {
            isDeleted: true,
            updatedAt: new Date()
          }
        ).exec();
      if (result.modifiedCount > 0) {
        this.logger.log(`User soft deleted with ID: ${id}`);
      }

      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to soft delete user by ID ${id}: ${error.message}`);
      throw error;
    }
  }

  async findWithPagination(params: FindUsersParams): Promise<FindUsersResponse> {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        status = 'active',
        activityStatus,
      } = params;

      const skip = (page - 1) * limit;

      // Build the filter query
      const filter: FilterQuery<UserDocument> = { status };

      // Add search filter (fuzzy search)
      if (search) {
        filter.$or = [
          { username: { $regex: search, $options: 'i' } },
          { fullName: { $regex: search, $options: 'i' } },
        ];
      }
      // $or: có nghĩa là ít nhất một trong các điều kiện phải đúng
      // $regex: dùng để tìm kiếm chuỗi theo mẫu
      // $options: 'i' có nghĩa là tìm kiếm không phân biệt chữ hoa chữ thường

      // Add online status filter
      if (activityStatus !== undefined) {
        filter.activityStatus = activityStatus;
      }

      // Execute the queries in paraller
      const [users, total] = await Promise.all([
        this.userModel
          .find(filter)
          .select('-refreshToken -emailVerificationToken -passwordResetToken -passwordResetExpires') // Exclude sensitive fields
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 })
          .exec(),
        this.userModel.countDocuments(filter).exec()
      ]);

      const mappedUsers: UserCoreResponse[] = users.map(user => ({
        id: <string>user._id,
        phoneNumber: user.phoneNumber,
        isPhoneVerified: user.isPhoneVerified,
        email: user?.email,
        username: user?.username,
        fullName: user.fullName,
        bio: user.bio,
        dateOfBirth: user.dateOfBirth,
        gender: user?.gender,
        avatarUrl: user.avatarUrl,
        status: user.status,
        activityStatus: user.activityStatus,
        lastSeen: user.lastSeen,
        friends: user.friends.map(f => f.toString()),
        isEmailVerified: user?.isEmailVerified,
        createdAt: (user as any).createdAt,
        updatedAt: (user as any).updatedAt
      }))

      this.logger.log(`Found ${users.length} users on page ${page} with limit ${limit}`);

      return {
        users: mappedUsers,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      }

    } catch (error) {
      this.logger.error(`Failed to find users with pagination: ${error.message}`);
      throw error;
    }
  }

  async searchUsers(searchTerm: string, excludeIds?: string[], limit?: number): Promise<UserDocument[]> {
    try {
      const filter: FilterQuery<UserDocument> = {
        status: 'active',
        $or: [
          { username: { $regex: searchTerm, $options: 'i' } },
          { fullName: { $regex: searchTerm, $options: 'i' } }
        ]
      };

      // Exclude specific user Ids
      if (excludeIds && excludeIds.length > 0) {
        const validIds = excludeIds.filter(id => Types.ObjectId.isValid(id));
        if (validIds.length > 0) {
          filter._id = { $nin: validIds.map(id => new Types.ObjectId(id)) }; // $nin: not in
        }
      }

      return await this.userModel
        .find(filter)
        .select('username phoneNumber fullName avatarUrl isOnline')
        .limit(limit || 10)
        .sort({ isOnline: -1, username: 1 }) // Sort by online status and then by username
        .exec();
    } catch (error) {
      this.logger.error(`Failed to search users: ${error.message}`);
      throw error;

    }
  }
  async addFriend(userId: string, friendId: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(friendId)) {
        return false;
      }

      const result = await this.userModel
        .updateOne(
          { _id: userId },
          {
            $addToSet: { friends: new Types.ObjectId(friendId) }, // $addToSet: adds to array only if not already present
            updatedAt: new Date()
          }
        )
        .exec();

      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to add friend: ${error.message}`);
      throw error;
    }
  }

  async removeFriend(userId: string, friendId: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(friendId)) {
        return false;
      }

      const result = await this.userModel
        .updateOne(
          { _id: userId },
          {
            $pull: { friends: new Types.ObjectId(friendId) }, // $pull: removes from array
            updatedAt: new Date()
          }
        )
        .exec();
      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to remove friend: ${error.message}`);
      throw error;
    }
  }
  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(userId1) || !Types.ObjectId.isValid(userId2)) {
        return false;
      }
      const user = await this.userModel
        .findOne({
          _id: userId1,
          friends: new Types.ObjectId(userId2)
        })
        .exec();
      return !!user; // Returns true if user is found, false otherwise
    } catch (error) {
      this.logger.error(`Failed to check friendship: ${error.message}`);
      throw error;
    }
  }

  async getFriendsWithDetails(userId: string): Promise<UserDocument[]> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return [];
      }
      const user = await this.userModel
        .findById(userId)
        .populate({
          path: 'friends',
          select: 'username fullName avatarUrl isOnline status lastSeen',
          match: { status: 'active' }
        })
        .exec();
      return user?.friends as unknown as UserDocument[] || [];
    } catch (error) {
      this.logger.error(`Failed to get friends with details: ${error.message}`);
      throw error;
    }
  }
  updateOnlineStatus(id: string, isOnline: boolean): Promise<UserDocument | null> {
    throw new Error("Method not implemented.");
  }
  updateRefreshToken(id: string, refreshToken: string | null): Promise<UserDocument | null> {
    throw new Error("Method not implemented.");
  }
  blockUser(userId: string, blockedUserId: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  unblockUser(userId: string, blockedUserId: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  getCountByStatus(): Promise<{ [key: string]: number; }> {
    throw new Error("Method not implemented.");
  }

}

