/**
 * Message Module Type Definitions
 * 
 * 🎯 TypeScript Best Practices: Type-first design
 * 📱 Mobile-First: Strong typing for real-time messaging
 * 🚀 SOLID: Single source of truth for message types
 */

import { CreateMessageAttachmentData } from './message-attachment.types';

// =============== CORE MESSAGE ENUMS ===============

/**
 * Message types for different content
 */
export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
  LOCATION = 'location',
  SYSTEM = 'system'
}

/**
 * System message subtypes
 */
export enum SystemMessageType {
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  USER_ADDED = 'user_added',
  USER_REMOVED = 'user_removed',
  ROLE_CHANGED = 'role_changed',
  CONVERSATION_CREATED = 'conversation_created',
  NAME_CHANGED = 'name_changed',
  AVATAR_CHANGED = 'avatar_changed'
}

/**
 * Message status for delivery tracking
 */
export enum MessageStatus {
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}

/**
 * Detailed message status for comprehensive tracking
 */
export enum MessageDeliveryStatus {
  // Sending states
  SENDING = 'sending',      // Client đang gửi
  SENT = 'sent',           // Đã gửi thành công từ client

  // Server processing states  
  QUEUED = 'queued',       // Server đã nhận, đang xử lý
  PROCESSING = 'processing', // Server đang xử lý

  // Delivery states
  DELIVERED = 'delivered',  // Đã delivered tới recipient device(s)
  FAILED = 'failed',       // Gửi thất bại
  RETRY = 'retry',         // Đang retry gửi lại

  // User engagement states
  READ = 'read',           // User đã đọc
  SEEN = 'seen',           // User đã xem

  // Special states
  EXPIRED = 'expired',     // Message hết hạn
  CANCELLED = 'cancelled', // User cancel trước khi gửi
  BLOCKED = 'blocked'      // Bị block bởi recipient
}

/**
 * Mention types
 */
export enum MentionType {
  USER = 'user',
  EVERYONE = 'everyone',
  HERE = 'here'
}

/**
 * Mention trigger types
 */
export enum MentionTriggerType {
  MANUAL = 'manual',
  AUTOCOMPLETE = 'autocomplete',
  COPY_PASTE = 'copy_paste'
}

/**
 * Reaction types
 */
export enum ReactionType {
  LIKE = 'like',
  LOVE = 'love',
  LAUGH = 'laugh',
  ANGRY = 'angry',
  SAD = 'sad',
  SURPRISE = 'surprise'
}

/**
 * Emoji categories for reactions
 */
export enum EmojiCategory {
  SMILEYS = 'smileys',
  PEOPLE = 'people',
  NATURE = 'nature',
  FOOD = 'food',
  ACTIVITIES = 'activities',
  TRAVEL = 'travel',
  OBJECTS = 'objects',
  SYMBOLS = 'symbols',
  FLAGS = 'flags',
  CUSTOM = 'custom'
}

/**
 * Platform types
 */
export enum Platform {
  MOBILE = 'mobile',
  WEB = 'web',
  DESKTOP = 'desktop'
}

/**
 * Input methods for reactions
 */
export enum InputMethod {
  PICKER = 'picker',
  KEYBOARD = 'keyboard',
  QUICK_REACTION = 'quick_reaction',
  DOUBLE_TAP = 'double_tap'
}

/**
 * Reaction input methods (more specific)
 */
export enum ReactionInputMethod {
  CLICK = 'click',
  HOVER = 'hover',
  KEYBOARD = 'keyboard',
  TOUCH = 'touch',
  LONG_PRESS = 'long_press',
  DOUBLE_TAP = 'double_tap',
  SWIPE = 'swipe'
}

// =============== CORE INTERFACES ===============

/**
 * Basic message information
 */
export interface MessageInfo {
  readonly id?: string; // Message ID (optional for new messages)
  readonly conversationId: string;
  readonly senderId: string;
  readonly messageType: MessageType;
  readonly content: string;
  readonly systemData?: SystemMessageData;
  readonly replyToMessageId?: string;
  readonly editedAt?: Date;
  readonly isEdited: boolean;
  readonly isDeleted?: boolean; // Add isDeleted property
  readonly clientMessageId?: string; // Add clientMessageId property
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * System message data
 */
export interface SystemMessageData {
  readonly systemType: SystemMessageType;
  readonly targetUserId?: string;
  readonly performedBy?: string;
  readonly previousValue?: string;
  readonly newValue?: string;
  readonly metadata?: Record<string, any>;
}

/**
 * Message with location data
 */
export interface LocationData {
  readonly latitude: number;
  readonly longitude: number;
  readonly address?: string;
  readonly placeName?: string;
}

// =============== MESSAGE STATUS INTERFACES ===============

/**
 * Message delivery status per user per device
 */
export interface MessageDeliveryInfo {
  readonly messageId: string;
  readonly userId: string;
  readonly deviceId: string;
  status: MessageStatus;
  readonly deliveredAt?: Date;
  readonly readAt?: Date;
  readonly failureReason?: string;
}

/**
 * Failure information for message delivery
 */
export interface MessageFailureInfo {
  errorCode: string;
  errorMessage: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  permanentFailure: boolean;
}

/**
 * Sync information for Redis-MongoDB sync
 */
export interface MessageSyncInfo {
  syncedFromRedis: boolean;
  syncTimestamp: Date;
  redisKey?: string;
}

/**
 * Aggregated read status for message
 */
export interface MessageReadSummary {
  readonly messageId: string;
  readonly totalRecipients: number;
  readonly deliveredCount: number;
  readonly readCount: number;
  readonly firstReadAt?: Date;
  readonly lastReadAt?: Date;
}

// =============== MENTION INTERFACES ===============

/**
 * Text position information for mentions
 */
export interface MentionTextInfo {
  readonly displayName: string;
  readonly offset: number;
  readonly length: number;
  readonly originalText: string;
}

/**
 * Mention context information
 */
export interface MentionContext {
  readonly mentionType: MentionType;
  readonly isInReply: boolean;
  readonly triggerType: MentionTriggerType;
}

/**
 * Mention notification status
 */
export interface MentionNotificationStatus {
  notificationSent: boolean;
  notificationSentAt?: Date;
  pushNotificationSent: boolean;
  emailNotificationSent: boolean;
  isRead: boolean;
  readAt?: Date;
}

/**
 * Mention analytics
 */
export interface MentionAnalytics {
  clickCount: number;
  lastClickedAt?: Date;
  responseTime?: number;
  hasResponse: boolean;
}

/**
 * Complete mention information
 */
export interface MentionInfo {
  readonly messageId: string;
  readonly mentionedUserId: string;
  readonly mentionedBy: string;
  readonly conversationId: string;
  readonly textInfo: MentionTextInfo;
  readonly mentionContext: MentionContext;
  notificationStatus: MentionNotificationStatus;
  analytics: MentionAnalytics;
}

// =============== REACTION INTERFACES ===============

/**
 * Emoji data structure
 */
export interface ReactionEmojiInfo {
  readonly emoji: string;
  readonly emojiCode: string;
  readonly unicodeVersion?: string;
  readonly skinToneModifier?: string;
  readonly category: EmojiCategory;
  readonly isCustomEmoji?: boolean;
  readonly customEmojiId?: string;
}

/**
 * Reaction metadata
 */
export interface ReactionMetadata {
  readonly reactionType: 'standard' | 'custom' | 'animated';
  readonly customEmojiId?: string;
  readonly platform: Platform;
  readonly inputMethod: InputMethod;
  readonly deviceType?: string;
  readonly isQuickReaction?: boolean;
  readonly reactionSource?: string;
}

/**
 * Reaction tracking data
 */
export interface ReactionTracking {
  isActive: boolean;
  wasModified: boolean;
  wasRemoved?: boolean;
  removedAt?: Date;
  removalReason?: string;
  originalEmoji?: string;
  changeCount: number;
  lastModifiedAt?: Date;
  lastModifiedBy?: string;
}

/**
 * Reaction analytics
 */
export interface ReactionAnalytics {
  reactionDelay: number; // Seconds from message to reaction
  messageAge: number; // Age of message when reacted
  isImmediateReaction: boolean; // <= 5 seconds
  isLateReaction: boolean; // >= 1 day
  reactionPosition: number; // Order of reaction on message
  interactionScore: number; // Weighted engagement score
  popularityScore: number;
  responseTime?: number;
  contextualRelevance: number;
  trendingFactor: number;
  viewCount?: number;
  clickCount?: number;
  copiedCount?: number;
  engagementScore?: number;
}

/**
 * Reaction timing data
 */
export interface ReactionTiming {
  reactionDelay: number; // Seconds from message to reaction
  quickReaction: boolean; // <= 5 seconds
  thoughtfulReaction: boolean; // >= 30 seconds
}

/**
 * Social context for reactions
 */
export interface ReactionSocialContext {
  influencedByOthers: boolean; // Reacted after seeing others
  firstReactor: boolean; // First to react with this emoji
  popularChoice: boolean; // Using popular emoji
  uniqueChoice: boolean; // Using unique emoji
  reactedToReply: boolean; // Reacted to reply message
}

/**
 * Individual reaction information
 */
export interface ReactionInfo {
  readonly messageId: string;
  readonly userId: string;
  readonly reactionType: ReactionType;
  readonly customEmoji?: string;
  readonly reactedAt: Date;
}

/**
 * Aggregated reaction summary
 */
export interface ReactionSummary {
  readonly messageId: string;
  readonly reactions: Record<ReactionType, {
    count: number;
    users: readonly string[];
    latestAt: Date;
  }>;
  readonly totalReactions: number;
}

// =============== MESSAGE EDIT INTERFACES ===============

/**
 * Message edit information
 */
export interface MessageEditInfo {
  readonly messageId: string;
  readonly editedBy: string;
  readonly previousContent: string;
  readonly newContent: string;
  readonly editReason?: string;
  readonly editedAt: Date;
}

/**
 * Message edit history
 */
export interface MessageEditHistory {
  readonly messageId: string;
  readonly edits: readonly MessageEditInfo[];
  readonly totalEdits: number;
  readonly lastEditedAt: Date;
}

/**
 * Edit version information
 */
export interface EditVersionInfo {
  versionNumber: number;
  isLatestVersion: boolean;
  isPrevious: boolean;
  versionDate: Date;
}

/**
 * Edit content data
 */
export interface EditContentData {
  previousContent: string;
  newContent: string;
  contentDiff?: string;
  editReason?: string;
  hasSignificantChange: boolean;
}

/**
 * Edit context information
 */
export interface EditContext {
  editType: 'correction' | 'addition' | 'clarification' | 'other';
  platform: Platform;
  deviceType: string;
  editMethod: 'manual' | 'autocorrect' | 'suggestion';
}

/**
 * Edit analytics
 */
export interface EditAnalytics {
  editDelay: number; // Time from message creation to edit (seconds)
  editDuration: number; // Time spent editing (seconds)
  characterChanges: number;
  wordChanges: number;
  isQuickEdit: boolean; // Edited within 30 seconds
  isLateEdit: boolean; // Edited after 1 hour
}

// =============== CREATE/UPDATE INTERFACES ===============

/**
 * Data needed to create a new message
 * 🎯 Complete message creation with all related data
 * 📱 Supports all message types and attachments
 */
export interface CreateMessageData {
  readonly conversationId: string;
  readonly senderId: string;
  readonly messageType: MessageType;
  readonly content: {
    readonly text: string;
    readonly mentions?: readonly string[]; // User IDs for @mentions
  };
  readonly attachments?: readonly CreateMessageAttachmentData[];
  readonly replyToMessageId?: string;
  readonly replyTo?: string; // Alias for replyToMessageId
  readonly mentions?: readonly string[]; // Top-level mentions for backward compatibility
  readonly systemData?: SystemMessageData;
  readonly locationData?: LocationData;
  readonly clientMessageId?: string;
  readonly metadata?: Record<string, any>;
}

/**
 * Data for updating message
 */
export interface UpdateMessageData {
  content?: {
    text: string;
    mentions?: readonly string[];
  };
  mentions?: readonly string[]; // Top-level mentions for backward compatibility
  editReason?: string;
  isEdited?: boolean;
  editedAt?: Date;
}

/**
 * Data for creating mention
 */
export interface CreateMentionData {
  readonly messageId: string;
  readonly mentionedUserId: string;
  readonly mentionedBy: string;
  readonly conversationId: string;
  readonly textInfo: MentionTextInfo;
  readonly mentionContext?: Partial<MentionContext>;
}

/**
 * Data for creating reaction
 */
export interface CreateReactionData {
  readonly messageId: string;
  readonly userId: string;
  readonly reactionType: ReactionType;
  readonly customEmoji?: string;
}

// =============== QUERY INTERFACES ===============

/**
 * Message query parameters for repository
 */
export interface MessageQuery {
  // Pagination
  limit?: number;
  offset?: number;
  cursor?: string; // message ID for cursor-based pagination
  direction?: 'before' | 'after';

  // Filtering
  senderId?: string;
  messageType?: MessageType | MessageType[];
  hasAttachments?: boolean;
  hasReactions?: boolean;
  isReply?: boolean;

  // Date range
  fromDate?: Date;
  toDate?: Date;

  // Content search
  searchText?: string;

  // Include options
  includeReactions?: boolean;
  includeEditHistory?: boolean;
  includeUserStatus?: boolean;
  includeThreadInfo?: boolean;
}

/**
 * Message query options for pagination and filtering
 */
export interface MessageQueryOptions {
  limit?: number;
  before?: string; // Cursor-based pagination
  after?: string;
  filters?: MessageFilters;
}

/**
 * Message search options for advanced search
 */
export interface MessageSearchOptions {
  query: string;
  searchIn?: ('content' | 'attachments' | 'contacts')[];
  messageTypes?: MessageType[];
  senderId?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
  limit?: number;
  offset?: number;
}

/**
 * Message filters for queries
 */
export interface MessageFilters {
  readonly conversationId?: string;
  readonly senderId?: string;
  readonly messageType?: MessageType;
  readonly hasAttachments?: boolean;
  readonly hasMentions?: boolean;
  readonly hasReactions?: boolean;
  readonly isEdited?: boolean;
  readonly sentAfter?: Date;
  readonly sentBefore?: Date;
  readonly searchQuery?: string;
}

/**
 * Mention filters
 */
export interface MentionFilters {
  readonly mentionedUserId?: string;
  readonly conversationId?: string;
  readonly isRead?: boolean;
  readonly mentionType?: MentionType;
  readonly dateFrom?: Date;
  readonly dateTo?: Date;
}

/**
 * Reaction filters
 */
export interface ReactionFilters {
  readonly messageId?: string;
  readonly userId?: string;
  readonly reactionType?: ReactionType;
  readonly dateFrom?: Date;
  readonly dateTo?: Date;
}

// =============== PAGINATION & RESPONSE INTERFACES ===============

/**
 * Message pagination options
 */
export interface MessagePaginationOptions {
  readonly limit?: number;
  readonly beforeMessageId?: string; // For loading older messages
  readonly afterMessageId?: string;  // For loading newer messages
  readonly sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated message response
 */
export interface MessageListResponse {
  readonly messages: MessageInfo[];
  readonly hasMore: boolean;
  readonly hasNewer: boolean;
  readonly oldestMessageId?: string;
  readonly newestMessageId?: string;
  readonly nextCursor?: string; // Add nextCursor support
  readonly totalCount?: number; // Add totalCount support
}

/**
 * Message with related data (extended version)
 */
export interface MessageWithDetails {
  readonly message: MessageInfo;
  readonly mentions: readonly MentionInfo[];
  readonly reactions: ReactionSummary;
  readonly attachments: readonly string[]; // Attachment IDs
  readonly replyTo?: MessageInfo;
  readonly deliveryStatus?: MessageReadSummary;
}

/**
 * Simplified message for lists (performance optimized)
 */
export interface MessageListItem {
  id: string;
  conversationId: string;
  senderId: string;

  // Content (truncated)
  messageType: MessageType;
  content: string; // truncated for preview
  hasAttachments: boolean;
  attachmentCount: number;

  // Status
  isEdited: boolean;

  // Threading
  replyToMessageId?: string;
  replyCount: number;

  // Reactions summary
  reactionCount: number;
  topReactions?: {
    emoji: string;
    count: number;
  }[];
  myReactions?: string[];

  // Status for current user
  myStatus?: MessageStatus;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  editedAt?: Date;
}

/**
 * Message status update batch operation
 */
export interface MessageStatusUpdate {
  messageId: string;
  userId: string;
  status: MessageStatus;
  timestamp?: Date;
}

/**
 * Message reaction data
 */
export interface MessageReaction {
  emoji: string;
  userId: string;
  timestamp: Date;
}

/**
 * Message delivery status summary (for repository)
 */
export interface MessageDeliverySummary {
  messageId: string;
  totalRecipients: number;
  statusCounts: {
    sent: number;
    delivered: number;
    read: number;
    failed: number;
  };
  userStatuses: {
    userId: string;
    status: MessageStatus;
    timestamp: Date;
  }[];
  lastUpdated: Date;
}

// =============== TYPE GUARDS ===============

/**
 * Check if message is system message
 */
export function isSystemMessage(messageType: MessageType): boolean {
  return messageType === MessageType.SYSTEM;
}

/**
 * Check if message has media content
 */
export function isMediaMessage(messageType: MessageType): boolean {
  return [MessageType.IMAGE, MessageType.VIDEO, MessageType.AUDIO, MessageType.FILE].includes(messageType);
}

/**
 * Check if message can be edited
 */
export function canEditMessage(message: MessageInfo, currentUserId: string): boolean {
  return message.senderId === currentUserId && !isSystemMessage(message.messageType);
}

/**
 * Check if message can be deleted
 */
export function canDeleteMessage(message: MessageInfo, currentUserId: string, isAdmin: boolean = false): boolean {
  return message.senderId === currentUserId || isAdmin;
}

/**
 * Check if mention needs notification
 */
export function needsNotification(mention: MentionInfo): boolean {
  return !mention.notificationStatus.notificationSent;
}

// =============== CONSTANTS ===============

/**
 * Message constraints
 */
export const MESSAGE_CONSTRAINTS = {
  MAX_CONTENT_LENGTH: 4000,
  MAX_EDIT_TIME_HOURS: 24,
  MAX_EDITS_PER_MESSAGE: 10,
  MAX_MENTIONS_PER_MESSAGE: 50,
  MAX_REACTIONS_PER_MESSAGE: 1000,
  SEARCH_MIN_QUERY_LENGTH: 3,
} as const;

/**
 * Mention constraints
 */
export const MENTION_CONSTRAINTS = {
  MAX_DISPLAY_NAME_LENGTH: 50,
  MAX_ORIGINAL_TEXT_LENGTH: 100,
  MIN_OFFSET: 0,
  MIN_LENGTH: 1,
} as const;

/**
 * Default notification settings
 */
export const DEFAULT_NOTIFICATION_SETTINGS = {
  PUSH_ENABLED: true,
  EMAIL_ENABLED: false,
  MENTION_TIMEOUT_MINUTES: 5,
  BATCH_NOTIFICATION_DELAY_SECONDS: 10,
} as const;

/**
 * System message templates
 */
export const SYSTEM_MESSAGE_TEMPLATES = {
  [SystemMessageType.USER_JOINED]: '{user} joined the conversation',
  [SystemMessageType.USER_LEFT]: '{user} left the conversation',
  [SystemMessageType.USER_ADDED]: '{performedBy} added {user} to the conversation',
  [SystemMessageType.USER_REMOVED]: '{performedBy} removed {user} from the conversation',
  [SystemMessageType.ROLE_CHANGED]: '{performedBy} changed {user}\'s role to {newValue}',
  [SystemMessageType.CONVERSATION_CREATED]: '{user} created the conversation',
  [SystemMessageType.NAME_CHANGED]: '{performedBy} changed the conversation name to "{newValue}"',
  [SystemMessageType.AVATAR_CHANGED]: '{performedBy} changed the conversation avatar',
} as const;

// =============== UTILITY FUNCTIONS ===============

/**
 * Generate system message content
 */
export function generateSystemMessageContent(
  systemType: SystemMessageType,
  systemData: SystemMessageData
): string {
  const template = SYSTEM_MESSAGE_TEMPLATES[systemType];
  if (!template) {
    return 'System message';
  }

  return template
    .replace('{user}', systemData.targetUserId || 'Unknown User')
    .replace('{performedBy}', systemData.performedBy || 'Unknown User')
    .replace('{newValue}', systemData.newValue || '')
    .replace('{previousValue}', systemData.previousValue || '');
}

/**
 * Check if message is recent (within specified minutes)
 */
export function isRecentMessage(message: MessageInfo, withinMinutes: number = 5): boolean {
  const messageTime = new Date(message.createdAt || 0).getTime();
  const now = Date.now();
  const timeDiff = now - messageTime;
  return timeDiff <= (withinMinutes * 60 * 1000);
}

/**
 * Extract mention positions from text
 */
export function extractMentionPositions(content: string): MentionTextInfo[] {
  const mentionRegex = /@(\w+(?:\.\w+)*)/g;
  const mentions: MentionTextInfo[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push({
      displayName: match[1],
      offset: match.index,
      length: match[0].length,
      originalText: match[0]
    });
  }

  return mentions;
}

/**
 * Validate message content length
 */
export function isValidMessageContent(content: string): boolean {
  return content.trim().length > 0 && content.length <= MESSAGE_CONSTRAINTS.MAX_CONTENT_LENGTH;
}

// =============== COMPLETE MESSAGE RESPONSE TYPES ===============

/**
 * Complete message response with all related data
 * 🎯 Full message data for client consumption
 * 📱 Includes all attachments, mentions, reactions, status
 * 🚀 Single API response with complete information
 */
export interface CompleteMessageResponse {
  // Core message data
  readonly id: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly messageType: MessageType;
  readonly content: {
    readonly text: string;
  };

  // Related data from other collections
  readonly attachments: MessageAttachmentInfo[];
  readonly mentions: MentionInfo[];
  readonly reactions: ReactionSummary;
  readonly status: MessageStatusInfo;

  // Reply and edit info
  readonly replyTo?: MessageInfo;
  readonly isEdited: boolean;
  readonly editHistory?: MessageEditInfo[];

  // System message data
  readonly systemData?: SystemMessageData;
  readonly locationData?: LocationData;

  // Timestamps
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly editedAt?: Date;
}

/**
 * Message status information for current user
 */
export interface MessageStatusInfo {
  readonly myStatus: MessageStatus; // Current user's status
  readonly deliveryInfo: {
    readonly totalRecipients: number;
    readonly deliveredCount: number;
    readonly readCount: number;
  };
}

/**
 * Simplified attachment info for message response
 */
export interface MessageAttachmentInfo {
  readonly id: string;
  readonly fileName: string;
  readonly originalName: string;
  readonly mimeType: string;
  readonly fileSize: number;
  readonly url: string;
  readonly thumbnailUrl?: string;
  readonly uploadedAt: Date;
}
