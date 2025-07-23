import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  ReactionEmojiInfo,
  ReactionMetadata,
  ReactionTracking,
  ReactionAnalytics,
  Platform,
  ReactionInputMethod,
  EmojiCategory
} from '../types/message.types';

export type MessageReactionDocument = MessageReaction & Document;

/**
 * MessageReaction Schema - Single Responsibility Architecture
 * 
 * 🎯 Purpose: Message emoji reactions và engagement tracking
 * 📱 Mobile-First: Optimized for real-time reaction updates
 * 🚀 Clean Architecture: Pure data structure, no business logic
 * 
 * RESPONSIBILITY (Single Purpose):
 * - Emoji reaction tracking và management
 * - User engagement analytics
 * - Reaction timing và behavior analysis
 * - Platform-specific reaction patterns
 * 
 * DESIGN PRINCIPLES:
 * - Single Responsibility: Only data structure definition
 * - Open/Closed: Extensible via types, closed for modification
 * - Interface Segregation: Proper type interfaces
 * - Dependency Inversion: Depends on abstractions (interfaces)
 * 
 * SEPARATION OF CONCERNS:
 * - Schema: Data structure definition only
 * - Repository: Data access operations
 * - Service: Business logic và validation
 * - Controller: HTTP handling
 */
@Schema({
  timestamps: true,
  collection: 'message_reactions',
  // Performance optimization
  optimisticConcurrency: true,
  // JSON optimization for mobile
  toJSON: {
    virtuals: true,
    transform: (doc: any, ret: any) => {
      if (ret.__v !== undefined) delete ret.__v;
      return ret;
    }
  }
})
export class MessageReaction {
  _id: Types.ObjectId;

  // =============== CORE RELATIONSHIPS ===============
  // Following RESTful resource design

  /**
   * Message reference - REQUIRED
   * Immutable relationship for data integrity
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Message',
    required: true,
    index: true,
    immutable: true // Data integrity
  })
  messageId: Types.ObjectId;

  /**
   * Reactor user reference - REQUIRED
   * Who added the reaction
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'UserCore',
    required: true,
    index: true,
    immutable: true // Audit trail integrity
  })
  userId: Types.ObjectId;

  /**
   * Message author reference - REQUIRED
   * For engagement analytics
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'UserCore',
    required: true,
    index: true,
    immutable: true
  })
  messageAuthorId: Types.ObjectId;

  /**
   * Conversation context - REQUIRED
   * For conversation-level engagement analytics
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true,
    immutable: true
  })
  conversationId: Types.ObjectId;

  // =============== EMOJI INFORMATION ===============
  // Comprehensive emoji data management

  /**
   * Emoji reaction information
   * Unicode, category, và metadata
   */
  @Prop({
    type: {
      emoji: {
        type: String,
        required: true,
        trim: true,
        maxlength: 10, // Unicode emoji limit
        immutable: true // Reaction consistency
      },
      emojiCode: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50,
        immutable: true
      },
      unicodeVersion: {
        type: String,
        maxlength: 10,
        immutable: true
      },
      category: {
        type: String,
        enum: Object.values(EmojiCategory),
        default: EmojiCategory.SMILEYS,
        index: true, // Category analytics
        immutable: true
      },
      isCustomEmoji: {
        type: Boolean,
        default: false,
        immutable: true
      },
      customEmojiId: {
        type: Types.ObjectId,
        ref: 'CustomEmoji' // For custom emoji tracking
      }
    },
    required: true,
    _id: false // No sub-document ID needed
  })
  emojiInfo: ReactionEmojiInfo;

  // =============== REACTION METADATA ===============
  // Rich context information for analytics

  /**
   * Reaction metadata và context
   * Platform, method, và interaction details
   */
  @Prop({
    type: {
      platform: {
        type: String,
        enum: Object.values(Platform),
        default: Platform.MOBILE,
        index: true // Platform analytics
      },
      inputMethod: {
        type: String,
        enum: Object.values(ReactionInputMethod),
        default: ReactionInputMethod.CLICK,
        index: true // Input method analytics
      },
      deviceType: {
        type: String,
        maxlength: 50
      },
      isQuickReaction: {
        type: Boolean,
        default: false,
        index: true // Quick reaction analytics
      },
      reactionSource: {
        type: String,
        enum: ['picker', 'quick_bar', 'keyboard', 'suggestion'],
        default: 'picker',
        index: true
      }
    },
    default: {
      platform: Platform.MOBILE,
      inputMethod: ReactionInputMethod.CLICK,
      isQuickReaction: false,
      reactionSource: 'picker'
    },
    _id: false
  })
  metadata: ReactionMetadata;

  // =============== TRACKING INFORMATION ===============
  // State và interaction tracking

  /**
   * Reaction state tracking
   * Active status và interaction history
   */
  @Prop({
    type: {
      isActive: {
        type: Boolean,
        default: true,
        index: true // Active reactions queries
      },
      wasRemoved: {
        type: Boolean,
        default: false,
        index: true // Removed reactions analytics
      },
      removedAt: {
        type: Date,
        sparse: true // Only index when present
      },
      removalReason: {
        type: String,
        enum: ['user_removed', 'auto_cleanup', 'moderation'],
        sparse: true
      },
      lastModifiedBy: {
        type: Types.ObjectId,
        ref: 'UserCore'
      }
    },
    default: {
      isActive: true,
      wasRemoved: false
    },
    _id: false
  })
  tracking: ReactionTracking;

  // =============== ANALYTICS DATA ===============
  // Performance và behavior analytics

  /**
   * Reaction analytics và metrics
   * Timing, context, và behavioral data
   */
  @Prop({
    type: {
      reactionDelay: {
        type: Number,
        required: true,
        min: 0,
        index: true // Delay-based analytics
      },
      messageAge: {
        type: Number,
        required: true,
        min: 0,
        index: true // Message age when reacted
      },
      isImmediateReaction: {
        type: Boolean,
        default: false,
        index: true // Immediate reaction analytics
      },
      isLateReaction: {
        type: Boolean,
        default: false,
        index: true // Late reaction analytics
      },
      reactionPosition: {
        type: Number,
        min: 1,
        index: true // Order of reaction on message
      },
      interactionScore: {
        type: Number,
        default: 1,
        min: 0,
        max: 10 // Weighted engagement score
      }
    },
    required: true,
    _id: false
  })
  analytics: ReactionAnalytics;

  // =============== AUDIT FIELDS ===============
  // Immutable audit trail

  /**
   * Creation timestamp - Auto-managed
   * Immutable for audit integrity
   */
  readonly createdAt: Date;

  /**
   * Last update timestamp - Auto-managed
   * For change tracking
   */
  readonly updatedAt: Date;
}

// =============== SCHEMA CREATION ===============
export const MessageReactionSchema = SchemaFactory.createForClass(MessageReaction);

// =============== DATABASE OPTIMIZATION ===============
// Performance-focused indexing strategy

// PRIMARY PERFORMANCE INDEXES
// Core lookup patterns for 95% of queries
MessageReactionSchema.index(
  { messageId: 1, userId: 1, 'emojiInfo.emoji': 1 },
  {
    name: 'unique_user_emoji_idx',
    unique: true // Prevent duplicate reactions
  }
);

MessageReactionSchema.index(
  { messageId: 1, 'tracking.isActive': 1 },
  { name: 'message_active_reactions_idx' }
);

MessageReactionSchema.index(
  { userId: 1, createdAt: -1 },
  { name: 'user_reactions_timeline_idx' }
);

// ANALYTICS INDEXES
// For reporting và insights
MessageReactionSchema.index(
  { conversationId: 1, createdAt: -1 },
  { name: 'conversation_reactions_idx' }
);

MessageReactionSchema.index(
  { 'emojiInfo.category': 1, createdAt: -1 },
  { name: 'emoji_category_analytics_idx' }
);

MessageReactionSchema.index(
  { 'metadata.platform': 1, 'analytics.reactionDelay': 1 },
  { name: 'platform_performance_idx' }
);

// SPECIALIZED INDEXES
// For specific analytics queries
MessageReactionSchema.index(
  { 'analytics.isImmediateReaction': 1, createdAt: -1 },
  { name: 'immediate_reaction_idx', sparse: true }
);

MessageReactionSchema.index(
  { 'metadata.inputMethod': 1, 'analytics.interactionScore': -1 },
  { name: 'input_engagement_idx' }
);

MessageReactionSchema.index(
  { 'emojiInfo.emoji': 1, createdAt: -1 },
  { name: 'emoji_popularity_idx' }
);

// COMPOUND ANALYTICS INDEX
MessageReactionSchema.index({
  conversationId: 1,
  'metadata.platform': 1,
  'emojiInfo.category': 1,
  'analytics.reactionDelay': 1,
  createdAt: -1
}, { name: 'comprehensive_reaction_analytics_idx' });

// CLEANUP INDEXES
MessageReactionSchema.index(
  { 'tracking.wasRemoved': 1, 'tracking.removedAt': 1 },
  { name: 'cleanup_tracking_idx', sparse: true }
);

// =============== DATA VALIDATION MIDDLEWARE ===============
// Clean Architecture: Only data validation, no business logic

/**
 * Pre-save validation middleware
 * SOLID: Single Responsibility - data validation only
 */
MessageReactionSchema.pre('save', function (next) {
  // Input validation và sanitization
  if (!this.emojiInfo?.emoji || !this.emojiInfo?.emojiCode) {
    return next(new Error('Emoji và emoji code are required'));
  }

  // Validate emoji format (basic Unicode check)
  const emojiRegex = /^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+$/u;
  if (!emojiRegex.test(this.emojiInfo.emoji) && !this.emojiInfo.isCustomEmoji) {
    return next(new Error('Invalid emoji format'));
  }

  // Auto-calculate analytics fields
  this.analytics.isImmediateReaction = this.analytics.reactionDelay <= 5; // 5 seconds
  this.analytics.isLateReaction = this.analytics.messageAge >= 86400; // 24 hours

  // Calculate interaction score based on timing và context
  let score = 1; // Base score

  if (this.analytics.isImmediateReaction) score += 2;
  if (this.metadata.isQuickReaction) score += 1;
  if (this.analytics.reactionDelay <= 1) score += 1; // Very quick
  if (this.metadata.inputMethod === 'keyboard') score += 1;

  this.analytics.interactionScore = Math.min(score, 10);

  next();
});

/**
 * Pre-remove middleware
 * Handle reaction removal tracking
 */
MessageReactionSchema.pre('deleteOne', { document: true }, function (next) {
  // Update tracking info when removing
  this.tracking.wasRemoved = true;
  this.tracking.isActive = false;
  this.tracking.removedAt = new Date();
  this.tracking.removalReason = 'user_removed';

  next();
});

/**
 * Post-save middleware
 * Update reaction position atomically
 */
MessageReactionSchema.post('save', async function (doc) {
  // Calculate reaction position if not set
  if (!doc.analytics.reactionPosition) {
    const MessageReactionModel = this.constructor as any;

    const count = await MessageReactionModel.countDocuments({
      messageId: doc.messageId,
      createdAt: { $lte: doc.createdAt },
      'tracking.isActive': true
    });

    doc.analytics.reactionPosition = count;
    await doc.save();
  }
});

// =============== SCHEMA CONFIGURATION ===============
// Optimized for mobile performance

MessageReactionSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc: any, ret: any) {
    // Remove internal fields from API responses
    if (ret.__v !== undefined) delete ret.__v;
    if (ret._id) ret._id = undefined; // Use id instead

    // Mobile optimization: minimal payload
    if (!ret.tracking?.isActive) {
      // Minimize removed reaction data
      ret.tracking = { isActive: false };
    }

    return ret;
  }
});

MessageReactionSchema.set('toObject', { virtuals: true });

// =============== VIRTUAL FIELDS ===============
// Computed properties for API responses

/**
 * Reaction summary for mobile API
 */
MessageReactionSchema.virtual('reactionSummary').get(function () {
  return {
    emoji: this.emojiInfo.emoji,
    category: this.emojiInfo.category,
    isActive: this.tracking.isActive,
    reactionDelay: this.analytics.reactionDelay,
    platform: this.metadata.platform,
    score: this.analytics.interactionScore
  };
});

/**
 * Engagement metrics
 */
MessageReactionSchema.virtual('engagementMetrics').get(function () {
  return {
    isImmediate: this.analytics.isImmediateReaction,
    isLate: this.analytics.isLateReaction,
    position: this.analytics.reactionPosition,
    interactionScore: this.analytics.interactionScore,
    inputMethod: this.metadata.inputMethod
  };
});

/**
 * Emoji display information
 */
MessageReactionSchema.virtual('emojiDisplay').get(function () {
  return {
    emoji: this.emojiInfo.emoji,
    code: this.emojiInfo.emojiCode,
    category: this.emojiInfo.category,
    isCustom: this.emojiInfo.isCustomEmoji
  };
});

// =============== STATIC QUERY HELPERS ===============
// Optimized query patterns (methods moved to Repository)

/**
 * Find active reactions for a message
 */
MessageReactionSchema.index(
  { messageId: 1, 'tracking.isActive': 1 },
  { name: 'active_message_reactions' }
);

/**
 * Find user's reaction to a message
 */
MessageReactionSchema.index(
  { messageId: 1, userId: 1, 'tracking.isActive': 1 },
  { name: 'user_message_reaction' }
);

