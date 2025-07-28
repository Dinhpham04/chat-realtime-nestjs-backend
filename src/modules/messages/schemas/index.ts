/**
 * Messages Module Schemas Export
 * Core Message Schemas:
 * - Message: Core message data (conversationId, senderId, content, basic flags)
 * - MessageStatus: Hybrid delivery/read status (Redis primary, MongoDB backup)
 * - MessageAttachment: File management (uploads, media processing, access control)
 * - MessageMention: User mentions and notifications
 * - MessageReaction: Emoji reactions and engagement
 * - MessageEdit: Edit history and versioning
 */

// =============== CORE MESSAGE SCHEMAS ===============

// Core message data
export * from './message.schema';

// Hybrid status tracking (Redis primary, MongoDB backup)
export * from './message-status.schema';

// File management system

// User mentions and notifications
export * from './message-mention.schema';

// Emoji reactions and engagement
export * from './message-reaction.schema';

// Edit history and versioning
export * from './message-edit.schema';

// =============== FUTURE SCHEMAS ===============
// These can be added as needed:

// Thread/reply system
// export * from './message-thread.schema';

// Scheduled messages
// export * from './message-schedule.schema';

// Message forwarding tracking
// export * from './message-forward.schema';

// Message translation
// export * from './message-translation.schema';

// Message analytics/insights
// export * from './message-analytics.schema';
