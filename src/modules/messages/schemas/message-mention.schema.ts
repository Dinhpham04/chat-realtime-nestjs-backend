import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  MentionType,
  MentionTriggerType,
  MentionTextInfo,
  MentionContext,
  MentionNotificationStatus,
  MentionAnalytics
} from '../types/message.types';

export type MessageMentionDocument = MessageMention & Document;

/**
 * MessageMention Schema - Clean Architecture
 * 
 * 🎯 RESPONSIBILITY: ONLY mention data structure
 * 📱 Mobile-First: Fast mention lookup and notifications
 * 🚀 TypeScript: Type-safe with predefined enums
 * 
 * SINGLE RESPONSIBILITY:
 * - User mention tracking in messages
 * - Mention position in text content
 * - Notification status tracking
 * - Mention interaction analytics
 * - NO business logic, NO static methods
 * 
 * WHY SEPARATE:
 * - Mentions need different indexing than message content
 * - Different notification patterns
 * - Enable mention-specific features (mention suggestions)
 * - Better query performance for mention searches
 */
@Schema({
  timestamps: true,
  collection: 'message_mentions',
})
export class MessageMention {
  _id: Types.ObjectId;

  // =============== CORE RELATIONSHIP ===============

  /**
   * Message reference - REQUIRED
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Message',
    required: true,
    index: true
  })
  messageId: Types.ObjectId;

  /**
   * Mentioned user - REQUIRED
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'UserCore',
    required: true,
    index: true
  })
  mentionedUserId: Types.ObjectId;

  /**
   * Mentioner user - REQUIRED
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'UserCore',
    required: true,
    index: true
  })
  mentionedBy: Types.ObjectId;

  /**
   * Conversation context
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  })
  conversationId: Types.ObjectId;

  // =============== MENTION DETAILS ===============

  /**
   * Text position information
   */
  @Prop({
    type: {
      displayName: { type: String, required: true, maxlength: 50 },
      offset: { type: Number, required: true, min: 0 },
      length: { type: Number, required: true, min: 1 },
      originalText: { type: String, required: true, maxlength: 100 }
    },
    required: true
  })
  textInfo: MentionTextInfo;

  /**
   * Mention type and context
   */
  @Prop({
    type: {
      mentionType: {
        type: String,
        enum: Object.values(MentionType),
        default: MentionType.USER
      },
      isInReply: { type: Boolean, default: false },
      triggerType: {
        type: String,
        enum: Object.values(MentionTriggerType),
        default: MentionTriggerType.MANUAL
      }
    },
    default: {
      mentionType: MentionType.USER,
      isInReply: false,
      triggerType: MentionTriggerType.MANUAL
    }
  })
  mentionContext: MentionContext;

  // =============== NOTIFICATION TRACKING ===============

  /**
   * Notification status
   */
  @Prop({
    type: {
      notificationSent: { type: Boolean, default: false },
      notificationSentAt: { type: Date },
      pushNotificationSent: { type: Boolean, default: false },
      emailNotificationSent: { type: Boolean, default: false },
      isRead: { type: Boolean, default: false },
      readAt: { type: Date }
    },
    default: {
      notificationSent: false,
      pushNotificationSent: false,
      emailNotificationSent: false,
      isRead: false
    }
  })
  notificationStatus: MentionNotificationStatus;

  // =============== MENTION ANALYTICS ===============

  /**
   * Interaction tracking
   */
  @Prop({
    type: {
      clickCount: { type: Number, default: 0 }, // How many times mention was clicked
      lastClickedAt: { type: Date },
      responseTime: { type: Number }, // Time to respond to mention (seconds)
      hasResponse: { type: Boolean, default: false }
    },
    default: {
      clickCount: 0,
      hasResponse: false
    }
  })
  analytics: MentionAnalytics;

  // Timestamps từ @Schema({ timestamps: true })
  createdAt: Date;
  updatedAt: Date;
}

export const MessageMentionSchema = SchemaFactory.createForClass(MessageMention);

// =============== INDEXES FOR PERFORMANCE ===============

// Core lookup indexes
MessageMentionSchema.index({ messageId: 1 }); // Get mentions for message
MessageMentionSchema.index({ mentionedUserId: 1, createdAt: -1 }); // User's mentions
MessageMentionSchema.index({ conversationId: 1, mentionedUserId: 1, createdAt: -1 }); // User mentions in conversation

// Notification indexes
MessageMentionSchema.index({
  mentionedUserId: 1,
  'notificationStatus.isRead': 1,
  createdAt: -1
}); // Unread mentions

MessageMentionSchema.index({
  'notificationStatus.notificationSent': 1,
  createdAt: -1
}, { sparse: true }); // Pending notifications

// Analytics indexes
MessageMentionSchema.index({ mentionedBy: 1, createdAt: -1 }); // Who mentions most
MessageMentionSchema.index({ 'mentionContext.mentionType': 1, createdAt: -1 }); // Mention type analytics

// =============== VIRTUAL FIELDS ===============

/**
 * Check if mention is unread
 */
MessageMentionSchema.virtual('isUnread').get(function () {
  return !this.notificationStatus.isRead;
});

/**
 * Get mention age in hours
 */
MessageMentionSchema.virtual('ageInHours').get(function () {
  const now = new Date();
  const diffMs = now.getTime() - this.createdAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60));
});

/**
 * Check if mention needs notification
 */
MessageMentionSchema.virtual('needsNotification').get(function () {
  return !this.notificationStatus.notificationSent;
});

// =============== DOCUMENT MIDDLEWARE ===============

/**
 * Pre-save middleware
 */
MessageMentionSchema.pre('save', function (next) {
  // Validate text position
  if (this.textInfo.offset < 0 || this.textInfo.length <= 0) {
    throw new Error('Invalid mention position');
  }

  // Set notification timestamp when marking as sent
  if (this.isModified('notificationStatus.notificationSent') &&
    this.notificationStatus.notificationSent &&
    !this.notificationStatus.notificationSentAt) {
    this.notificationStatus.notificationSentAt = new Date();
  }

  // Set read timestamp when marking as read
  if (this.isModified('notificationStatus.isRead') &&
    this.notificationStatus.isRead &&
    !this.notificationStatus.readAt) {
    this.notificationStatus.readAt = new Date();
  }

  next();
});

/**
 * =============== MIDDLEWARE ===============
 * Pre-save validation only  
 */

// Enable virtuals in JSON
MessageMentionSchema.set('toJSON', { virtuals: true });
MessageMentionSchema.set('toObject', { virtuals: true });
