/**
 * ConversationRepository Implementation
 * 
 * 🎯 Purpose: MongoDB data access layer for conversations
 * 📱 Mobile-First: Optimized queries for mobile chat app
 * 🚀 Clean Architecture: Implementation of IConversationRepository
 * 
 * Features:
 * - High-performance queries with proper indexing
 * - Real-time conversation updates
 * - Participant management
 * - Search and filtering capabilities
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IConversationRepository } from './interfaces/conversation-repository.interface';
import {
  ConversationType,
  ConversationStatus,
  UserConversationStatus,
  ParticipantRole,
  CreateConversationData,
  UpdateConversationData,
  ConversationQuery,
  ConversationWithParticipants,
  ConversationListItem,
  ParticipantData,
  ParticipantInfo,
  ConversationSearchOptions,
} from '../types/conversation.types';
import { Conversation, ConversationDocument } from '../schemas/conversation.schema';
import { ConversationParticipant, ConversationParticipantDocument } from '../schemas/conversation-participant.schema';

@Injectable()
export class ConversationRepository implements IConversationRepository {
  private readonly logger = new Logger(ConversationRepository.name);

  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,

    @InjectModel(ConversationParticipant.name)
    private readonly participantModel: Model<ConversationParticipantDocument>,
  ) { }

  // =============== CORE CRUD OPERATIONS ===============

  async create(data: CreateConversationData): Promise<ConversationWithParticipants> {
    try {
      this.logger.debug(`Creating conversation with data: ${JSON.stringify(data)}`);


      const conversation = new this.conversationModel({
        type: data.type,
        name: data.name,
        description: data.description,
        avatarUrl: data.avatarUrl,
        createdBy: new Types.ObjectId(data.createdBy),
        isActive: true,
        lastActivity: new Date(),
      });

      const savedConversation = await conversation.save();

      // Add initial participants
      const participants: any[] = [];

      // Add creator as owner/admin
      const creatorParticipant = {
        conversationId: savedConversation._id,
        userId: new Types.ObjectId(data.createdBy),
        role: data.type === ConversationType.GROUP ? ParticipantRole.OWNER : ParticipantRole.ADMIN,
        joinedAt: new Date(),
        addedBy: new Types.ObjectId(data.createdBy),
        settings: {
          isMuted: false,
          isArchived: false,
          isPinned: false,
          notificationLevel: 'all',
        },
        readStatus: {
          unreadCount: 0,
        },
      };
      participants.push(creatorParticipant);

      // Add other participants
      if (data.initialParticipants && data.initialParticipants.length > 0) {
        for (const participantId of data.initialParticipants) {
          const participantData = {
            conversationId: savedConversation._id,
            userId: new Types.ObjectId(participantId),
            role: ParticipantRole.MEMBER,
            joinedAt: new Date(),
            addedBy: new Types.ObjectId(data.createdBy),
            settings: {
              isMuted: false,
              isArchived: false,
              isPinned: false,
              notificationLevel: 'all',
            },
            readStatus: {
              unreadCount: 0,
            },
          };
          participants.push(participantData);
        }
      }

      await this.participantModel.insertMany(participants);

      return await this.findByIdWithParticipants(savedConversation._id.toString()) as ConversationWithParticipants;
    } catch (error) {
      this.logger.error(`Error creating conversation: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findByIdWithParticipants(conversationId: string): Promise<ConversationWithParticipants | null> {
    try {
      // Use aggregation to get conversation with participants and user details in one query
      const result = await this.conversationModel.aggregate([
        {
          $match: {
            _id: new Types.ObjectId(conversationId),
            isActive: true
          }
        },
        {
          $lookup: {
            from: 'conversation_participants', // Collection name
            let: { conversationId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$conversationId', '$$conversationId'] },
                      { $not: { $ifNull: ['$leftAt', false] } } // Active participants only
                    ]
                  }
                }
              },
              {
                $lookup: {
                  from: 'users_core', // Users collection
                  localField: 'userId',
                  foreignField: '_id',
                  as: 'userDetails',
                  pipeline: [
                    {
                      $project: {
                        username: 1,
                        fullName: 1,
                        avatarUrl: 1,
                        isOnline: 1,
                        lastSeen: 1
                      }
                    }
                  ]
                }
              },
              {
                $unwind: {
                  path: '$userDetails',
                  preserveNullAndEmptyArrays: true
                }
              }
            ],
            as: 'participants'
          }
        }
      ]).exec();

      if (!result || result.length === 0) {
        this.logger.warn(`Conversation not found in aggregation: ${conversationId}`);

        // Fallback: Try simple find
        const conversation = await this.conversationModel.findById(conversationId).exec();
        if (!conversation) {
          return null;
        }

        // Get participants separately
        const participants = await this.participantModel
          .find({
            conversationId: new Types.ObjectId(conversationId),
            leftAt: null
          })
          .exec();

        return this.mapToConversationWithParticipants(conversation, participants);
      }

      const conversationData = result[0];
      this.logger.debug('Aggregation result:', {
        id: conversationData._id,
        name: conversationData.name,
        participantCount: conversationData.participants?.length || 0
      });

      return this.mapAggregatedToConversationWithParticipants(conversationData);
    } catch (error) {
      this.logger.error(`Error finding conversation by ID: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findById(conversationId: string): Promise<ConversationWithParticipants | null> {
    return this.findByIdWithParticipants(conversationId);
  }

  async updateById(
    conversationId: string,
    updateData: UpdateConversationData
  ): Promise<ConversationWithParticipants | null> {
    try {
      const updatedConversation = await this.conversationModel
        .findByIdAndUpdate(
          conversationId,
          {
            ...updateData,
            updatedAt: new Date(),
          },
          { new: true }
        )
        .exec();

      if (!updatedConversation) {
        return null;
      }

      return await this.findByIdWithParticipants(conversationId);
    } catch (error) {
      this.logger.error(`Error updating conversation: ${error.message}`, error.stack);
      throw error;
    }
  }

  async softDeleteById(conversationId: string): Promise<boolean> {
    try {
      const result = await this.conversationModel
        .findByIdAndUpdate(
          conversationId,
          {
            isActive: false,
            updatedAt: new Date(),
          }
        )
        .exec();

      return result !== null;
    } catch (error) {
      this.logger.error(`Error soft deleting conversation: ${error.message}`, error.stack);
      return false;
    }
  }

  async deleteById(conversationId: string): Promise<boolean> {
    try {
      // Delete participants first
      await this.participantModel.deleteMany({
        conversationId: new Types.ObjectId(conversationId)
      });

      // Delete conversation
      const result = await this.conversationModel
        .findByIdAndDelete(conversationId)
        .exec();

      return result !== null;
    } catch (error) {
      this.logger.error(`Error deleting conversation: ${error.message}`, error.stack);
      return false;
    }
  }

  // =============== CONVERSATION QUERIES ===============

  async findUserConversations(
    userId: string,
    query: ConversationQuery
  ): Promise<{
    conversations: ConversationListItem[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const {
        type,
        status = 'active',
        limit = 20,
        offset = 0,
        search,
        sortBy = 'updated',
        hasUnread,
      } = query;

      // Build aggregation pipeline
      const pipeline: any[] = [
        // Match user's participants
        {
          $match: {
            userId: new Types.ObjectId(userId),
            leftAt: null, // Active participants only
            ...(status === 'archived' && { 'settings.isArchived': true }),
            ...(status === 'active' && { 'settings.isArchived': { $ne: true } }),
          },
        },
        // Lookup conversation details
        {
          $lookup: {
            from: 'conversations',
            localField: 'conversationId',
            foreignField: '_id',
            as: 'conversation',
          },
        },
        { $unwind: '$conversation' },
        // Filter by conversation criteria
        {
          $match: {
            'conversation.isActive': true,
            ...(type && { 'conversation.type': type }),
          },
        },
        // Add search filter if provided
        ...(search ? [{
          $match: {
            $or: [
              { 'conversation.name': { $regex: search, $options: 'i' } },
              { 'conversation.lastMessage.content': { $regex: search, $options: 'i' } },
            ],
          },
        }] : []),
        // Lookup participant count
        {
          $lookup: {
            from: 'conversationparticipants',
            let: { conversationId: '$conversationId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$conversationId', '$$conversationId'] },
                      { $not: { $ifNull: ['$leftAt', false] } } // Active participants
                    ]
                  }
                }
              },
              { $count: 'count' }
            ],
            as: 'participantCount',
          },
        },
        // Project final structure
        {
          $project: {
            id: '$conversation._id',
            type: '$conversation.type',
            name: '$conversation.name',
            avatarUrl: '$conversation.avatarUrl',
            participantCount: { $ifNull: [{ $arrayElemAt: ['$participantCount.count', 0] }, 0] },
            lastMessage: '$conversation.lastMessage',
            unreadCount: '$readStatus.unreadCount',
            lastActivity: '$conversation.lastActivity',
            isArchived: { $ifNull: ['$settings.isArchived', false] },
            isPinned: { $ifNull: ['$settings.isPinned', false] },
            isMuted: { $ifNull: ['$settings.isMuted', false] },
            updatedAt: '$conversation.updatedAt',
          },
        },
        // Filter by unread if specified
        ...(hasUnread !== undefined ? [{
          $match: {
            unreadCount: hasUnread ? { $gt: 0 } : 0,
          },
        }] : []),
        // Sort
        {
          $sort: this.buildSortCriteria(sortBy),
        },
      ];

      // Get total count
      const countPipeline = [...pipeline, { $count: 'total' }];
      const countResult = await this.participantModel.aggregate(countPipeline);
      const total = countResult[0]?.total || 0;

      // Get paginated results
      const resultPipeline = [
        ...pipeline,
        { $skip: offset },
        { $limit: limit },
      ];

      const conversations = await this.participantModel.aggregate(resultPipeline);

      return {
        conversations: conversations as ConversationListItem[],
        total,
        hasMore: offset + conversations.length < total,
      };
    } catch (error) {
      this.logger.error(`Error finding user conversations: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findDirectConversationByParticipants(
    userId1: string,
    userId2: string
  ): Promise<ConversationWithParticipants | null> {
    try {
      // Find conversations where both users are participants
      const participants = await this.participantModel
        .find({
          userId: { $in: [new Types.ObjectId(userId1), new Types.ObjectId(userId2)] },
          leftAt: null, // Active participants only
        })
        .exec();
      // Group by conversation and check if both users are present
      const conversationMap = new Map<string, any[]>();

      for (const participant of participants) {
        const convId = participant.conversationId.toString();
        if (!conversationMap.has(convId)) {
          conversationMap.set(convId, []);
        }
        conversationMap.get(convId)!.push(participant); // khẳng định là không null vì đã kiểm tra trước
      }

      // Find direct conversation with exactly these 2 participants
      for (const [conversationId, convParticipants] of conversationMap) {
        if (convParticipants.length === 2) {
          const conversation = await this.conversationModel.findById(conversationId);
          if (conversation && conversation.type === ConversationType.DIRECT) {
            return await this.findByIdWithParticipants(conversationId);
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Error finding direct conversation: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findByParticipants(participantIds: string[]): Promise<ConversationWithParticipants[]> {
    try {
      const objectIds = participantIds.map(id => new Types.ObjectId(id));

      const pipeline = [
        {
          $match: {
            userId: { $in: objectIds },
            leftAt: null, // Active participants
          },
        },
        {
          $group: {
            _id: '$conversationId',
            participants: { $push: '$userId' },
          },
        },
        {
          $match: {
            participants: { $size: participantIds.length },
          },
        },
      ];

      const results = await this.participantModel.aggregate(pipeline);
      const conversationIds = results.map(r => r._id.toString());

      const conversations = await Promise.all(
        conversationIds.map(id => this.findByIdWithParticipants(id))
      );

      return conversations.filter(Boolean) as ConversationWithParticipants[];
    } catch (error) {
      this.logger.error(`Error finding conversations by participants: ${error.message}`, error.stack);
      throw error;
    }
  }

  async searchConversations(
    userId: string,
    searchOptions: ConversationSearchOptions
  ): Promise<{
    conversations: ConversationListItem[];
    total: number;
  }> {
    try {
      const {
        query: searchQuery,
        limit = 20,
        offset = 0,
        type,
        includeArchived = false,
      } = searchOptions;

      const pipeline: any[] = [
        {
          $match: {
            userId: new Types.ObjectId(userId),
            leftAt: null, // Active participants
            ...(includeArchived ? {} : { 'settings.isArchived': { $ne: true } }),
          },
        },
        {
          $lookup: {
            from: 'conversations',
            localField: 'conversationId',
            foreignField: '_id',
            as: 'conversation',
          },
        },
        { $unwind: '$conversation' },
        {
          $match: {
            'conversation.isActive': true,
            ...(type && { 'conversation.type': type }),
            $or: [
              { 'conversation.name': { $regex: searchQuery, $options: 'i' } },
              { 'conversation.description': { $regex: searchQuery, $options: 'i' } },
            ],
          },
        },
        {
          $project: {
            id: '$conversation._id',
            type: '$conversation.type',
            name: '$conversation.name',
            avatarUrl: '$conversation.avatarUrl',
            lastMessage: '$conversation.lastMessage',
            lastActivity: '$conversation.lastActivity',
          },
        },
        { $sort: { lastActivity: -1 } },
      ];

      const countResult = await this.participantModel.aggregate([
        ...pipeline,
        { $count: 'total' },
      ]);

      const conversations = await this.participantModel.aggregate([
        ...pipeline,
        { $skip: offset },
        { $limit: limit },
      ]);

      return {
        conversations: conversations as ConversationListItem[],
        total: countResult[0]?.total || 0,
      };
    } catch (error) {
      this.logger.error(`Error searching conversations: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUserConversationStats(userId: string): Promise<{
    totalConversations: number;
    activeConversations: number;
    archivedConversations: number;
    groupConversations: number;
    directConversations: number;
  }> {
    try {
      const pipeline = [
        {
          $match: {
            userId: new Types.ObjectId(userId),
            leftAt: null, // Active participants
          },
        },
        {
          $lookup: {
            from: 'conversations',
            localField: 'conversationId',
            foreignField: '_id',
            as: 'conversation',
          },
        },
        { $unwind: '$conversation' },
        {
          $group: {
            _id: null,
            totalConversations: { $sum: 1 },
            activeConversations: {
              $sum: {
                $cond: [{ $ne: ['$settings.isArchived', true] }, 1, 0],
              },
            },
            archivedConversations: {
              $sum: {
                $cond: [{ $eq: ['$settings.isArchived', true] }, 1, 0],
              },
            },
            groupConversations: {
              $sum: {
                $cond: [{ $eq: ['$conversation.type', ConversationType.GROUP] }, 1, 0],
              },
            },
            directConversations: {
              $sum: {
                $cond: [{ $eq: ['$conversation.type', ConversationType.DIRECT] }, 1, 0],
              },
            },
          },
        },
      ];

      const result = await this.participantModel.aggregate(pipeline);

      return result[0] || {
        totalConversations: 0,
        activeConversations: 0,
        archivedConversations: 0,
        groupConversations: 0,
        directConversations: 0,
      };
    } catch (error) {
      this.logger.error(`Error getting user conversation stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  // =============== PARTICIPANT MANAGEMENT ===============

  async addParticipants(
    conversationId: string,
    participants: ParticipantData[]
  ): Promise<{
    added: ParticipantData[];
    failed: { userId: string; reason: string }[];
  }> {
    try {
      const added: ParticipantData[] = [];
      const failed: { userId: string; reason: string }[] = [];

      for (const participant of participants) {
        try {
          // Check if already participant
          const existing = await this.participantModel.findOne({
            conversationId: new Types.ObjectId(conversationId),
            userId: new Types.ObjectId(participant.userId),
          });

          if (existing) {
            if (!existing.leftAt) {
              failed.push({ userId: participant.userId, reason: 'Already a participant' });
              continue;
            } else {
              // Reactivate participant
              existing.leftAt = undefined;
              existing.joinedAt = new Date();
              await existing.save();
              added.push(participant);
            }
          } else {
            // Create new participant
            const newParticipant = new this.participantModel({
              conversationId: new Types.ObjectId(conversationId),
              userId: new Types.ObjectId(participant.userId),
              role: participant.role || ParticipantRole.MEMBER,
              joinedAt: new Date(),
              addedBy: new Types.ObjectId(participant.addedBy),
              isActive: true,
              settings: participant.settings || {
                isMuted: false,
                isArchived: false,
                isPinned: false,
                notificationLevel: 'all',
              },
            });

            await newParticipant.save();
            added.push(participant);
          }
        } catch (error) {
          failed.push({ userId: participant.userId, reason: error.message });
        }
      }

      // Update conversation activity
      await this.updateLastActivity(conversationId);

      return { added, failed };
    } catch (error) {
      this.logger.error(`Error adding participants: ${error.message}`, error.stack);
      throw error;
    }
  }

  async removeParticipant(conversationId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.participantModel.findOneAndUpdate(
        {
          conversationId: new Types.ObjectId(conversationId),
          userId: new Types.ObjectId(userId),
          leftAt: null, // Active participants
        },
        {
          leftAt: new Date(),
        }
      );

      if (result) {
        await this.updateLastActivity(conversationId);
      }

      return result !== null;
    } catch (error) {
      this.logger.error(`Error removing participant: ${error.message}`, error.stack);
      return false;
    }
  }

  async updateParticipantRole(
    conversationId: string,
    userId: string,
    role: ParticipantRole
  ): Promise<boolean> {
    try {
      const result = await this.participantModel.findOneAndUpdate(
        {
          conversationId: new Types.ObjectId(conversationId),
          userId: new Types.ObjectId(userId),
          leftAt: null, // Active participants
        },
        { role }
      );

      return result !== null;
    } catch (error) {
      this.logger.error(`Error updating participant role: ${error.message}`, error.stack);
      return false;
    }
  }

  async isUserParticipant(conversationId: string, userId: string): Promise<boolean> {
    try {
      const participant = await this.participantModel.findOne({
        conversationId: new Types.ObjectId(conversationId),
        userId: new Types.ObjectId(userId),
        leftAt: null, // Active participants
      });

      return participant !== null;
    } catch (error) {
      this.logger.error(`Error checking user participation: ${error.message}`, error.stack);
      return false;
    }
  }

  async getUserRole(conversationId: string, userId: string): Promise<ParticipantRole | null> {
    try {
      const participant = await this.participantModel.findOne({
        conversationId: new Types.ObjectId(conversationId),
        userId: new Types.ObjectId(userId),
        leftAt: null, // Active participants
      });

      return participant?.role || null;
    } catch (error) {
      this.logger.error(`Error getting user role: ${error.message}`, error.stack);
      return null;
    }
  }

  async getParticipants(
    conversationId: string,
    options: {
      limit?: number;
      offset?: number;
      role?: ParticipantRole;
    }
  ): Promise<{
    participants: ParticipantData[];
    total: number;
  }> {
    try {
      const {
        limit = 50,
        offset = 0,
        role,
      } = options;

      const query: any = {
        conversationId: new Types.ObjectId(conversationId),
        leftAt: null, // Active participants
      };

      if (role) {
        query.role = role;
      }

      const total = await this.participantModel.countDocuments(query);

      const participants = await this.participantModel
        .find(query)
        .populate('userId', 'username fullName avatarUrl isOnline lastSeen')
        .skip(offset)
        .limit(limit)
        .sort({ joinedAt: -1 })
        .exec();

      return {
        participants: participants.map(this.mapToParticipantData),
        total,
      };
    } catch (error) {
      this.logger.error(`Error getting participants: ${error.message}`, error.stack);
      throw error;
    }
  }

  // =============== CONVERSATION UPDATES ===============

  async updateLastMessage(
    conversationId: string,
    messageData: {
      messageId: string;
      content: string;
      senderId: string;
      messageType: string;
      timestamp: Date;
    }
  ): Promise<boolean> {
    try {
      const result = await this.conversationModel.findByIdAndUpdate(
        conversationId,
        {
          lastMessage: {
            messageId: new Types.ObjectId(messageData.messageId),
            senderId: new Types.ObjectId(messageData.senderId),
            content: messageData.content,
            messageType: messageData.messageType,
            sentAt: messageData.timestamp,
          },
          lastActivity: messageData.timestamp,
          updatedAt: new Date(),
        }
      );

      return result !== null;
    } catch (error) {
      this.logger.error(`Error updating last message: ${error.message}`, error.stack);
      return false;
    }
  }

  async updateConversationStatus(
    conversationId: string,
    userId: string,
    status: Partial<UserConversationStatus>
  ): Promise<boolean> {
    try {
      const updateFields: any = {};

      if (status.isArchived !== undefined) {
        updateFields['settings.isArchived'] = status.isArchived;
      }
      if (status.isPinned !== undefined) {
        updateFields['settings.isPinned'] = status.isPinned;
      }
      if (status.isMuted !== undefined) {
        updateFields['settings.isMuted'] = status.isMuted;
      }
      if (status.muteUntil !== undefined) {
        updateFields['settings.muteUntil'] = status.muteUntil;
      }

      const result = await this.participantModel.findOneAndUpdate(
        {
          conversationId: new Types.ObjectId(conversationId),
          userId: new Types.ObjectId(userId),
          leftAt: null,
        },
        updateFields
      );

      return result !== null;
    } catch (error) {
      this.logger.error(`Error updating conversation status: ${error.message}`, error.stack);
      return false;
    }
  }

  async incrementUnreadCount(conversationId: string, excludeUserId: string): Promise<boolean> {
    try {
      await this.participantModel.updateMany(
        {
          conversationId: new Types.ObjectId(conversationId),
          userId: { $ne: new Types.ObjectId(excludeUserId) },
          leftAt: null, // Active participants
        },
        {
          $inc: { 'readStatus.unreadCount': 1 },
        }
      );

      return true;
    } catch (error) {
      this.logger.error(`Error incrementing unread count: ${error.message}`, error.stack);
      return false;
    }
  }

  async resetUnreadCount(conversationId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.participantModel.findOneAndUpdate(
        {
          conversationId: new Types.ObjectId(conversationId),
          userId: new Types.ObjectId(userId),
          leftAt: null, // Active participants
        },
        {
          'readStatus.unreadCount': 0,
          'readStatus.lastReadAt': new Date(),
        }
      );

      return result !== null;
    } catch (error) {
      this.logger.error(`Error resetting unread count: ${error.message}`, error.stack);
      return false;
    }
  }

  async updateLastActivity(conversationId: string): Promise<boolean> {
    try {
      const result = await this.conversationModel.findByIdAndUpdate(
        conversationId,
        {
          lastActivity: new Date(),
          updatedAt: new Date(),
        }
      );

      return result !== null;
    } catch (error) {
      this.logger.error(`Error updating last activity: ${error.message}`, error.stack);
      return false;
    }
  }

  // =============== BULK OPERATIONS ===============

  async markMultipleAsRead(conversationIds: string[], userId: string): Promise<number> {
    try {
      const result = await this.participantModel.updateMany(
        {
          conversationId: { $in: conversationIds.map(id => new Types.ObjectId(id)) },
          userId: new Types.ObjectId(userId),
          leftAt: null, // Active participants
        },
        {
          'readStatus.unreadCount': 0,
          'readStatus.lastReadAt': new Date(),
        }
      );

      return result.modifiedCount || 0;
    } catch (error) {
      this.logger.error(`Error marking multiple as read: ${error.message}`, error.stack);
      return 0;
    }
  }

  async archiveMultiple(conversationIds: string[], userId: string): Promise<number> {
    try {
      const result = await this.participantModel.updateMany(
        {
          conversationId: { $in: conversationIds.map(id => new Types.ObjectId(id)) },
          userId: new Types.ObjectId(userId),
          leftAt: null, // Active participants
        },
        {
          'settings.isArchived': true,
        }
      );

      return result.modifiedCount || 0;
    } catch (error) {
      this.logger.error(`Error archiving multiple conversations: ${error.message}`, error.stack);
      return 0;
    }
  }

  async findByIds(conversationIds: string[]): Promise<ConversationWithParticipants[]> {
    try {
      const conversations = await Promise.all(
        conversationIds.map(id => this.findByIdWithParticipants(id))
      );

      return conversations.filter(Boolean) as ConversationWithParticipants[];
    } catch (error) {
      this.logger.error(`Error finding conversations by IDs: ${error.message}`, error.stack);
      throw error;
    }
  }

  // =============== AGGREGATION QUERIES ===============

  async getConversationMetrics(
    conversationId: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<{
    messageCount: number;
    participantCount: number;
    averageResponseTime: number;
    activeParticipants: number;
  }> {
    // This would typically involve joining with messages collection
    // For now, returning basic participant metrics
    try {
      const participantCount = await this.participantModel.countDocuments({
        conversationId: new Types.ObjectId(conversationId),
      });

      const activeParticipants = await this.participantModel.countDocuments({
        conversationId: new Types.ObjectId(conversationId),
        leftAt: null, // Active participants
      });

      return {
        messageCount: 0, // Would be calculated from messages collection
        participantCount,
        averageResponseTime: 0, // Would be calculated from message timestamps
        activeParticipants,
      };
    } catch (error) {
      this.logger.error(`Error getting conversation metrics: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUserActivitySummary(
    userId: string,
    period: 'day' | 'week' | 'month'
  ): Promise<{
    totalMessages: number;
    activeConversations: number;
    newConversations: number;
    averageResponseTime: number;
  }> {
    // This would typically involve complex aggregation with messages
    // For now, returning basic conversation metrics
    try {
      const activeConversations = await this.participantModel.countDocuments({
        userId: new Types.ObjectId(userId),
        leftAt: null, // Active participants
      });

      return {
        totalMessages: 0, // Would be calculated from messages collection
        activeConversations,
        newConversations: 0, // Would be calculated based on date range
        averageResponseTime: 0, // Would be calculated from message timestamps
      };
    } catch (error) {
      this.logger.error(`Error getting user activity summary: ${error.message}`, error.stack);
      throw error;
    }
  }

  // =============== PRIVATE HELPER METHODS ===============

  private buildSortCriteria(sortBy: string): Record<string, 1 | -1> {
    switch (sortBy) {
      case 'created':
        return { createdAt: -1 };
      case 'name':
        return { name: 1 };
      case 'updated':
      default:
        return { lastActivity: -1 };
    }
  }

  private mapToConversationWithParticipants(
    conversation: ConversationDocument,
    participants: ConversationParticipantDocument[]
  ): ConversationWithParticipants {
    return {
      id: conversation._id.toString(),
      type: conversation.type,
      name: conversation.name,
      description: conversation.description,
      avatarUrl: conversation.avatarUrl,
      createdBy: conversation.createdBy.toString(),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      isActive: conversation.isActive,
      lastMessage: conversation.lastMessage ? {
        messageId: conversation.lastMessage.messageId.toString(),
        senderId: conversation.lastMessage.senderId.toString(),
        content: conversation.lastMessage.content,
        messageType: conversation.lastMessage.messageType,
        sentAt: conversation.lastMessage.sentAt,
      } : undefined,
      participants: participants.map(p => this.mapToParticipantInfo(p)),
      lastActivity: conversation.lastActivity,
    };
  }

  /**
   * Map aggregated conversation data to ConversationWithParticipants
   */
  private mapAggregatedToConversationWithParticipants(aggregatedData: any): ConversationWithParticipants {
    // Debug log to check what data we receive
    this.logger.debug('Mapping aggregated data:', {
      id: aggregatedData._id,
      name: aggregatedData.name,
      type: aggregatedData.type,
      hasParticipants: !!aggregatedData.participants,
      participantCount: aggregatedData.participants?.length || 0
    });

    return {
      id: aggregatedData._id.toString(),
      type: aggregatedData.type || 'direct',
      name: aggregatedData.name || null,
      description: aggregatedData.description || null,
      avatarUrl: aggregatedData.avatarUrl || null,
      createdBy: aggregatedData.createdBy?.toString() || '',
      createdAt: aggregatedData.createdAt || new Date(),
      updatedAt: aggregatedData.updatedAt || new Date(),
      isActive: aggregatedData?.isActive, // Default to true
      lastMessage: aggregatedData.lastMessage ? {
        messageId: aggregatedData.lastMessage.messageId?.toString() || '',
        senderId: aggregatedData.lastMessage.senderId?.toString() || '',
        content: aggregatedData.lastMessage.content || '',
        messageType: aggregatedData.lastMessage.messageType || 'text',
        sentAt: aggregatedData.lastMessage.sentAt || new Date(),
      } : undefined,
      participants: (aggregatedData.participants || []).map(p => this.mapAggregatedParticipantData(p)),
      lastActivity: aggregatedData.lastActivity || new Date(),
    };
  }

  private mapToParticipantInfo(participant: ConversationParticipantDocument): ParticipantInfo {
    return {
      conversationId: participant.conversationId.toString(),
      userId: participant.userId.toString(),
      role: participant.role,
      joinedAt: participant.joinedAt,
      leftAt: participant.leftAt,
      addedBy: participant.addedBy.toString(),
      settings: participant.settings,
    };
  }

  private mapToParticipantData(participant: ConversationParticipantDocument): ParticipantData {
    return {
      conversationId: participant.conversationId.toString(),
      userId: participant.userId.toString(),
      role: participant.role,
      joinedAt: participant.joinedAt,
      addedBy: participant.addedBy.toString(),
      isActive: !participant.leftAt, // Active if leftAt is not set
      settings: participant.settings,
    };
  }

  /**
   * Map aggregated participant data with user details
   */
  private mapAggregatedParticipantData(participantData: any): ParticipantInfo {
    // Debug log to check participant data structure
    this.logger.debug('Mapping participant data:', {
      userId: participantData.userId,
      role: participantData.role,
      hasUserDetails: !!participantData.userDetails
    });

    return {
      conversationId: participantData.conversationId?.toString() || '',
      userId: participantData.userId?.toString() || '',
      role: participantData.role || 'member',
      joinedAt: participantData.joinedAt || new Date(),
      leftAt: participantData.leftAt || undefined,
      addedBy: participantData.addedBy?.toString() || '',
      settings: participantData.settings || {
        isMuted: false,
        isArchived: false,
        isPinned: false,
        notificationLevel: 'all'
      }
    };
  }

  // =============== TRANSACTION SUPPORT ===============

  /**
   * Execute operations within MongoDB transaction
   */
  async withTransaction<T>(operation: () => Promise<T>): Promise<T> {
    const session = await this.conversationModel.db.startSession();

    try {
      session.startTransaction();

      // Execute the operation within transaction context
      const result = await operation();

      await session.commitTransaction();
      return result;

    } catch (error) {
      await session.abortTransaction();
      this.logger.error(`Transaction failed: ${error.message}`, error.stack);
      throw error;

    } finally {
      session.endSession();
    }
  }

  /**
   * Get participants count
   */
  async getParticipantsCount(conversationId: string): Promise<number> {
    try {
      const count = await this.participantModel.countDocuments({
        conversationId: new Types.ObjectId(conversationId),
        leftAt: null // Active participants only
      });

      return count;

    } catch (error) {
      this.logger.error(`Failed to get participants count: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Count admins in conversation
   */
  async countAdmins(conversationId: string): Promise<number> {
    try {
      const count = await this.participantModel.countDocuments({
        conversationId: new Types.ObjectId(conversationId),
        role: ParticipantRole.ADMIN,
        leftAt: null // Active participants only
      });

      return count;

    } catch (error) {
      this.logger.error(`Failed to count admins: ${error.message}`, error.stack);
      throw error;
    }
  }
}
