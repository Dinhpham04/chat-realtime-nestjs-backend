/**
 * Conversation Module Type Definitions
 * 
 * 🎯 TypeScript Best Practices: Type-first design
 * 📱 Mobile-First: Strong typing for mobile clients
 * 🚀 SOLID: Single source of truth for conversation types
 */

// =============== ENUMS ===============

/**
 * Conversation types
 */
export enum ConversationType {
  DIRECT = 'direct',
  GROUP = 'group'
}

/**
 * Participant roles in conversation
 */
export enum ParticipantRole {
  MEMBER = 'member',
  ADMIN = 'admin',
  OWNER = 'owner'
}

/**
 * Notification levels for participants
 */
export enum NotificationLevel {
  ALL = 'all',
  MENTIONS_ONLY = 'mentions_only',
  NONE = 'none'
}

/**
 * Conversation status
 */
export enum ConversationStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted'
}

/**
 * User-specific conversation status
 */
export interface UserConversationStatus {
  isArchived: boolean;
  isPinned: boolean;
  isMuted: boolean;
  muteUntil?: Date;
}

/**
 * Message deletion permissions
 */
export enum DeletionPermission {
  EVERYONE = 'everyone',
  ADMINS_ONLY = 'admins_only',
  DISABLED = 'disabled'
}

/**
 * Font size options
 */
export enum FontSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large'
}// =============== CORE INTERFACES ===============

/**
 * Basic conversation information
 */


/**
 * Participant settings within conversation
 */
export interface ParticipantSettings {
  isMuted: boolean;
  muteUntil?: Date;
  isArchived: boolean;
  isPinned: boolean;
  customName?: string;
  notificationLevel: NotificationLevel;
}

/**
 * Participant information
 */
export interface ParticipantInfo {
  readonly conversationId: string;
  readonly userId: string;
  role: ParticipantRole;
  readonly joinedAt: Date;
  leftAt?: Date;
  readonly addedBy: string;
  settings: ParticipantSettings;
}

/**
 * Last message tracking
 */
export interface LastMessageInfo {
  readonly messageId: string;
  readonly senderId: string;
  readonly content: string;
  readonly messageType: string;
  readonly sentAt: Date;
}

/**
 * Read status tracking
 */
export interface ReadStatus {
  lastReadMessageId?: string;
  lastReadAt?: Date;
  unreadCount: number;
}

// =============== CONVERSATION SETTINGS INTERFACES ===============

/**
 * Message interaction features
 */
export interface MessageFeatures {
  allowReactions: boolean;
  allowReplies: boolean;
  allowForwarding: boolean;
  allowEditing: boolean;
  allowDeletion: DeletionPermission;
}

/**
 * Group conversation settings
 */
export interface GroupSettings {
  allowMemberInvite: boolean;
  allowMemberLeave: boolean;
  requireAdminApproval: boolean;
  maxParticipants: number;
  isPublic: boolean;
  inviteLink?: string;
  linkExpiresAt?: Date;
}/**
 * Privacy settings for conversation
 */
export interface PrivacySettings {
  readReceipts: boolean;
  typing: boolean;
  lastSeen: boolean;
  allowScreenshot: boolean;
  messageTimer?: number; // Auto-delete after X seconds
}

/**
 * Moderation settings
 */
export interface ModerationSettings {
  slowMode: boolean;
  slowModeInterval?: number; // Seconds between messages
  profanityFilter: boolean;
  linkPreview: boolean;
  fileUpload: boolean;
  maxFileSize?: number; // In bytes
}

/**
 * Theme and customization settings
 */
export interface ThemeSettings {
  backgroundColor?: string;
  accentColor?: string;
  wallpaper?: string;
  darkMode: boolean;
  fontSize: FontSize;
}

/**
 * Complete conversation settings
 */
export interface ConversationSettingsInfo {
  readonly conversationId: string;
  messageFeatures: MessageFeatures;
  groupSettings?: GroupSettings;
  privacySettings: PrivacySettings;
  moderationSettings?: ModerationSettings;
  themeSettings: ThemeSettings;
}// =============== CREATE/UPDATE INTERFACES ===============

/**
 * Data needed to create a new conversation
 */
export interface CreateConversationData {
  readonly type: ConversationType;
  readonly createdBy: string;
  readonly name?: string;
  readonly description?: string;
  readonly avatarUrl?: string;
  readonly initialParticipants?: readonly string[]; // User IDs
}

/**
 * Data for updating conversation
 */
export interface UpdateConversationData {
  name?: string;
  description?: string;
  avatarUrl?: string;
  isActive?: boolean;
}

/**
 * Data for adding participant
 */
export interface AddParticipantData {
  readonly conversationId: string;
  readonly userId: string;
  readonly addedBy: string;
  role?: ParticipantRole;
}

/**
 * Data for updating participant
 */
export interface UpdateParticipantData {
  role?: ParticipantRole;
  settings?: Partial<ParticipantSettings>;
}

// =============== QUERY INTERFACES ===============

/**
 * Query options for finding user's conversations
 */
export interface ConversationQuery {
  readonly type?: ConversationType;
  readonly status?: 'active' | 'archived' | 'all';
  readonly limit?: number;
  readonly offset?: number;
  readonly search?: string;
  readonly sortBy?: 'updated' | 'created' | 'name';
  readonly hasUnread?: boolean;
}

/**
 * Search options for conversations
 */
export interface ConversationSearchOptions {
  readonly query: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly type?: ConversationType;
  readonly includeArchived?: boolean;
}

/**
 * Conversation filters for queries
 */
export interface ConversationFilters {
  readonly type?: ConversationType;
  readonly isActive?: boolean;
  readonly hasUnread?: boolean;
  readonly createdBy?: string;
  readonly participantId?: string;
  readonly nameQuery?: string;
  readonly createdAfter?: Date;
  readonly createdBefore?: Date;
}

/**
 * Participant filters
 */
export interface ParticipantFilters {
  readonly conversationId?: string;
  readonly userId?: string;
  readonly role?: ParticipantRole;
  readonly isActive?: boolean; // leftAt is null
  readonly joinedAfter?: Date;
  readonly joinedBefore?: Date;
}

/**
 * Pagination options with sorting
 */
export interface PaginationOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly sortBy?: 'createdAt' | 'updatedAt' | 'lastMessageAt' | 'name';
  readonly sortOrder?: 'asc' | 'desc';
}

// =============== RESPONSE INTERFACES ===============

/**
 * Conversation with full participant information
 */
export interface ConversationWithParticipants {
  readonly id: string;
  readonly type: ConversationType;
  readonly name?: string;
  readonly description?: string;
  readonly avatarUrl?: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly isActive: boolean;
  readonly lastMessage?: LastMessageInfo;
  readonly participants: ParticipantInfo[];
  readonly settings?: ConversationSettingsInfo;
  readonly lastActivity: Date;
}

/**
 * Lightweight conversation list item
 */
export interface ConversationListItem {
  readonly id: string;
  readonly type: ConversationType;
  readonly name: string;
  readonly avatarUrl?: string;
  readonly participantCount: number;
  readonly lastMessage?: LastMessageInfo;
  readonly unreadCount: number;
  readonly lastActivity: Date;
  readonly isArchived: boolean;
  readonly isPinned: boolean;
  readonly isMuted: boolean;
}

/**
 * Participant data with user info
 */
export interface ParticipantData {
  readonly conversationId: string;
  readonly userId: string;
  readonly role: ParticipantRole;
  readonly joinedAt: Date;
  readonly addedBy: string;
  readonly isActive: boolean;
  readonly settings: ParticipantSettings;
}

/**
 * Participant data with populated user details (for aggregated queries)
 */
export interface ParticipantWithUserData extends ParticipantData {
  readonly user?: {
    readonly id: string;
    readonly username: string;
    readonly fullName: string;
    readonly avatarUrl?: string;
    readonly isOnline: boolean;
    readonly lastSeen?: Date;
  };
}

// =============== TYPE GUARDS ===============

/**
 * Check if conversation is group type
 */
export function isGroupConversation(type: ConversationType): boolean {
  return type === ConversationType.GROUP;
}

/**
 * Check if conversation is direct type
 */
export function isDirectConversation(type: ConversationType): boolean {
  return type === ConversationType.DIRECT;
}

/**
 * Check if user has admin privileges
 */
export function hasAdminPrivileges(role: ParticipantRole): boolean {
  return role === ParticipantRole.ADMIN || role === ParticipantRole.OWNER;
}

/**
 * Check if user is owner
 */
export function isOwner(role: ParticipantRole): boolean {
  return role === ParticipantRole.OWNER;
}

/**
 * Check if participant is active (not left)
 */
export function isActiveParticipant(participant: ParticipantInfo): boolean {
  return participant.leftAt === undefined || participant.leftAt === null;
}

// =============== CONSTANTS ===============

/**
 * Default settings for new conversations
 */
export const DEFAULT_CONVERSATION_SETTINGS = {
  GROUP_MAX_PARTICIPANTS: 500,
  DIRECT_MAX_PARTICIPANTS: 2,
  DEFAULT_NOTIFICATION_LEVEL: NotificationLevel.ALL,
  MESSAGE_TIMER_OPTIONS: [0, 300, 3600, 86400, 604800], // 0=off, 5min, 1hr, 1day, 1week
} as const;

/**
 * Validation limits
 */
export const VALIDATION_LIMITS = {
  CONVERSATION_NAME_MAX_LENGTH: 100,
  CONVERSATION_DESCRIPTION_MAX_LENGTH: 500,
  CUSTOM_NAME_MAX_LENGTH: 100,
  MAX_FILE_SIZE_DEFAULT: 100 * 1024 * 1024, // 100MB
  SLOW_MODE_MIN_INTERVAL: 1, // 1 second
  SLOW_MODE_MAX_INTERVAL: 300, // 5 minutes
} as const;

/**
 * Role hierarchy for permission checking
 */
export const ROLE_HIERARCHY = {
  [ParticipantRole.MEMBER]: 1,
  [ParticipantRole.ADMIN]: 2,
  [ParticipantRole.OWNER]: 3,
} as const;

// =============== UTILITY FUNCTIONS ===============

/**
 * Check if user has permission level
 */
export function hasPermissionLevel(
  userRole: ParticipantRole,
  requiredRole: ParticipantRole
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Get default settings for conversation type
 */
export function getDefaultSettings(type: ConversationType): Partial<GroupSettings> {
  if (type === ConversationType.GROUP) {
    return {
      allowMemberInvite: true,
      allowMemberLeave: true,
      requireAdminApproval: false,
      maxParticipants: DEFAULT_CONVERSATION_SETTINGS.GROUP_MAX_PARTICIPANTS,
      isPublic: false
    };
  }
  return {};
}

/**
 * Validate conversation name
 */
export function isValidConversationName(name: string, type: ConversationType): boolean {
  if (type === ConversationType.GROUP) {
    return Boolean(name && name.trim().length > 0 && name.length <= VALIDATION_LIMITS.CONVERSATION_NAME_MAX_LENGTH);
  }
  return true; // Direct conversations don't require names
}



