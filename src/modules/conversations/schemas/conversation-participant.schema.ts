import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  ParticipantRole,
  NotificationLevel,
  ParticipantSettings
} from '../types/conversation.types';

export type ConversationParticipantDocument = ConversationParticipant & Document;

/**
 * ConversationParticipant Schema - Clean Architecture
 * 
 * 🎯 RESPONSIBILITY: ONLY participant data structure
 * 📱 Mobile-First: User-specific conversation settings
 * 🚀 TypeScript: Type-safe with predefined enums
 * 
 * SINGLE RESPONSIBILITY:
 * - User participation tracking (join/leave timestamps)
 * - Participant role and permissions
 * - User-specific conversation settings
 * - NO business logic, NO static methods
 */
@Schema({
  timestamps: true,
  collection: 'conversation_participants',
})
export class ConversationParticipant {
  _id: Types.ObjectId;

  // =============== CORE RELATIONSHIP ===============

  /**
   * Conversation reference - REQUIRED
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  })
  conversationId: Types.ObjectId;

  /**
   * User reference - REQUIRED
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'UserCore',
    required: true,
    index: true
  })
  userId: Types.ObjectId;

  // =============== PARTICIPATION STATUS ===============

  /**
   * Participant role trong conversation
   */
  @Prop({
    type: String,
    enum: Object.values(ParticipantRole),
    default: ParticipantRole.MEMBER,
    index: true
  })
  role: ParticipantRole;

  /**
   * When user joined conversation
   */
  @Prop({
    type: Date,
    default: Date.now,
    required: true
  })
  joinedAt: Date;

  /**
   * When user left conversation (null = still active)
   */
  @Prop({
    type: Date,
    default: null
  })
  leftAt?: Date;

  /**
   * Who added this user to conversation
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'UserCore',
    required: true
  })
  addedBy: Types.ObjectId;

  // =============== USER-SPECIFIC CONVERSATION SETTINGS ===============

  /**
   * User's conversation settings - per participant
   */
  @Prop({
    type: {
      isMuted: { type: Boolean, default: false },
      muteUntil: { type: Date, default: null },
      isArchived: { type: Boolean, default: false },
      isPinned: { type: Boolean, default: false },
      customName: { type: String, maxlength: 100, default: null },
      notificationLevel: {
        type: String,
        enum: Object.values(NotificationLevel),
        default: NotificationLevel.ALL
      }
    },
    default: {
      isMuted: false,
      isArchived: false,
      isPinned: false,
      notificationLevel: NotificationLevel.ALL
    }
  })
  settings: ParticipantSettings;

  /**
   * Last read message tracking - DEPRECATED
   * TODO: Remove after migrating to MessageStatus schema
   * Use MessageStatus collection for detailed per-message read tracking
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Message',
    default: null
  })
  lastReadMessageId?: Types.ObjectId;

  /**
   * Last read timestamp - DEPRECATED  
   * TODO: Remove after migrating to MessageStatus schema
   */
  @Prop({
    type: Date,
    default: null
  })
  lastReadAt?: Date;

  // =============== READ STATUS - TO BE REMOVED ===============
  // TODO: Remove readStatus field completely
  // Use MessageStatus collection instead for:
  // - Detailed per-message read tracking
  // - Multi-device support  
  // - Consistent data model
  // - Better scalability

  // Timestamps từ @Schema({ timestamps: true })
  createdAt: Date;
  updatedAt: Date;
}

export const ConversationParticipantSchema = SchemaFactory.createForClass(ConversationParticipant);

// =============== INDEXES FOR PERFORMANCE ===============

// Composite index for unique constraint
ConversationParticipantSchema.index(
  { conversationId: 1, userId: 1 },
  { unique: true }
);

// Query optimization indexes
ConversationParticipantSchema.index({ userId: 1, leftAt: 1 }); // User's active conversations
ConversationParticipantSchema.index({ conversationId: 1, role: 1, leftAt: 1 }); // Conversation admins
ConversationParticipantSchema.index({ userId: 1, 'settings.isPinned': 1 }); // User's pinned conversations
ConversationParticipantSchema.index({ userId: 1, 'settings.isArchived': 1 }); // User's archived conversations

// =============== VIRTUAL FIELDS ===============

/**
 * Check if participant is currently active
 */
ConversationParticipantSchema.virtual('isActive').get(function () {
  return this.leftAt === null || this.leftAt === undefined;
});

/**
 * Check if user is admin or owner
 */
ConversationParticipantSchema.virtual('isAdminOrOwner').get(function () {
  return ['admin', 'owner'].includes(this.role);
});

/**
 * Get unread message count - computed from MessageStatus collection
 * TODO: Implement in service layer by querying MessageStatus:
 * 1. Find latest message in conversation
 * 2. Check user's MessageStatus for that conversation's messages
 * 3. Count messages where status != 'READ'
 */
ConversationParticipantSchema.virtual('unreadCount').get(function () {
  // Will be computed in service layer using MessageStatus collection
  return 0;
});

/**
 * Get last read info - computed from MessageStatus collection  
 * TODO: Implement in service layer by querying MessageStatus:
 * 1. Find latest MessageStatus with status='READ' for this user
 * 2. Return messageId and timestamp
 */
ConversationParticipantSchema.virtual('lastReadInfo').get(function () {
  // Will be computed in service layer using MessageStatus collection
  return {
    lastReadMessageId: null,
    lastReadAt: null
  };
});

// =============== DOCUMENT MIDDLEWARE ===============

/**
 * Pre-save middleware
 * Basic validation only
 */
ConversationParticipantSchema.pre('save', function (next) {
  // If user is leaving, set leftAt timestamp
  if (this.isModified('leftAt') && this.leftAt) {
    // Clear user-specific settings when leaving
    this.lastReadMessageId = undefined;
    this.lastReadAt = undefined;
  }

  next();
});

// =============== SCHEMA CONFIGURATION ===============

// Enable virtuals in JSON
ConversationParticipantSchema.set('toJSON', { virtuals: true });
ConversationParticipantSchema.set('toObject', { virtuals: true });

// NOTE: Static methods moved to Repository layer following Clean Architecture
