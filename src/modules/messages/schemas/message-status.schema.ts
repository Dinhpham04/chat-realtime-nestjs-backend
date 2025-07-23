import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  MessageDeliveryStatus,
  MessageFailureInfo,
  MessageSyncInfo
} from '../types/message.types';

export type MessageStatusDocument = MessageStatus & Document;

/**
 * MessageStatus Schema - Hybrid Redis/MongoDB Model
 * Data Flow:
 * 1. Status updates write to Redis first (real-time)
 * 2. Background sync to MongoDB every 30s
 * 3. MongoDB serves historical queries (>7 days)
 * 4. Analytics và reporting từ MongoDB
 * 
 * Collection Usage:
 * - Recent status (7 days): Redis Hash structures
 * - Historical status: MongoDB documents
 * - Analytics queries: MongoDB aggregation
 * - Real-time updates: Redis pub/sub
 */
@Schema({
  timestamps: true,
  collection: 'message_status',
})
export class MessageStatus {
  _id: Types.ObjectId;

  // =============== CORE FIELDS ===============

  /**
   * Message reference - REQUIRED
   * Links status to specific message
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Message',
    required: true,
    index: true
  })
  messageId: Types.ObjectId;

  /**
   * User reference - REQUIRED
   * Which user this status belongs to
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'UserCore',
    required: true,
    index: true
  })
  userId: Types.ObjectId;

  /**
   * Delivery status - REQUIRED
   * Comprehensive status covering all real-world scenarios
   */
  @Prop({
    type: String,
    enum: Object.values(MessageDeliveryStatus),
    required: true,
    index: true
  })
  status: MessageDeliveryStatus;

  /**
   * Status timestamp - REQUIRED
   * When this status was achieved
   */
  @Prop({
    type: Date,
    required: true,
    default: Date.now,
    index: -1
  })
  timestamp: Date;

  // =============== METADATA FIELDS ===============

  /**
   * Device reference - OPTIONAL
   * Links to specific UserDevice that this status applies to
   * 
   * Design Decision:
   * - One MessageStatus per device per user per message
   * - Multi-device logic handled in service layer
   * - Simple, clear, follows Single Responsibility
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'UserDevice',
    required: false,
    index: true
  })
  deviceId?: Types.ObjectId;

  /**
   * Failure information - OPTIONAL
   * Chi tiết về lỗi khi gửi thất bại
   */
  @Prop({
    type: {
      errorCode: { type: String, maxlength: 50 }, // NETWORK_ERROR, SPAM_DETECTED, etc.
      errorMessage: { type: String, maxlength: 500 },
      retryCount: { type: Number, default: 0, min: 0 },
      maxRetries: { type: Number, default: 3 },
      nextRetryAt: { type: Date },
      permanentFailure: { type: Boolean, default: false } // Không retry nữa
    },
    default: null
  })
  failureInfo?: MessageFailureInfo;

  /**
   * Sync information - INTERNAL
   * Tracking for Redis-MongoDB sync
   */
  @Prop({
    type: {
      syncedFromRedis: { type: Boolean, default: true },
      syncTimestamp: { type: Date, default: Date.now },
      redisKey: { type: String } // Original Redis key
    },
    default: {
      syncedFromRedis: true,
      syncTimestamp: new Date()
    }
  })
  syncInfo: MessageSyncInfo;

  // Timestamps từ @Schema({ timestamps: true })
  createdAt: Date;
  updatedAt: Date;
}

export const MessageStatusSchema = SchemaFactory.createForClass(MessageStatus);

// =============== INDEXES FOR PERFORMANCE ===============

// Primary lookup indexes
MessageStatusSchema.index({ messageId: 1, userId: 1, deviceId: 1 }, { unique: true }); // One status per message per user per device
MessageStatusSchema.index({ messageId: 1, status: 1, timestamp: -1 }); // Status timeline
MessageStatusSchema.index({ userId: 1, status: 1, timestamp: -1 }); // User's read history
MessageStatusSchema.index({ userId: 1, deviceId: 1, status: 1 }); // User device status

// Analytics indexes
MessageStatusSchema.index({ status: 1, timestamp: -1 }); // Status distribution over time
MessageStatusSchema.index({ deviceId: 1, timestamp: -1 }, { sparse: true }); // Device analytics

// Cleanup indexes
MessageStatusSchema.index({ 'syncInfo.syncTimestamp': 1 }); // For cleanup jobs
MessageStatusSchema.index({ createdAt: 1 }); // TTL or archival

// =============== DOCUMENT MIDDLEWARE ===============

/**
 * Pre-save middleware
 * Validation và business logic
 */
MessageStatusSchema.pre('save', function (next) {
  // Ensure timestamp is not in future
  if (this.timestamp > new Date()) {
    this.timestamp = new Date();
  }

  // Auto-increment retry count for failed status
  if (this.status === 'failed' && this.failureInfo) {
    if (this.isModified('status') && this.failureInfo.retryCount === 0) {
      this.failureInfo.retryCount = 1;
    }

    // Set next retry time based on retry count
    if (this.failureInfo.retryCount < this.failureInfo.maxRetries) {
      const retryDelay = Math.pow(2, this.failureInfo.retryCount) * 30000; // Exponential backoff
      this.failureInfo.nextRetryAt = new Date(Date.now() + retryDelay);
    } else {
      // Max retries reached
      this.failureInfo.permanentFailure = true;
    }
  }

  // Auto-detect multi-device scenario được handle ở service layer
  if (this.isNew && this.deviceId) {
    // Service layer sẽ populate deviceId properly
  }

  // Update sync info
  this.syncInfo.syncTimestamp = new Date();

  next();
});

/**
 * =============== MIDDLEWARE ===============
 * Pre-save validation only
 */

// Enable JSON transforms
MessageStatusSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    // Remove internal sync info from API responses
    const { syncInfo, ...publicData } = ret;
    return publicData;
  }
});

MessageStatusSchema.set('toObject', { virtuals: true });
