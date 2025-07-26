import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ConversationType } from '../types/conversation.types';

export type ConversationDocument = Conversation & Document;

/**
 * Conversation Schema - Clean Architecture Compliance
 * 
 * 🎯 RESPONSIBILITY: ONLY conversation data structure
 * 📱 Mobile-First: Optimized for real-time chat
 * 🚀 TypeScript: Type-safe with predefined enums
 * 
 * SINGLE RESPONSIBILITY:
 * - Conversation identity (type, creator, status)
 * - Basic metadata (name, description, avatar)  
 * - NO business logic, NO static methods
 */
@Schema({
  timestamps: true,
  collection: 'conversations',
})
export class Conversation {
  _id: Types.ObjectId;

  /**
   * Conversation type - ESSENTIAL
   */
  @Prop({
    type: String,
    enum: Object.values(ConversationType),
    required: true,
    index: true
  })
  type: ConversationType;

  /**
   * Conversation creator - ESSENTIAL
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'UserCore',
    required: true,
    index: true
  })
  createdBy: Types.ObjectId;

  /**
   * Basic conversation status - ESSENTIAL
   * Simple active/inactive flag
   */
  @Prop({
    type: Boolean,
    default: true,
    index: true
  })
  isActive: boolean;

  // =============== GROUP CHAT BASICS ===============

  /**
   * Group name - Required for group conversations only
   */
  @Prop({
    type: String,
    maxlength: 100,
    required: function () {
      return this.type === ConversationType.GROUP;
    },
    index: 'text' // For search
  })
  name?: string;  /**
   * Group description - Optional
   */
  @Prop({
    type: String,
    maxlength: 500,
    default: null
  })
  description?: string;

  /**
   * Group avatar - Optional  
   */
  @Prop({
    type: String,
    default: null
  })
  avatarUrl?: string;

  // =============== LAST MESSAGE TRACKING ===============

  /**
   * Last message in conversation - for list preview
   */
  @Prop({
    type: {
      messageId: { type: Types.ObjectId, ref: 'Message' },
      senderId: { type: Types.ObjectId, ref: 'UserCore' },
      content: { type: String, maxlength: 1000 },
      messageType: { type: String },
      sentAt: { type: Date }
    },
    default: null
  })
  lastMessage?: {
    messageId: Types.ObjectId;
    senderId: Types.ObjectId;
    content: string;
    messageType: string;
    sentAt: Date;
  };

  /**
   * Last activity timestamp - for sorting conversations
   */
  @Prop({
    type: Date,
    default: Date.now,
    index: true
  })
  lastActivity: Date;

  // Timestamps từ @Schema({ timestamps: true })
  createdAt: Date;
  updatedAt: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// =============== INDEXES FOR PERFORMANCE ===============

// Core indexes cho MVP
ConversationSchema.index({ type: 1, isActive: 1 }); // Filter by type and status
ConversationSchema.index({ createdBy: 1, createdAt: -1 }); // Creator's conversations
ConversationSchema.index({ name: 'text' }, { sparse: true }); // Group name search

// =============== DOCUMENT MIDDLEWARE ===============

/**
 * Pre-save middleware
 * ONLY basic validation - complex logic in service layer
 */
ConversationSchema.pre('save', function (next) {
  // Validate group conversation rules
  if (this.type === ConversationType.GROUP) {
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Group conversation must have a name');
    }
  }

  next();
});// Enable virtual fields in JSON output  
ConversationSchema.set('toJSON', { virtuals: true });
ConversationSchema.set('toObject', { virtuals: true });
