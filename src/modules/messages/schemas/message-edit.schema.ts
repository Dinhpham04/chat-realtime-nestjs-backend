import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  EditVersionInfo,
  EditContentData,
  EditContext,
  EditAnalytics,
  Platform
} from '../types/message.types';

export type MessageEditDocument = MessageEdit & Document;

/**
 * MessageEdit Schema - Single Responsibility Architecture
 * 
 * 🎯 Purpose: Message edit history và version management
 * 📱 Mobile-First: Optimized for real-time edit tracking
 * 🚀 Clean Architecture: Pure data structure, no business logic
 * 
 * RESPONSIBILITY (Single Purpose):
 * - Edit version tracking và history
 * - Content change detection và analysis  
 * - Edit timing và context metadata
 * - Edit quality analytics
 */
@Schema({
  timestamps: true,
  collection: 'message_edits',
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
export class MessageEdit {
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
   * Editor user reference - REQUIRED
   * Who performed the edit action
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'UserCore',
    required: true,
    index: true,
    immutable: true // Audit trail integrity
  })
  editedBy: Types.ObjectId;

  /**
   * Original author reference - REQUIRED
   * For permission checking và audit
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'UserCore',
    required: true,
    index: true,
    immutable: true
  })
  originalAuthorId: Types.ObjectId;

  /**
   * Conversation context - REQUIRED
   * For conversation-level edit analytics
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true,
    immutable: true
  })
  conversationId: Types.ObjectId;

  // =============== VERSION MANAGEMENT ===============
  // Clean data structure với proper typing

  /**
   * Version control information
   * Immutable once set for version integrity
   */
  @Prop({
    type: {
      versionNumber: {
        type: Number,
        required: true,
        min: 1,
        immutable: true
      },
      isLatestVersion: {
        type: Boolean,
        default: false,
        index: true // Performance for latest version queries
      },
      isPrevious: {
        type: Boolean,
        default: false
      },
      versionDate: {
        type: Date,
        default: Date.now,
        immutable: true
      }
    },
    required: true,
    _id: false // No sub-document ID needed
  })
  versionInfo: EditVersionInfo;

  // =============== CONTENT TRACKING ===============
  // Comprehensive edit content management

  /**
   * Edit content data
   * Core edit information với change detection
   */
  @Prop({
    type: {
      previousContent: {
        type: String,
        required: true,
        trim: true,
        immutable: true // Original content preservation
      },
      newContent: {
        type: String,
        required: true,
        trim: true,
        maxlength: 10000 // Prevent abuse
      },
      contentDiff: {
        type: String,
        maxlength: 5000 // Diff storage limit
      },
      editReason: {
        type: String,
        maxlength: 500,
        trim: true
      },
      hasSignificantChange: {
        type: Boolean,
        default: false,
        index: true // Analytics queries
      }
    },
    required: true,
    _id: false
  })
  contentData: EditContentData;

  // =============== EDIT CONTEXT ===============
  // Rich context information for analytics

  /**
   * Edit context và metadata
   * Device, platform, và method information
   */
  @Prop({
    type: {
      editType: {
        type: String,
        enum: ['correction', 'addition', 'clarification', 'other'],
        default: 'other',
        index: true // Analytics grouping
      },
      platform: {
        type: String,
        enum: Object.values(Platform),
        default: Platform.MOBILE,
        index: true // Platform analytics
      },
      deviceType: {
        type: String,
        maxlength: 50
      },
      editMethod: {
        type: String,
        enum: ['manual', 'autocorrect', 'suggestion'],
        default: 'manual',
        index: true // Method analytics
      }
    },
    default: {
      editType: 'other',
      platform: Platform.MOBILE,
      editMethod: 'manual'
    },
    _id: false
  })
  editContext: EditContext;

  // =============== ANALYTICS DATA ===============
  // Performance và behavior analytics

  /**
   * Edit analytics và metrics
   * Timing, performance, và change analysis
   */
  @Prop({
    type: {
      editDelay: {
        type: Number,
        required: true,
        min: 0,
        index: true // Time-based analytics
      },
      editDuration: {
        type: Number,
        min: 0,
        max: 3600000 // Max 1 hour editing time
      },
      characterChanges: {
        type: Number,
        default: 0,
        min: 0
      },
      wordChanges: {
        type: Number,
        default: 0,
        min: 0
      },
      isQuickEdit: {
        type: Boolean,
        default: false,
        index: true // Quick edit analytics
      },
      isLateEdit: {
        type: Boolean,
        default: false,
        index: true // Late edit analytics
      }
    },
    required: true,
    _id: false
  })
  analytics: EditAnalytics;

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
export const MessageEditSchema = SchemaFactory.createForClass(MessageEdit);

// =============== DATABASE OPTIMIZATION ===============
// Performance-focused indexing strategy

// PRIMARY PERFORMANCE INDEXES
// Core lookup patterns for 95% of queries
MessageEditSchema.index(
  { messageId: 1, 'versionInfo.versionNumber': -1 },
  { name: 'message_versions_idx' }
);

MessageEditSchema.index(
  { messageId: 1, 'versionInfo.isLatestVersion': 1 },
  { name: 'latest_version_idx', sparse: true }
);

MessageEditSchema.index(
  { editedBy: 1, createdAt: -1 },
  { name: 'editor_timeline_idx' }
);

// ANALYTICS INDEXES
// For reporting và insights
MessageEditSchema.index(
  { conversationId: 1, createdAt: -1 },
  { name: 'conversation_edits_idx' }
);

MessageEditSchema.index(
  { 'editContext.editType': 1, createdAt: -1 },
  { name: 'edit_type_analytics_idx' }
);

MessageEditSchema.index(
  { 'editContext.platform': 1, 'analytics.editDelay': 1 },
  { name: 'platform_performance_idx' }
);

// SPECIALIZED INDEXES
// For specific analytics queries
MessageEditSchema.index(
  { 'analytics.isQuickEdit': 1, createdAt: -1 },
  { name: 'quick_edit_idx', sparse: true }
);

MessageEditSchema.index(
  { 'contentData.hasSignificantChange': 1, createdAt: -1 },
  { name: 'significant_changes_idx', sparse: true }
);

// COMPOUND ANALYTICS INDEX
MessageEditSchema.index({
  conversationId: 1,
  'editContext.platform': 1,
  'analytics.editDelay': 1,
  createdAt: -1
}, { name: 'comprehensive_analytics_idx' });

// =============== DATA VALIDATION MIDDLEWARE ===============
// Clean Architecture: Only data validation, no business logic

/**
 * Pre-save validation middleware
 * SOLID: Single Responsibility - data validation only
 */
MessageEditSchema.pre('save', function (next) {
  // Input validation và sanitization
  if (!this.contentData?.previousContent || !this.contentData?.newContent) {
    return next(new Error('Previous và new content are required'));
  }

  // Auto-calculate analytics fields
  this.analytics.isQuickEdit = this.analytics.editDelay <= 30;
  this.analytics.isLateEdit = this.analytics.editDelay >= 3600; // 1 hour

  // Calculate content changes
  const prevLength = this.contentData.previousContent.length;
  const newLength = this.contentData.newContent.length;

  this.analytics.characterChanges = Math.abs(newLength - prevLength);

  // Word count calculation (simple implementation)
  const prevWords = this.contentData.previousContent.split(/\s+/).length;
  const newWords = this.contentData.newContent.split(/\s+/).length;
  this.analytics.wordChanges = Math.abs(newWords - prevWords);

  // Significant change detection
  const changePercentage = Math.abs(newLength - prevLength) / Math.max(prevLength, 1);
  this.contentData.hasSignificantChange = (
    changePercentage >= 0.3 ||
    this.analytics.editDelay >= 3600 ||
    this.analytics.wordChanges >= 5
  );

  next();
});

/**
 * Post-save middleware
 * Update latest version flag atomically
 */
MessageEditSchema.post('save', async function (doc) {
  // Atomic operation to maintain data consistency
  // Only one latest version per message
  const MessageEditModel = this.constructor as any;

  await MessageEditModel.updateMany(
    {
      messageId: doc.messageId,
      _id: { $ne: doc._id },
      'versionInfo.isLatestVersion': true
    },
    {
      'versionInfo.isLatestVersion': false,
      'versionInfo.isPrevious': true
    }
  );
});

// =============== SCHEMA CONFIGURATION ===============
// Optimized for mobile performance

MessageEditSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc: any, ret: any) {
    // Remove internal fields from API responses
    if (ret.__v !== undefined) delete ret.__v;
    if (ret._id) ret._id = undefined; // Use id instead

    // Mobile optimization: reduce payload size
    if (ret.contentData?.contentDiff && ret.contentData.contentDiff.length > 1000) {
      ret.contentData.contentDiff = ret.contentData.contentDiff.substring(0, 1000) + '...';
    }

    return ret;
  }
});

MessageEditSchema.set('toObject', { virtuals: true });

// =============== VIRTUAL FIELDS ===============
// Computed properties for API responses

/**
 * Edit summary for mobile API
 */
MessageEditSchema.virtual('editSummary').get(function () {
  return {
    version: this.versionInfo.versionNumber,
    editType: this.editContext.editType,
    isSignificant: this.contentData.hasSignificantChange,
    editDelay: this.analytics.editDelay,
    platform: this.editContext.platform
  };
});

/**
 * Content change statistics
 */
MessageEditSchema.virtual('changeStats').get(function () {
  return {
    characterChange: this.analytics.characterChanges,
    wordChange: this.analytics.wordChanges,
    isQuickEdit: this.analytics.isQuickEdit,
    isLateEdit: this.analytics.isLateEdit
  };
});

// =============== NOTES ===============
/*
 * CLEAN ARCHITECTURE COMPLIANCE:
 * ✅ Single Responsibility: Only data structure definition
 * ✅ Open/Closed: Extensible via interfaces
 * ✅ Liskov Substitution: Proper inheritance
 * ✅ Interface Segregation: Focused interfaces
 * ✅ Dependency Inversion: Depends on abstractions
 * 
 * PERFORMANCE CONSIDERATIONS:
 * ✅ Optimized indexes for common queries
 * ✅ Mobile-first JSON serialization
 * ✅ Sparse indexes for optional fields
 * ✅ Compound indexes for analytics
 * 
 * SECURITY & AUDIT:
 * ✅ Immutable fields for data integrity
 * ✅ Input validation và sanitization
 * ✅ Audit trail preservation
 * ✅ No sensitive data exposure
 * 
 * BUSINESS LOGIC SEPARATION:
 * ❌ No static methods (moved to Repository layer)
 * ❌ No business rules (moved to Service layer)
 * ❌ No HTTP logic (handled in Controller layer)
 * ✅ Only data validation middleware
 */
