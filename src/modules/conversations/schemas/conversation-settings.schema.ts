import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  DeletionPermission,
  FontSize,
  MessageFeatures,
  GroupSettings,
  PrivacySettings,
  ModerationSettings,
  ThemeSettings
} from '../types/conversation.types';

export type ConversationSettingsDocument = ConversationSettings & Document;

/**
 * ConversationSettings Schema - Clean Architecture
 * 
 * 🎯 RESPONSIBILITY: ONLY conversation settings data structure
 * 📱 Mobile-First: Advanced conversation features and customization
 * 🚀 TypeScript: Type-safe with predefined interfaces
 * 
 * SINGLE RESPONSIBILITY:
 * - Message interaction features (reactions, replies, editing)
 * - Privacy settings (read receipts, typing indicators)
 * - Group-specific permissions and moderation
 * - Theme and customization preferences
 * - NO business logic, NO static methods
 */
@Schema({
  timestamps: true,
  collection: 'conversation_settings',
})
export class ConversationSettings {
  _id: Types.ObjectId;

  /**
   * Conversation reference - UNIQUE constraint
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Conversation',
    required: true,
    unique: true,
    index: true
  })
  conversationId: Types.ObjectId;

  // =============== MESSAGE FEATURES ===============

  /**
   * Message interaction features
   */
  @Prop({
    type: {
      allowReactions: { type: Boolean, default: true },
      allowReplies: { type: Boolean, default: true },
      allowForwarding: { type: Boolean, default: true },
      allowEditing: { type: Boolean, default: true },
      allowDeletion: {
        type: String,
        enum: Object.values(DeletionPermission),
        default: DeletionPermission.EVERYONE
      }
    },
    default: {
      allowReactions: true,
      allowReplies: true,
      allowForwarding: true,
      allowEditing: true,
      allowDeletion: DeletionPermission.EVERYONE
    }
  })
  messageFeatures: MessageFeatures;  // =============== PRIVACY & SECURITY ===============

  /**
   * Privacy settings
   */
  @Prop({
    type: {
      readReceipts: { type: Boolean, default: true },
      typing: { type: Boolean, default: true },
      lastSeen: { type: Boolean, default: true },
      allowScreenshot: { type: Boolean, default: true },
      messageTimer: { type: Number, default: null } // Auto-delete after X seconds
    },
    default: {
      readReceipts: true,
      typing: true,
      lastSeen: true,
      allowScreenshot: true,
      messageTimer: null
    }
  })
  privacySettings: PrivacySettings;  // =============== GROUP PERMISSIONS (Group conversations only) ===============

  /**
   * Group-specific permissions
   */
  @Prop({
    type: {
      whoCanAddMembers: {
        type: String,
        enum: ['everyone', 'admins_only', 'owner_only'],
        default: 'admins_only'
      },
      whoCanRemoveMembers: {
        type: String,
        enum: ['admins_only', 'owner_only'],
        default: 'admins_only'
      },
      whoCanEditInfo: {
        type: String,
        enum: ['everyone', 'admins_only', 'owner_only'],
        default: 'admins_only'
      },
      whoCanSendMessages: {
        type: String,
        enum: ['everyone', 'admins_only'],
        default: 'everyone'
      },
      requireApprovalToJoin: { type: Boolean, default: false },
      allowMemberInviteLinks: { type: Boolean, default: false }
    },
    default: null // Only set for group conversations
  })
  groupPermissions?: {
    whoCanAddMembers: string;
    whoCanRemoveMembers: string;
    whoCanEditInfo: string;
    whoCanSendMessages: string;
    requireApprovalToJoin: boolean;
    allowMemberInviteLinks: boolean;
  };

  // =============== CUSTOMIZATION & THEMES ===============

  /**
   * Visual customization
   */
  @Prop({
    type: {
      theme: {
        type: String,
        enum: ['default', 'dark', 'light', 'custom'],
        default: 'default'
      },
      customThemeData: {
        primaryColor: { type: String, match: /^#[0-9A-F]{6}$/i },
        backgroundColor: { type: String, match: /^#[0-9A-F]{6}$/i },
        textColor: { type: String, match: /^#[0-9A-F]{6}$/i }
      },
      wallpaper: { type: String, default: null }, // URL to wallpaper image
      fontSize: {
        type: String,
        enum: ['small', 'medium', 'large'],
        default: 'medium'
      }
    },
    default: {
      theme: 'default',
      fontSize: 'medium'
    }
  })
  appearance: {
    theme: string;
    customThemeData?: {
      primaryColor: string;
      backgroundColor: string;
      textColor: string;
    };
    wallpaper?: string;
    fontSize: string;
  };

  // =============== ADVANCED FEATURES ===============

  /**
   * Advanced conversation features
   */
  @Prop({
    type: {
      welcomeMessage: { type: String, maxlength: 500, default: null },
      autoTranslation: { type: Boolean, default: false },
      targetLanguage: { type: String, default: null }, // ISO language code
      messageScheduling: { type: Boolean, default: false },
      aiAssistant: { type: Boolean, default: false },
      voiceTranscription: { type: Boolean, default: false }
    },
    default: {
      autoTranslation: false,
      messageScheduling: false,
      aiAssistant: false,
      voiceTranscription: false
    }
  })
  advancedFeatures: {
    welcomeMessage?: string;
    autoTranslation: boolean;
    targetLanguage?: string;
    messageScheduling: boolean;
    aiAssistant: boolean;
    voiceTranscription: boolean;
  };

  // =============== INTEGRATION SETTINGS ===============

  /**
   * Third-party integrations
   */
  @Prop({
    type: {
      webhookUrl: { type: String, default: null },
      botIntegrations: [{
        botId: { type: String },
        permissions: [{ type: String }],
        isActive: { type: Boolean, default: true }
      }],
      fileIntegrations: {
        googleDrive: { type: Boolean, default: false },
        oneDrive: { type: Boolean, default: false },
        dropbox: { type: Boolean, default: false }
      }
    },
    default: {
      botIntegrations: [],
      fileIntegrations: {
        googleDrive: false,
        oneDrive: false,
        dropbox: false
      }
    }
  })
  integrations: {
    webhookUrl?: string;
    botIntegrations: Array<{
      botId: string;
      permissions: string[];
      isActive: boolean;
    }>;
    fileIntegrations: {
      googleDrive: boolean;
      oneDrive: boolean;
      dropbox: boolean;
    };
  };

  // Timestamps từ @Schema({ timestamps: true })
  createdAt: Date;
  updatedAt: Date;
}

export const ConversationSettingsSchema = SchemaFactory.createForClass(ConversationSettings);

// =============== INDEXES FOR PERFORMANCE ===============

// Primary lookup
ConversationSettingsSchema.index({ conversationId: 1 }, { unique: true });

// Feature-based queries
ConversationSettingsSchema.index({ 'privacy.disappearingMessages': 1 }, { sparse: true }); // For cleanup jobs
ConversationSettingsSchema.index({ 'advancedFeatures.aiAssistant': 1 }, { sparse: true }); // AI feature tracking

// =============== DOCUMENT MIDDLEWARE ===============

/**
 * Pre-save middleware
 * Settings validation - ONLY basic validation
 */
ConversationSettingsSchema.pre('save', function (next) {
  // Validate message timer setting
  if (this.privacySettings.messageTimer && this.privacySettings.messageTimer < 0) {
    this.privacySettings.messageTimer = undefined;
  }

  // Basic validation - complex logic moved to service layer
  next();
});

// =============== SCHEMA CONFIGURATION ===============

// JSON output customization
ConversationSettingsSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    // Remove sensitive data from public API responses
    // Complex transformations moved to service layer
    return ret;
  }
});

ConversationSettingsSchema.set('toObject', { virtuals: true });

// NOTE: Static methods moved to Repository layer following Clean Architecture
