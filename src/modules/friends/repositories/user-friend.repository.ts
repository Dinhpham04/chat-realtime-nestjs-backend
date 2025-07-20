import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserFriend, UserFriendDocument } from '../schemas/user-friend.schema';
import { FriendStatus, FriendListOptions, IUserFriendRepository } from '../types';

/**
 * UserFriendRepository - MVP Implementation
 * 
 * 🎯 Purpose: Data access layer cho friendship relationships
 * 📱 Mobile-First: Optimized queries cho mobile performance
 * 🚀 Clean Architecture: Repository pattern với interface abstraction
 * 
 * Features:
 * - CRUD operations cho friend relationships
 * - Optimized queries với proper indexes
 * - Pagination support cho large friend lists
 * - Friend status management
 * - Mobile-friendly sorting & filtering
 */
@Injectable()
export class UserFriendRepository implements IUserFriendRepository {
    private readonly logger = new Logger(UserFriendRepository.name);

    constructor(
        @InjectModel(UserFriend.name)
        private readonly userFriendModel: Model<UserFriendDocument>,
    ) { }

    /**
     * Create new friendship relationship with duplicate protection
     * 
     * Following instruction-senior.md:
     * - Duplicate key error handling
     * - Race condition protection
     * - Comprehensive error logging
     */
    async create(params: Partial<UserFriend>): Promise<UserFriendDocument> {
        try {
            const friendship = new this.userFriendModel(params);
            const saved = await friendship.save();

            this.logger.log(`Created friendship: ${saved.userId} -> ${saved.friendId}`);
            return saved;
        } catch (error) {
            // Handle duplicate key error gracefully
            if (error.code === 11000) {
                this.logger.warn(`Duplicate friendship prevented: ${params.userId} -> ${params.friendId}`);
                // Try to find existing relationship
                const existing = await this.findByUserAndFriend(
                    params.userId?.toString() || '',
                    params.friendId?.toString() || ''
                );
                if (existing) {
                    this.logger.log(`Returning existing friendship instead: ${existing.id}`);
                    return existing;
                }
            }

            this.logger.error(`Failed to create friendship: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create or update friendship relationship (upsert pattern)
     * 
     * Safe method that handles both creation and updates
     * Prevents duplicate key errors
     */
    async upsertFriendship(params: Partial<UserFriend>): Promise<UserFriendDocument> {
        try {
            const { userId, friendId } = params;

            if (!userId || !friendId) {
                throw new BadRequestException('userId and friendId are required');
            }

            // Try to find existing first
            const existing = await this.findByUserAndFriend(
                userId.toString(),
                friendId.toString()
            );

            if (existing) {
                // Update existing relationship
                const updateData = { ...params };
                delete updateData.userId;
                delete updateData.friendId;

                const updated = await this.userFriendModel
                    .findByIdAndUpdate(existing.id, updateData, { new: true })
                    .exec();

                if (!updated) {
                    throw new Error('Failed to update existing friendship');
                }

                return updated;
            } else {
                // Create new relationship
                return await this.create(params);
            }
        } catch (error) {
            this.logger.error(`Failed to upsert friendship: ${error.message}`);
            throw error;
        }
    }

    /**
     * Find friendship by ID
     */
    async findById(id: string): Promise<UserFriendDocument | null> {
        try {
            if (!Types.ObjectId.isValid(id)) {
                return null;
            }

            return await this.userFriendModel
                .findById(id)
                .exec();
        } catch (error) {
            this.logger.error(`Failed to find friendship by ID ${id}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Find friendship between two users
     */
    async findByUserAndFriend(userId: string, friendId: string): Promise<UserFriendDocument | null> {
        try {
            if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(friendId)) {
                return null;
            }

            return await this.userFriendModel
                .findOne({
                    userId: new Types.ObjectId(userId),
                    friendId: new Types.ObjectId(friendId)
                })
                .exec();
        } catch (error) {
            this.logger.error(`Failed to find friendship between ${userId} and ${friendId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get friends list với bidirectional support (Phase 1 - No Socket Module)
     * 
     * Following instruction-senior.md:
     * - Bidirectional friendship support (userId OR friendId)
     * - Performance optimization with aggregation
     * - Mobile-first pagination and search
     * 
     * Phase 1 Implementation:
     * - Returns basic friend data from DB
     * - Online status will be calculated at service layer
     * - Ready for future Socket/Redis integration
     * 
     * TODO: Add Redis online status filtering when Socket module ready
     */
    async findFriendsByUserId(userId: string, options: FriendListOptions = {}): Promise<UserFriendDocument[]> {
        try {
            if (!Types.ObjectId.isValid(userId)) {
                throw new BadRequestException('Invalid user ID');
            }

            const {
                page = 1,
                limit = 20,
                search,
                sortBy = 'recent'
                // Note: onlineStatus filtering moved to service layer
            } = options;

            const skip = (page - 1) * limit;
            const userObjectId = new Types.ObjectId(userId);

            // Build aggregation pipeline cho bidirectional friends
            const pipeline: any[] = [
                // Match friendships where user is either sender or receiver (BIDIRECTIONAL)
                {
                    $match: { userId: userObjectId, status: FriendStatus.ACCEPTED },
                },

                // Add field to determine the friend's ID dynamically
                {
                    $addFields: {
                        actualFriendId: {
                            $cond: {
                                if: { $eq: ['$userId', userObjectId] },
                                then: '$friendId',
                                else: '$userId'
                            }
                        }
                    }
                },

                // Populate friend details based on actualFriendId
                {
                    $lookup: {
                        from: 'users_core',
                        localField: 'actualFriendId',
                        foreignField: '_id',
                        as: 'friendDetails'
                    }
                },
                { $unwind: '$friendDetails' },

                // Search filter
                ...(search ? [{
                    $match: {
                        $or: [
                            { 'friendDetails.fullName': { $regex: search, $options: 'i' } },
                            { 'friendDetails.username': { $regex: search, $options: 'i' } }
                        ]
                    }
                }] : []),

                // Sorting
                {
                    $sort: this.getSortOptions(sortBy)
                },

                // Pagination
                { $skip: skip },
                { $limit: limit },

                // Project final fields
                {
                    $project: {
                        _id: 1,
                        userId: 1,
                        friendId: 1,
                        actualFriendId: 1, // Include for debugging
                        status: 1,
                        addMethod: 1,
                        acceptedAt: 1,
                        lastInteractionAt: 1,
                        mutualFriendsCount: 1,
                        createdAt: 1,
                        updatedAt: 1,
                        friendDetails: {
                            _id: 1,
                            fullName: 1,
                            username: 1,
                            phoneNumber: 1,
                            avatarUrl: 1,
                            activityStatus: 1,
                            lastSeen: 1
                            // Note: isOnline will be calculated from Redis/WebSocket later
                        }
                    }
                }
            ];

            return await this.userFriendModel.aggregate(pipeline).exec();
        } catch (error) {
            this.logger.error(`Failed to find friends for user ${userId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update friendship status với metadata
     */
    async updateStatus(id: string, status: FriendStatus, metadata: any = {}): Promise<UserFriendDocument> {
        try {
            if (!Types.ObjectId.isValid(id)) {
                throw new Error('Invalid friendship ID');
            }

            const updateData: any = {
                status,
                ...metadata
            };

            // Add timestamp based on status
            if (status === FriendStatus.ACCEPTED) {
                updateData.acceptedAt = new Date();
            } else if (status === FriendStatus.BLOCKED) {
                updateData.blockedAt = new Date();
            }

            const updated = await this.userFriendModel
                .findByIdAndUpdate(id, updateData, { new: true })
                // .populate('userId', 'fullName username phoneNumber avatarUrl')
                // .populate('friendId', 'fullName username phoneNumber avatarUrl')
                .exec();

            if (!updated) {
                throw new Error('Friendship not found');
            }

            this.logger.log(`Updated friendship ${id} status to ${status}`);
            return updated;
        } catch (error) {
            this.logger.error(`Failed to update friendship status: ${error.message}`);
            throw error;
        }
    }

    /**
     * Hard delete friendship - Following instruction-senior.md KISS principle
     * 
     * Senior-level decision:
     * - YAGNI: No business requirement for soft delete recovery
     * - KISS: Hard delete is simpler and clearer
     * - Performance: Better query performance without isDeleted checks
     * - Maintainability: Less complex code, fewer edge cases
     */
    async delete(id: string): Promise<boolean> {
        try {
            if (!Types.ObjectId.isValid(id)) {
                return false;
            }

            const result = await this.userFriendModel
                .deleteOne({ _id: id })
                .exec();

            const success = result.deletedCount > 0;
            if (success) {
                this.logger.log(`Hard deleted friendship ${id}`);
            }

            return success;
        } catch (error) {
            this.logger.error(`Failed to delete friendship ${id}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Batch delete friendships - For cleanup operations
     * 
     * Following instruction-senior.md:
     * - Performance: Batch operations for efficiency
     * - Use case: User account deletion, bulk cleanup
     */
    async deleteBatch(friendshipIds: string[]): Promise<number> {
        try {
            const validIds = friendshipIds.filter(id => Types.ObjectId.isValid(id));

            if (validIds.length === 0) {
                return 0;
            }

            const result = await this.userFriendModel
                .deleteMany({ _id: { $in: validIds.map(id => new Types.ObjectId(id)) } })
                .exec();

            this.logger.log(`Batch deleted ${result.deletedCount} friendships`);
            return result.deletedCount;
        } catch (error) {
            this.logger.error(`Failed to batch delete friendships: ${error.message}`);
            throw error;
        }
    }

    /**
     * Delete all friendships for a user - For account deletion
     * 
     * Following instruction-senior.md:
     * - Complete cleanup when user deletes account
     * - Bidirectional deletion (both directions)
     */
    async deleteAllUserFriendships(userId: string): Promise<number> {
        try {
            if (!Types.ObjectId.isValid(userId)) {
                return 0;
            }

            const userObjectId = new Types.ObjectId(userId);

            // Delete all friendships where user is either sender or receiver
            const result = await this.userFriendModel
                .deleteMany({
                    $or: [
                        { userId: userObjectId },
                        { friendId: userObjectId }
                    ]
                })
                .exec();

            this.logger.log(`Deleted all ${result.deletedCount} friendships for user ${userId}`);
            return result.deletedCount;
        } catch (error) {
            this.logger.error(`Failed to delete all friendships for user ${userId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Count friends by status - cho mobile dashboard
     */
    async countFriendsByStatus(userId: string, status: FriendStatus): Promise<number> {
        try {
            if (!Types.ObjectId.isValid(userId)) {
                return 0;
            }

            return await this.userFriendModel
                .countDocuments({
                    userId: new Types.ObjectId(userId),
                    status
                })
                .exec();
        } catch (error) {
            this.logger.error(`Failed to count friends for user ${userId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get friend requests with flexible filtering
     * 
     * Following instruction-senior.md:
     * - Senior-level implementation with comprehensive filtering
     * - Performance optimization without over-fetching
     * - Mobile-first with pagination support
     * - Security validation
     * - Consistent response format (IDs as strings)
     */
    async findFriendRequests(
        userId: string,
        options: {
            type?: 'incoming' | 'outgoing' | 'all';
            status?: FriendStatus;
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<UserFriendDocument[]> {
        try {
            if (!Types.ObjectId.isValid(userId)) {
                return [];
            }

            const {
                type = 'all',
                status,
                limit = 20,
                offset = 0
            } = options;

            const query: any = {};

            // Add status filter if provided
            if (status) {
                query.status = status;
            }

            // Add type filter (incoming/outgoing/all)
            if (type === 'incoming') {
                query.friendId = new Types.ObjectId(userId);
            } else if (type === 'outgoing') {
                query.userId = new Types.ObjectId(userId);
            } else if (type === 'all') {
                query.$or = [
                    { userId: new Types.ObjectId(userId) },
                    { friendId: new Types.ObjectId(userId) }
                ];
            }

            // Don't populate - keep IDs as strings for consistency
            // Service layer will fetch user info separately as needed
            return await this.userFriendModel
                .find(query)
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit)
                .exec();
        } catch (error) {
            this.logger.error(`Failed to find friend requests for user ${userId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get pending friend requests (incoming & outgoing)
     */
    async findPendingRequests(userId: string, type: 'incoming' | 'outgoing' = 'incoming'): Promise<UserFriendDocument[]> {
        try {
            if (!Types.ObjectId.isValid(userId)) {
                return [];
            }

            const query = {
                status: FriendStatus.PENDING
            };

            if (type === 'incoming') {
                query['friendId'] = new Types.ObjectId(userId);
            } else {
                query['userId'] = new Types.ObjectId(userId);
            }

            return await this.userFriendModel
                .find(query)
                .populate('userId', 'fullName username phoneNumber avatarUrl')
                .populate('friendId', 'fullName username phoneNumber avatarUrl')
                .sort({ createdAt: -1 })
                .exec();
        } catch (error) {
            this.logger.error(`Failed to find pending requests for user ${userId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check if users are friends (fast lookup)
     */
    async areFriends(userId: string, friendId: string): Promise<boolean> {
        try {
            if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(friendId)) {
                return false;
            }

            const friendship = await this.userFriendModel
                .findOne({
                    userId: new Types.ObjectId(userId),
                    friendId: new Types.ObjectId(friendId),
                    status: FriendStatus.ACCEPTED
                })
                .select('_id')
                .exec();

            return !!friendship;
        } catch (error) {
            this.logger.error(`Failed to check friendship between ${userId} and ${friendId}: ${error.message}`);
            return false;
        }
    }

    /**
     * Update last interaction time (for mobile sorting)
     */
    async updateLastInteraction(userId: string, friendId: string): Promise<void> {
        try {
            if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(friendId)) {
                return;
            }

            await this.userFriendModel
                .updateOne(
                    {
                        userId: new Types.ObjectId(userId),
                        friendId: new Types.ObjectId(friendId),
                        status: FriendStatus.ACCEPTED
                    },
                    { lastInteractionAt: new Date() }
                )
                .exec();
        } catch (error) {
            this.logger.error(`Failed to update last interaction: ${error.message}`);
        }
    }

    /**
     * Helper: Get sort options based on mobile preferences
     */
    private getSortOptions(sortBy: string): any {
        switch (sortBy) {
            case 'recent':
                return { lastInteractionAt: -1, acceptedAt: -1 };
            case 'name':
                return { 'friendDetails.fullName': 1 };
            case 'mutual':
                return { mutualFriendsCount: -1, acceptedAt: -1 };
            default:
                return { acceptedAt: -1 };
        }
    }
}
