/**
 * Message Repository Implementation
 * 
 * 🎯 Purpose: MongoDB implementation of message data operations  
 * 📱 Mobile-First: Optimized queries for real-time messaging
 * 🚀 Clean Architecture: Repository pattern with error handling
 * 
 * Design Principles:
 * - Single Responsibility: Only message data operations
 * - DRY: Reuse types from message.types.ts (Single Source of Truth)
 * - Error Handling: Comprehensive error handling and logging
 * - Performance: Optimized queries with indexes and pagination
 * - Security: Input validation and sanitization
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Message,
  MessageDocument,
  MessageStatus,
  MessageStatusDocument
} from '../schemas';
import {
  IMessageRepository,
  RepositoryPaginationParams,
  RepositorySearchQuery,
  BulkOperationResult,
  MessageWithAttachments
} from '../interfaces/message-repository.interface';
import {
  CreateMessageData,
  UpdateMessageData,
  MessageListResponse,
  MessageDeliveryStatus,
  MessageType,
  MessageInfo,
  ReactionType,
  isValidMessageContent
} from '../types/message.types';

/**
 * Custom Repository Errors for better error handling
 */
export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

@Injectable()
export class MessageRepository implements IMessageRepository {
  private readonly logger = new Logger(MessageRepository.name);

  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(MessageStatus.name) private statusModel: Model<MessageStatusDocument>,
  ) { }

  // =============== CRUD OPERATIONS ===============

  async create(messageData: CreateMessageData): Promise<Message> {
    try {
      this.logger.debug(`Creating message in conversation: ${messageData.conversationId}`);

      // Validation using private method
      this.validateCreateMessageData(messageData);

      // Transform data for MongoDB using correct field names from CreateMessageData
      const messageDoc = new this.messageModel({
        conversationId: new Types.ObjectId(messageData.conversationId),
        senderId: new Types.ObjectId(messageData.senderId),
        messageType: messageData.messageType,
        content: messageData.content?.text || null,
        replyTo: messageData.replyToMessageId ? new Types.ObjectId(messageData.replyToMessageId) : undefined,
        isSystemMessage: messageData.messageType === MessageType.SYSTEM,
        systemData: messageData.systemData,
        locationData: messageData.locationData,
        // Add metadata if needed
        ...(messageData.metadata && { metadata: messageData.metadata })
      });

      const savedMessage = await messageDoc.save();

      this.logger.debug(`Message created successfully: ${savedMessage._id}`);
      return savedMessage.toObject();
    } catch (error) {
      this.logger.error(`Failed to create message: ${error.message}`, error.stack);
      throw new RepositoryError(
        'Failed to create message',
        'MESSAGE_CREATE_FAILED',
        error
      );
    }
  }

  async findById(messageId: string): Promise<Message | null> {
    try {
      this.logger.debug(`Finding message by ID: ${messageId}`);

      if (!Types.ObjectId.isValid(messageId)) {
        return null;
      }

      const message = await this.messageModel
        .findById(messageId)
        .lean()
        .exec();

      return message || null;
    } catch (error) {
      this.logger.error(`Failed to find message by ID: ${error.message}`, error.stack);
      throw new RepositoryError(
        'Failed to find message',
        'MESSAGE_FIND_FAILED',
        error
      );
    }
  }

  async update(messageId: string, updateData: UpdateMessageData): Promise<Message> {
    try {
      this.logger.debug(`Updating message: ${messageId}`);

      if (!Types.ObjectId.isValid(messageId)) {
        throw new Error('Invalid message ID');
      }

      // Validation
      if (updateData.content && !isValidMessageContent(updateData.content.text)) {
        throw new Error('Invalid message content');
      }

      const updateFields: any = {};
      if (updateData.content !== undefined) {
        updateFields.content = updateData.content;
        updateFields.isEdited = true;
        updateFields.editedAt = new Date();
      }

      const updatedMessage = await this.messageModel
        .findByIdAndUpdate(
          messageId,
          { $set: updateFields },
          { new: true, lean: true }
        )
        .exec();

      if (!updatedMessage) {
        throw new Error('Message not found');
      }

      this.logger.debug(`Message updated successfully: ${messageId}`);
      return updatedMessage;
    } catch (error) {
      this.logger.error(`Failed to update message: ${error.message}`, error.stack);
      throw new RepositoryError(
        'Failed to update message',
        'MESSAGE_UPDATE_FAILED',
        error
      );
    }
  }

  async softDelete(messageId: string): Promise<boolean> {
    try {
      this.logger.debug(`Soft deleting message: ${messageId}`);

      const result = await this.messageModel
        .updateOne(
          { _id: messageId },
          { $set: { isDeleted: true, deletedAt: new Date() } }
        )
        .exec();

      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to soft delete message: ${error.message}`, error.stack);
      throw new RepositoryError(
        'Failed to delete message',
        'MESSAGE_DELETE_FAILED',
        error
      );
    }
  }

  async hardDelete(messageId: string): Promise<boolean> {
    try {
      this.logger.debug(`Hard deleting message: ${messageId}`);

      const result = await this.messageModel
        .deleteOne({ _id: messageId })
        .exec();

      // Also delete related status records
      await this.statusModel
        .deleteMany({ messageId })
        .exec();

      return result.deletedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to hard delete message: ${error.message}`, error.stack);
      throw new RepositoryError(
        'Failed to permanently delete message',
        'MESSAGE_HARD_DELETE_FAILED',
        error
      );
    }
  }

  // =============== CONVERSATION QUERIES ===============

  async findByConversation(
    conversationId: string,
    options: RepositoryPaginationParams
  ): Promise<MessageListResponse> {
    try {
      this.logger.debug(`Finding messages for conversation: ${conversationId}`);

      if (!Types.ObjectId.isValid(conversationId)) {
        throw new Error('Invalid conversation ID');
      }

      const limit = Math.min(options.limit || 50, 100); // Max 100 messages per request
      const query: any = { conversationId: new Types.ObjectId(conversationId) };

      // Include deleted messages if specified
      if (!options.includeDeleted) {
        query.isDeleted = { $ne: true };
      }

      // Include system messages if specified
      if (!options.includeSystemMessages) {
        query.isSystemMessage = { $ne: true };
      }

      // Cursor-based pagination using beforeMessageId/afterMessageId
      if (options.beforeMessageId) {
        const beforeMessage = await this.messageModel.findById(options.beforeMessageId);
        if (beforeMessage) {
          query.createdAt = { $lt: beforeMessage.createdAt };
        }
      }

      if (options.afterMessageId) {
        const afterMessage = await this.messageModel.findById(options.afterMessageId);
        if (afterMessage) {
          query.createdAt = { $gt: afterMessage.createdAt };
        }
      }

      const messages = await this.messageModel
        .find(query)
        .sort({ createdAt: options.sortOrder === 'asc' ? 1 : -1 })
        .limit(limit + 1) // +1 to check if there are more
        .lean()
        .exec();

      const hasMore = messages.length > limit;
      if (hasMore) {
        messages.pop(); // Remove the extra message
      }

      // Transform MongoDB documents to MessageInfo interface
      const transformedMessages = messages.slice(0, limit).map(msg => this.transformToMessageInfo(msg));

      return {
        messages: transformedMessages,
        hasMore,
        hasNewer: false, // Will be calculated based on query type
        oldestMessageId: transformedMessages.length > 0 ? messages[transformedMessages.length - 1]._id.toString() : undefined,
        newestMessageId: transformedMessages.length > 0 ? messages[0]._id.toString() : undefined
      };
    } catch (error) {
      this.logger.error(`Failed to find conversation messages: ${error.message}`, error.stack);
      throw new RepositoryError(
        'Failed to fetch conversation messages',
        'CONVERSATION_MESSAGES_FAILED',
        error
      );
    }
  }

  async getLatestMessage(conversationId: string): Promise<Message | null> {
    try {
      if (!Types.ObjectId.isValid(conversationId)) {
        return null;
      }

      const message = await this.messageModel
        .findOne({
          conversationId: new Types.ObjectId(conversationId),
          isDeleted: { $ne: true }
        })
        .sort({ createdAt: -1 })
        .lean()
        .exec();

      return message || null;
    } catch (error) {
      this.logger.error(`Failed to get latest message: ${error.message}`, error.stack);
      throw new RepositoryError(
        'Failed to get latest message',
        'LATEST_MESSAGE_FAILED',
        error
      );
    }
  }

  async countByConversation(conversationId: string, includeDeleted = false): Promise<number> {
    try {
      if (!Types.ObjectId.isValid(conversationId)) {
        return 0;
      }

      const query: any = { conversationId: new Types.ObjectId(conversationId) };
      if (!includeDeleted) {
        query.isDeleted = { $ne: true };
      }

      return await this.messageModel.countDocuments(query).exec();
    } catch (error) {
      this.logger.error(`Failed to count messages: ${error.message}`, error.stack);
      throw new RepositoryError(
        'Failed to count messages',
        'MESSAGE_COUNT_FAILED',
        error
      );
    }
  }

  // =============== ADVANCED QUERIES ===============

  async findWithAttachments(messageId: string): Promise<MessageWithAttachments | null> {
    try {
      // For now, return basic message using MessageWithDetails structure
      // Will be enhanced when Files module is integrated
      const message = await this.findById(messageId);
      if (!message) {
        return null;
      }

      // Transform to MessageInfo for MessageWithDetails interface
      const messageInfo = this.transformToMessageInfo(message);

      // Return using MessageWithDetails structure as base for MessageWithAttachments
      return {
        message: messageInfo,
        mentions: [], // Will be populated when Mentions are integrated
        reactions: {
          messageId,
          reactions: {} as Record<ReactionType, {
            count: number;
            users: readonly string[];
            latestAt: Date;
          }>,
          totalReactions: 0
        }, // Will be populated
        attachments: [], // Will be populated when Files module is ready
        deliveryStatus: undefined // Will be populated
      } as MessageWithAttachments;
    } catch (error) {
      this.logger.error(`Failed to find message with attachments: ${error.message}`, error.stack);
      throw new RepositoryError(
        'Failed to find message with attachments',
        'MESSAGE_WITH_ATTACHMENTS_FAILED',
        error
      );
    }
  }

  async findReplies(parentMessageId: string): Promise<Message[]> {
    try {
      if (!Types.ObjectId.isValid(parentMessageId)) {
        return [];
      }

      const replies = await this.messageModel
        .find({
          replyTo: new Types.ObjectId(parentMessageId),
          isDeleted: { $ne: true }
        })
        .sort({ createdAt: 1 })
        .lean()
        .exec();

      return replies;
    } catch (error) {
      this.logger.error(`Failed to find replies: ${error.message}`, error.stack);
      throw new RepositoryError(
        'Failed to find replies',
        'REPLIES_FIND_FAILED',
        error
      );
    }
  }

  async searchMessages(query: RepositorySearchQuery): Promise<MessageListResponse> {
    try {
      this.logger.debug(`Searching messages with query: ${JSON.stringify(query)}`);

      const searchQuery: any = {};
      const limit = Math.min(query.limit || 20, 50);

      // Build search query based on RepositorySearchQuery (extends MessageSearchOptions)
      if (query.query) {
        searchQuery.$text = { $search: query.query };
      }

      if (query.messageTypes && query.messageTypes.length > 0) {
        searchQuery.messageType = { $in: query.messageTypes };
      }

      if (query.senderId) {
        searchQuery.senderId = new Types.ObjectId(query.senderId);
      }

      if (query.dateRange) {
        searchQuery.createdAt = {
          $gte: query.dateRange.from,
          $lte: query.dateRange.to
        };
      }

      if (!query.includeDeleted) {
        searchQuery.isDeleted = { $ne: true };
      }

      const messages = await this.messageModel
        .find(searchQuery)
        .sort({ createdAt: -1 })
        .limit(limit + 1)
        .lean()
        .exec();

      const hasMore = messages.length > limit;
      if (hasMore) {
        messages.pop();
      }

      // Transform MongoDB documents to MessageInfo
      const transformedMessages = messages.slice(0, limit).map(msg => this.transformToMessageInfo(msg));

      return {
        messages: transformedMessages,
        hasMore,
        hasNewer: false,
        oldestMessageId: messages.length > 0 ? messages[messages.length - 1]._id.toString() : undefined,
        newestMessageId: messages.length > 0 ? messages[0]._id.toString() : undefined
      };
    } catch (error) {
      this.logger.error(`Failed to search messages: ${error.message}`, error.stack);
      throw new RepositoryError(
        'Failed to search messages',
        'MESSAGE_SEARCH_FAILED',
        error
      );
    }
  }

  async findBySender(senderId: string, options: RepositoryPaginationParams): Promise<MessageListResponse> {
    try {
      if (!Types.ObjectId.isValid(senderId)) {
        return { messages: [], hasMore: false, hasNewer: false };
      }

      // Use searchMessages with senderId filter - provide required 'query' field
      return this.searchMessages({
        query: '', // Empty query means search all
        senderId,
        limit: options.limit || 50,
        offset: 0,
        includeDeleted: options.includeDeleted
      });
    } catch (error) {
      this.logger.error(`Failed to find messages by sender: ${error.message}`, error.stack);
      throw new RepositoryError(
        'Failed to find messages by sender',
        'SENDER_MESSAGES_FAILED',
        error
      );
    }
  }

  // =============== STATUS OPERATIONS ===============

  async updateDeliveryStatus(
    messageId: string,
    userId: string,
    status: MessageDeliveryStatus,
    deviceId?: string
  ): Promise<boolean> {
    try {
      this.logger.debug(`Updating delivery status for message ${messageId}, user ${userId}: ${status}`);

      const statusDoc = await this.statusModel.findOneAndUpdate(
        { messageId: new Types.ObjectId(messageId), userId: new Types.ObjectId(userId) },
        {
          $set: {
            status,
            timestamp: new Date(),
            ...(deviceId && { deviceId: new Types.ObjectId(deviceId) })
          }
        },
        { upsert: true, new: true }
      ).exec();

      return !!statusDoc;
    } catch (error) {
      this.logger.error(`Failed to update delivery status: ${error.message}`, error.stack);
      throw new RepositoryError(
        'Failed to update delivery status',
        'STATUS_UPDATE_FAILED',
        error
      );
    }
  }

  async getMessageStatus(messageId: string, userId: string): Promise<MessageStatus | null> {
    try {
      if (!Types.ObjectId.isValid(messageId) || !Types.ObjectId.isValid(userId)) {
        return null;
      }

      const status = await this.statusModel
        .findOne({
          messageId: new Types.ObjectId(messageId),
          userId: new Types.ObjectId(userId)
        })
        .lean()
        .exec();

      return status || null;
    } catch (error) {
      this.logger.error(`Failed to get message status: ${error.message}`, error.stack);
      throw new RepositoryError(
        'Failed to get message status',
        'STATUS_GET_FAILED',
        error
      );
    }
  }

  async getAllMessageStatuses(messageId: string): Promise<MessageStatus[]> {
    try {
      if (!Types.ObjectId.isValid(messageId)) {
        return [];
      }

      const statuses = await this.statusModel
        .find({ messageId: new Types.ObjectId(messageId) })
        .lean()
        .exec();

      return statuses;
    } catch (error) {
      this.logger.error(`Failed to get all message statuses: ${error.message}`, error.stack);
      throw new RepositoryError(
        'Failed to get all message statuses',
        'ALL_STATUSES_GET_FAILED',
        error
      );
    }
  }

  async markMultipleAsRead(messageIds: string[], userId: string): Promise<BulkOperationResult> {
    try {
      this.logger.debug(`Marking ${messageIds.length} messages as read for user ${userId}`);

      const validIds = messageIds.filter(id => Types.ObjectId.isValid(id));
      if (validIds.length === 0) {
        return { success: false, modifiedCount: 0, errors: ['No valid message IDs provided'] };
      }

      const operations = validIds.map(messageId => ({
        updateOne: {
          filter: {
            messageId: new Types.ObjectId(messageId),
            userId: new Types.ObjectId(userId)
          },
          update: {
            $set: {
              status: MessageDeliveryStatus.READ,
              timestamp: new Date()
            }
          },
          upsert: true
        }
      }));

      const result = await this.statusModel.bulkWrite(operations);

      return {
        success: true,
        modifiedCount: result.modifiedCount + result.upsertedCount
      };
    } catch (error) {
      this.logger.error(`Failed to mark multiple messages as read: ${error.message}`, error.stack);
      return {
        success: false,
        modifiedCount: 0,
        errors: [error.message]
      };
    }
  }

  // =============== BULK OPERATIONS ===============

  async createMultiple(messagesData: CreateMessageData[]): Promise<Message[]> {
    try {
      this.logger.debug(`Creating ${messagesData.length} messages in bulk`);

      // Validate all messages first
      messagesData.forEach(data => this.validateCreateMessageData(data));

      const docs = messagesData.map(data => ({
        conversationId: new Types.ObjectId(data.conversationId),
        senderId: new Types.ObjectId(data.senderId),
        messageType: data.messageType,
        content: data.content?.text || null,
        replyTo: data.replyToMessageId ? new Types.ObjectId(data.replyToMessageId) : undefined,
        isSystemMessage: data.messageType === MessageType.SYSTEM,
        systemData: data.systemData,
        locationData: data.locationData
      }));

      const savedMessages = await this.messageModel.insertMany(docs);
      return savedMessages.map(msg => msg.toObject());
    } catch (error) {
      this.logger.error(`Failed to create multiple messages: ${error.message}`, error.stack);
      throw new RepositoryError(
        'Failed to create multiple messages',
        'BULK_CREATE_FAILED',
        error
      );
    }
  }

  async softDeleteMultiple(messageIds: string[]): Promise<BulkOperationResult> {
    try {
      const validIds = messageIds.filter(id => Types.ObjectId.isValid(id));

      const result = await this.messageModel.updateMany(
        { _id: { $in: validIds.map(id => new Types.ObjectId(id)) } },
        { $set: { isDeleted: true, deletedAt: new Date() } }
      ).exec();

      return {
        success: true,
        modifiedCount: result.modifiedCount
      };
    } catch (error) {
      this.logger.error(`Failed to soft delete multiple messages: ${error.message}`, error.stack);
      return {
        success: false,
        modifiedCount: 0,
        errors: [error.message]
      };
    }
  }

  async updateMultiple(updates: Array<{ messageId: string; updateData: UpdateMessageData }>): Promise<BulkOperationResult> {
    try {
      const operations = updates
        .filter(update => Types.ObjectId.isValid(update.messageId))
        .map(update => ({
          updateOne: {
            filter: { _id: new Types.ObjectId(update.messageId) },
            update: { $set: update.updateData }
          }
        }));

      const result = await this.messageModel.bulkWrite(operations);

      return {
        success: true,
        modifiedCount: result.modifiedCount
      };
    } catch (error) {
      this.logger.error(`Failed to update multiple messages: ${error.message}`, error.stack);
      return {
        success: false,
        modifiedCount: 0,
        errors: [error.message]
      };
    }
  }

  // =============== ANALYTICS & REPORTING ===============

  async getConversationStats(
    conversationId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{
    totalMessages: number;
    messagesByType: Record<string, number>;
    messagesBySender: Record<string, number>;
    deletedMessages: number;
  }> {
    try {
      if (!Types.ObjectId.isValid(conversationId)) {
        throw new Error('Invalid conversation ID');
      }

      const matchStage: any = { conversationId: new Types.ObjectId(conversationId) };
      if (dateFrom || dateTo) {
        matchStage.createdAt = {};
        if (dateFrom) matchStage.createdAt.$gte = dateFrom;
        if (dateTo) matchStage.createdAt.$lte = dateTo;
      }

      const [totalResult, typeResult, senderResult, deletedResult] = await Promise.all([
        // Total messages
        this.messageModel.countDocuments({ ...matchStage, isDeleted: { $ne: true } }),

        // Messages by type
        this.messageModel.aggregate([
          { $match: { ...matchStage, isDeleted: { $ne: true } } },
          { $group: { _id: '$messageType', count: { $sum: 1 } } }
        ]),

        // Messages by sender
        this.messageModel.aggregate([
          { $match: { ...matchStage, isDeleted: { $ne: true } } },
          { $group: { _id: '$senderId', count: { $sum: 1 } } }
        ]),

        // Deleted messages
        this.messageModel.countDocuments({ ...matchStage, isDeleted: true })
      ]);

      const messagesByType = typeResult.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});

      const messagesBySender = senderResult.reduce((acc, item) => {
        acc[item._id.toString()] = item.count;
        return acc;
      }, {});

      return {
        totalMessages: totalResult,
        messagesByType,
        messagesBySender,
        deletedMessages: deletedResult
      };
    } catch (error) {
      this.logger.error(`Failed to get conversation stats: ${error.message}`, error.stack);
      throw new RepositoryError(
        'Failed to get conversation statistics',
        'CONVERSATION_STATS_FAILED',
        error
      );
    }
  }

  async getUserActivity(
    userId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{
    messagesSent: number;
    conversationsActive: number;
    averageMessagesPerDay: number;
  }> {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID');
      }

      const matchStage: any = {
        senderId: new Types.ObjectId(userId),
        isDeleted: { $ne: true }
      };

      if (dateFrom || dateTo) {
        matchStage.createdAt = {};
        if (dateFrom) matchStage.createdAt.$gte = dateFrom;
        if (dateTo) matchStage.createdAt.$lte = dateTo;
      }

      const [messagesSent, conversationsActive] = await Promise.all([
        this.messageModel.countDocuments(matchStage),
        this.messageModel.distinct('conversationId', matchStage).then(ids => ids.length)
      ]);

      // Calculate average messages per day
      const daysDiff = dateFrom && dateTo
        ? Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24))
        : 1;
      const averageMessagesPerDay = daysDiff > 0 ? messagesSent / daysDiff : messagesSent;

      return {
        messagesSent,
        conversationsActive,
        averageMessagesPerDay: Math.round(averageMessagesPerDay * 100) / 100
      };
    } catch (error) {
      this.logger.error(`Failed to get user activity: ${error.message}`, error.stack);
      throw new RepositoryError(
        'Failed to get user activity',
        'USER_ACTIVITY_FAILED',
        error
      );
    }
  }

  // =============== PRIVATE HELPER METHODS ===============

  private validateCreateMessageData(data: CreateMessageData): void {
    if (!data.conversationId) {
      throw new Error('conversationId is required');
    }
    if (!data.senderId) {
      throw new Error('senderId is required');
    }
    if (!data.messageType) {
      throw new Error('messageType is required');
    }
    if (data.messageType === MessageType.TEXT && (!data.content?.text || !isValidMessageContent(data.content.text))) {
      throw new Error('Text messages must have valid content');
    }
    if (!Types.ObjectId.isValid(data.conversationId)) {
      throw new Error('Invalid conversationId format');
    }
    if (!Types.ObjectId.isValid(data.senderId)) {
      throw new Error('Invalid senderId format');
    }
    if (data.replyToMessageId && !Types.ObjectId.isValid(data.replyToMessageId)) {
      throw new Error('Invalid replyToMessageId format');
    }
  }

  /**
   * Transform MongoDB document to MessageInfo interface
   */
  private transformToMessageInfo(doc: any): MessageInfo {
    return {
      conversationId: doc.conversationId.toString(),
      senderId: doc.senderId.toString(),
      messageType: doc.messageType,
      content: doc.content || '', // MessageInfo requires content to be string, not optional
      systemData: doc.systemData,
      replyToMessageId: doc.replyTo?.toString(),
      editedAt: doc.editedAt,
      isEdited: doc.isEdited,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }

  /**
   * Transform MongoDB document to Message schema (for direct repository operations)
   */
  private transformToMessage(doc: any): Message {
    return {
      ...doc,
      _id: doc._id,
      conversationId: doc.conversationId,
      senderId: doc.senderId,
      replyTo: doc.replyTo
    };
  }
}
