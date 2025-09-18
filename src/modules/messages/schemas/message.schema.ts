import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  MessageType,
  SystemMessageType,
  SystemMessageData,
  LocationData
} from '../types/message.types';

export type MessageDocument = Message & Document;

/**
 * Message Schema - CORE ONLY (Single Responsibility)
 * RESPONSIBILITY: 
 * - Message identity (conversationId, senderId, messageType)
 * - Basic content (text, mentions)
 * - Reply relationship
 * - Basic timestamps
 */
@Schema({
  timestamps: true,
  collection: 'messages',
})
export class Message {
  _id: Types.ObjectId;

  // =============== CORE IDENTITY - SINGLE RESPONSIBILITY ===============

  /**
   * Conversation reference - ESSENTIAL
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  })
  conversationId: Types.ObjectId;

  /**
   * Message sender - ESSENTIAL
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'UserCore',
    required: true,
    index: true
  })
  senderId: Types.ObjectId;

  /**
   * Message type - ESSENTIAL
   * Determines how message is rendered
   */
  @Prop({
    type: String,
    enum: Object.values(MessageType),
    default: MessageType.TEXT,
    index: true
  })
  messageType: MessageType;

  // =============== BASIC CONTENT ===============

  /**
   * Message text content - Core content only
   */
  @Prop({
    type: String,
    maxlength: 10000,
    trim: true,
    default: null
  })
  content?: string;

  /**
   * Reply relationship - MVP FEATURE
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Message',
    default: null,
    index: true
  })
  replyTo?: Types.ObjectId;

  // =============== BASIC STATUS ===============

  /**
   * Message status for delivery and read tracking
   */
  @Prop({
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent',
    index: true
  })
  status: string;

  /**
   * When message was delivered
   */
  @Prop({
    type: Date,
    default: null
  })
  deliveredAt?: Date;

  /**
   * When message was read
   */
  @Prop({
    type: Date,
    default: null
  })
  readAt?: Date;

  /**
   * Soft delete flag - Simple boolean
   */
  @Prop({
    type: Boolean,
    default: false,
    index: true
  })
  isDeleted: boolean;

  /**
   * Edit flag - Simple boolean
   */
  @Prop({
    type: Boolean,
    default: false
  })
  isEdited: boolean;

  /**
   * System message flag
   */
  @Prop({
    type: Boolean,
    default: false
  })
  isSystemMessage: boolean;

  // Timestamps từ @Schema({ timestamps: true })
  createdAt: Date;
  updatedAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// =============== INDEXES FOR PERFORMANCE ===============

// Core indexes cho fast message queries
MessageSchema.index({ conversationId: 1, createdAt: -1 }); // Conversation messages chronological
MessageSchema.index({ senderId: 1, createdAt: -1 }); // User's message history
MessageSchema.index({ messageType: 1, isDeleted: 1, createdAt: -1 }); // Filter by type and status
MessageSchema.index({ replyTo: 1 }, { sparse: true }); // Reply lookup

// Text search index
MessageSchema.index({ content: 'text' }); // Full-text search

// =============== DOCUMENT MIDDLEWARE ===============

/**
 * Pre-save middleware - MINIMAL validation only
 */
MessageSchema.pre('save', function (next) {
  // Basic content validation
  if (!this.content && !this.isSystemMessage && this.messageType === 'text') {
    throw new Error('Text message must have content');
  }

  next();
});

/**
 * Pre-find middleware - Exclude deleted messages by default
 */
MessageSchema.pre(/^find/, function () {
  // @ts-ignore - Mongoose pre-find middleware context
  if (!this.getOptions().includeDeleted) {
    // @ts-ignore - Mongoose Query object
    this.where({ isDeleted: { $ne: true } });
  }
});

// Enable virtual fields in JSON output
MessageSchema.set('toJSON', { virtuals: true });
MessageSchema.set('toObject', { virtuals: true });
