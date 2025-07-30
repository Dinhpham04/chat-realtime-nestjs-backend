/**
 * Message Repository Implementation
 *
 * 🎯 Purpose: MongoDB persistence layer for messages
 * 📱 Mobile-First: Optimized queries for real-time messaging
 * 🚀 Clean Architecture: Repository pattern implementation
 *
 * Design Principles:
 * - Single Responsibility: Handle message data persistence only
 * - Performance: Optimized MongoDB queries with proper indexes
 * - Error Handling: Comprehensive error handling for database operations
 * - Security: Input validation and sanitization
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from '../schemas/message.schema';
import { IMessageRepository } from '../interfaces/message-repository.interface';
import { MessageFilter, PaginatedResponse, MessageType, MessageStatus } from '../types';
import { MessageSearchDto } from '../dto';

@Injectable()
export class MessageRepository implements IMessageRepository {
  private readonly logger = new Logger(MessageRepository.name);

  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>
  ) { }

  /**
   * Create a new message
   */
  async create(data: Partial<Message>): Promise<MessageDocument> {
    try {
      const message = new this.messageModel({
        ...data,
        _id: new Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const savedMessage = await message.save();
      this.logger.debug(`Created message: ${savedMessage._id}`);

      return savedMessage;
    } catch (error) {
      this.logger.error(`Failed to create message:`, error);
      throw error;
    }
  }

  /**
   * Find message by ID
   */
  async findById(id: string): Promise<MessageDocument | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return null;
      }

      const message = await this.messageModel
        .findOne({
          _id: new Types.ObjectId(id),
          isDeleted: false
        })
        .exec();

      return message;
    } catch (error) {
      this.logger.error(`Failed to find message by ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Find messages by conversation with pagination
   */
  async findByConversationId(
    conversationId: string,
    pagination: {
      page?: number;
      limit?: number;
      cursor?: string;
    }
  ): Promise<PaginatedResponse<MessageDocument>> {
    try {
      const page = pagination.page || 1;
      const limit = Math.min(pagination.limit || 20, 100); // Max 100 messages per page
      const skip = (page - 1) * limit;

      // Build query
      const query: any = {
        conversationId: new Types.ObjectId(conversationId),
        isDeleted: false
      };

      // Cursor-based pagination if cursor provided
      if (pagination.cursor) {
        query.createdAt = { $lt: new Date(pagination.cursor) };
      }



      // Get messages with count
      const [messages, total] = await Promise.all([
        this.messageModel
          .find(query)
          .sort({ createdAt: -1 }) // Latest first
          .skip(skip)
          .limit(limit)
          .exec(),
        this.messageModel.countDocuments(query)
      ]);

      // Calculate pagination info
      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      // Get cursors for next/prev pages
      const nextCursor = messages.length > 0 && hasNext ?
        messages[messages.length - 1].createdAt.toISOString() : undefined;
      const prevCursor = messages.length > 0 && hasPrev ?
        messages[0].createdAt.toISOString() : undefined;

      if (messages.length === 0) {
        this.logger.debug(`No messages found for conversation ${conversationId}`);
      }

      return {
        data: messages,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      };
    } catch (error) {
      this.logger.error(`Failed to find messages for conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Update message by ID
   */
  async updateById(id: string, data: Partial<Message>): Promise<MessageDocument | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return null;
      }

      const updatedMessage = await this.messageModel
        .findOneAndUpdate(
          {
            _id: new Types.ObjectId(id),
            isDeleted: false
          },
          {
            ...data,
            updatedAt: new Date()
          },
          {
            new: true, // Return updated document
            runValidators: true // Run schema validators
          }
        )
        .exec();

      if (updatedMessage) {
        this.logger.debug(`Updated message: ${updatedMessage._id}`);
      }

      return updatedMessage;
    } catch (error) {
      this.logger.error(`Failed to update message ${id}:`, error);
      throw error;
    }
  }

  /**
   * Soft delete message
   */
  async softDelete(id: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return false;
      }

      const result = await this.messageModel
        .updateOne(
          {
            _id: new Types.ObjectId(id),
            isDeleted: false
          },
          {
            isDeleted: true,
            updatedAt: new Date()
          }
        )
        .exec();

      const success = result.modifiedCount > 0;
      if (success) {
        this.logger.debug(`Soft deleted message: ${id}`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Failed to soft delete message ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update message status (for delivery tracking)
   */
  async updateMessageStatus(id: string, status: { status: any; updatedAt: Date }): Promise<MessageDocument | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return null;
      }

      // Since our basic Message schema doesn't have status field, 
      // we'll just update the updatedAt timestamp for now
      // In a full implementation, this would update a separate status collection
      const updatedMessage = await this.messageModel
        .findOneAndUpdate(
          {
            _id: new Types.ObjectId(id),
            isDeleted: false
          },
          {
            updatedAt: status.updatedAt
            // TODO: In a full implementation, update status in separate collection
          },
          { new: true }
        )
        .exec();

      if (updatedMessage) {
        this.logger.debug(`Updated message status: ${id} to ${status.status}`);
      }

      return updatedMessage;
    } catch (error) {
      this.logger.error(`Failed to update message status ${id}:`, error);
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string, userId: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(messageId)) {
        return false;
      }

      const result = await this.messageModel
        .updateOne(
          {
            _id: new Types.ObjectId(messageId),
            senderId: { $ne: userId }, // Don't mark own messages as read
            isDeleted: false
          },
          {
            status: MessageStatus.READ,
            readAt: new Date(),
            updatedAt: new Date()
          }
        )
        .exec();

      const success = result.modifiedCount > 0;
      if (success) {
        this.logger.debug(`Marked message ${messageId} as read by user ${userId}`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Failed to mark message ${messageId} as read:`, error);
      throw error;
    }
  }

  /**
   * Update message status
   */
  async updateStatus(messageId: string, status: string, timestamp?: Date): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(messageId)) {
        return false;
      }

      const updateData: any = {
        status,
        updatedAt: new Date()
      };

      // Set appropriate timestamp field based on status
      if (status === MessageStatus.DELIVERED && timestamp) {
        updateData.deliveredAt = timestamp;
      } else if (status === MessageStatus.READ && timestamp) {
        updateData.readAt = timestamp;
      }

      const result = await this.messageModel
        .updateOne(
          {
            _id: new Types.ObjectId(messageId),
            isDeleted: false
          },
          updateData
        )
        .exec();

      const success = result.modifiedCount > 0;
      if (success) {
        this.logger.debug(`Updated message ${messageId} status to ${status}`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Failed to update message ${messageId} status:`, error);
      throw error;
    }
  }

  /**
   * Search messages in conversation
   */
  async searchInConversation(
    conversationId: string,
    searchDto: MessageSearchDto
  ): Promise<PaginatedResponse<MessageDocument>> {
    try {
      const page = (searchDto as any).page || 1;
      const limit = Math.min((searchDto as any).limit || 20, 100);
      const skip = (page - 1) * limit;

      // Build search query
      const query: any = {
        conversationId: new Types.ObjectId(conversationId),
        isDeleted: false
      };

      // Text search
      if (searchDto.query) {
        query.$text = { $search: searchDto.query };
      }

      // Message type filter
      if (searchDto.type) {
        query.messageType = searchDto.type;
      }

      // Sender filter
      if (searchDto.senderId) {
        query.senderId = searchDto.senderId;
      }

      // Date range filter
      if (searchDto.fromDate || searchDto.toDate) {
        query.createdAt = {};
        if (searchDto.fromDate) {
          query.createdAt.$gte = new Date(searchDto.fromDate);
        }
        if (searchDto.toDate) {
          query.createdAt.$lte = new Date(searchDto.toDate);
        }
      }

      // If text search, sort by relevance score
      const sortOptions: any = searchDto.query ?
        { score: { $meta: 'textScore' }, createdAt: -1 } :
        { createdAt: -1 };

      const [messages, total] = await Promise.all([
        this.messageModel
          .find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.messageModel.countDocuments(query)
      ]);

      return {
        data: messages,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      this.logger.error(`Failed to search messages in conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Bulk mark messages as read
   */
  async bulkMarkAsRead(messageIds: string[], userId: string): Promise<number> {
    try {
      const validIds = messageIds
        .filter(id => Types.ObjectId.isValid(id))
        .map(id => new Types.ObjectId(id));

      if (validIds.length === 0) {
        return 0;
      }

      const result = await this.messageModel
        .updateMany(
          {
            _id: { $in: validIds },
            senderId: { $ne: userId }, // Don't mark own messages as read
            isDeleted: false
          },
          {
            status: MessageStatus.READ,
            readAt: new Date(),
            updatedAt: new Date()
          }
        )
        .exec();

      this.logger.debug(`Bulk marked ${result.modifiedCount} messages as read`);
      return result.modifiedCount;
    } catch (error) {
      this.logger.error(`Failed to bulk mark messages as read:`, error);
      throw error;
    }
  }

  /**
   * Bulk delete messages
   */
  async bulkDelete(messageIds: string[]): Promise<number> {
    try {
      const validIds = messageIds
        .filter(id => Types.ObjectId.isValid(id))
        .map(id => new Types.ObjectId(id));

      if (validIds.length === 0) {
        return 0;
      }

      const result = await this.messageModel
        .updateMany(
          {
            _id: { $in: validIds },
            isDeleted: false
          },
          {
            isDeleted: true,
            updatedAt: new Date()
          }
        )
        .exec();

      this.logger.debug(`Bulk deleted ${result.modifiedCount} messages`);
      return result.modifiedCount;
    } catch (error) {
      this.logger.error(`Failed to bulk delete messages:`, error);
      throw error;
    }
  }

  /**
   * Find unread messages for user
   */
  async findUnreadByUser(userId: string): Promise<MessageDocument[]> {
    try {
      const unreadMessages = await this.messageModel
        .find({
          senderId: { $ne: userId }, // Not sent by the user
          status: { $ne: MessageStatus.READ },
          isDeleted: false
        })
        .sort({ createdAt: -1 })
        .limit(100) // Limit to prevent large queries
        .exec();

      return unreadMessages;
    } catch (error) {
      this.logger.error(`Failed to find unread messages for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get message analytics for conversation
   */
  async getConversationAnalytics(conversationId: string): Promise<{
    totalMessages: number;
    messagesPerDay: number;
    mostActiveUsers: Array<{ userId: string; messageCount: number }>;
    messageTypeDistribution: Record<string, number>;
  }> {
    try {
      // Get total messages
      const totalMessages = await this.messageModel
        .countDocuments({
          conversationId,
          isDeleted: false
        });

      // Get messages per day (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentMessagesCount = await this.messageModel
        .countDocuments({
          conversationId,
          isDeleted: false,
          createdAt: { $gte: thirtyDaysAgo }
        });

      const messagesPerDay = recentMessagesCount / 30;

      // Get most active users (aggregation)
      const userActivity = await this.messageModel
        .aggregate([
          {
            $match: {
              conversationId,
              isDeleted: false
            }
          },
          {
            $group: {
              _id: '$senderId',
              messageCount: { $sum: 1 }
            }
          },
          {
            $sort: { messageCount: -1 }
          },
          {
            $limit: 10
          },
          {
            $project: {
              userId: '$_id',
              messageCount: 1,
              _id: 0
            }
          }
        ]);

      // Get message type distribution
      const typeDistribution = await this.messageModel
        .aggregate([
          {
            $match: {
              conversationId,
              isDeleted: false
            }
          },
          {
            $group: {
              _id: '$type',
              count: { $sum: 1 }
            }
          }
        ]);

      const messageTypeDistribution: Record<string, number> = {};
      typeDistribution.forEach(item => {
        messageTypeDistribution[item._id] = item.count;
      });

      return {
        totalMessages,
        messagesPerDay: Math.round(messagesPerDay * 100) / 100, // Round to 2 decimal places
        mostActiveUsers: userActivity,
        messageTypeDistribution
      };
    } catch (error) {
      this.logger.error(`Failed to get analytics for conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Find messages with filter
   */
  async findWithFilter(filter: MessageFilter): Promise<MessageDocument[]> {
    try {
      const query: any = { isDeleted: false };

      // Apply filters
      if (filter.conversationId) {
        query.conversationId = filter.conversationId;
      }

      if (filter.senderId) {
        query.senderId = filter.senderId;
      }

      if (filter.messageType) {
        query.type = filter.messageType;
      }

      if (filter.status) {
        query.status = filter.status;
      }

      if (filter.dateFrom || filter.dateTo) {
        query.createdAt = {};
        if (filter.dateFrom) {
          query.createdAt.$gte = filter.dateFrom;
        }
        if (filter.dateTo) {
          query.createdAt.$lte = filter.dateTo;
        }
      }

      if (filter.hasAttachments !== undefined) {
        if (filter.hasAttachments) {
          query['attachments.0'] = { $exists: true };
        } else {
          query.attachments = { $size: 0 };
        }
      }

      const messages = await this.messageModel
        .find(query)
        .sort({ createdAt: -1 })
        .limit(1000) // Safety limit
        .exec();

      return messages;
    } catch (error) {
      this.logger.error(`Failed to find messages with filter:`, error);
      throw error;
    }
  }

  /**
   * Find latest message in conversation
   */
  async findLatestInConversation(conversationId: string): Promise<MessageDocument | null> {
    try {
      const latestMessage = await this.messageModel
        .findOne({
          conversationId,
          isDeleted: false
        })
        .sort({ createdAt: -1 })
        .exec();

      return latestMessage;
    } catch (error) {
      this.logger.error(`Failed to find latest message in conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Find messages by sender
   */
  async findBySenderId(senderId: string, limit: number = 100): Promise<MessageDocument[]> {
    try {
      const messages = await this.messageModel
        .find({
          senderId,
          isDeleted: false
        })
        .sort({ createdAt: -1 })
        .limit(Math.min(limit, 1000)) // Safety limit
        .exec();

      return messages;
    } catch (error) {
      this.logger.error(`Failed to find messages by sender ${senderId}:`, error);
      throw error;
    }
  }

  // =============== CHAT HISTORY OPERATIONS ===============

  /**
   * Get messages before a specific message (for context loading)
   */
  async getMessagesBeforeMessage(
    conversationId: string,
    messageId: string,
    limit: number
  ): Promise<MessageDocument[]> {
    try {
      // First get the target message to get its timestamp
      const targetMessage = await this.messageModel.findById(messageId).exec();
      if (!targetMessage) {
        throw new Error(`Target message ${messageId} not found`);
      }

      const messages = await this.messageModel
        .find({
          conversationId: new Types.ObjectId(conversationId),
          createdAt: { $lt: targetMessage.createdAt },
          isDeleted: false
        })
        .sort({ createdAt: -1 }) // Latest first
        .limit(limit)
        .exec();

      return messages;
    } catch (error) {
      this.logger.error(`Failed to get messages before ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Get messages after a specific message (for context loading)
   */
  async getMessagesAfterMessage(
    conversationId: string,
    messageId: string,
    limit: number
  ): Promise<MessageDocument[]> {
    try {
      // First get the target message to get its timestamp
      const targetMessage = await this.messageModel.findById(messageId).exec();
      if (!targetMessage) {
        throw new Error(`Target message ${messageId} not found`);
      }

      const messages = await this.messageModel
        .find({
          conversationId: new Types.ObjectId(conversationId),
          createdAt: { $gt: targetMessage.createdAt },
          isDeleted: false
        })
        .sort({ createdAt: 1 }) // Oldest first
        .limit(limit)
        .exec();

      return messages;
    } catch (error) {
      this.logger.error(`Failed to get messages after ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Count total messages in conversation
   */
  async countByConversationId(conversationId: string): Promise<number> {
    try {
      const count = await this.messageModel
        .countDocuments({
          conversationId: new Types.ObjectId(conversationId),
          isDeleted: false
        })
        .exec();

      return count;
    } catch (error) {
      this.logger.error(`Failed to count messages in conversation ${conversationId}:`, error);
      throw error;
    }
  }
}
