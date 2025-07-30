/**
 * Last Message Types - Real-time Conversation Updates
 * 
 * 🎯 Purpose: Type definitions for real-time lastMessage updates in conversation list
 * 📱 Mobile-First: Optimized for conversation list UI updates
 * 🔄 Real-time: Socket.IO integration for instant updates
 */

/**
 * Last message information for conversation list
 */
export interface LastMessageDto {
    messageId: string;
    conversationId: string;
    senderId: string;
    senderName: string;
    content: string;
    messageType: 'text' | 'image' | 'file' | 'audio' | 'video' | 'document';
    timestamp: number;
    readBy: string[]; // Array of userIds who read this message
    deliveredTo: string[]; // Array of userIds who received this message
    isRead: boolean; // For current user context
    attachmentCount?: number; // Number of attachments if file message
}

/**
 * Conversation list update data
 */
export interface ConversationLastMessageUpdate {
    conversationId: string;
    lastMessage: LastMessageDto;
    unreadCount: number;
    lastActivity: number; // Timestamp for sorting conversations
}

/**
 * Bulk conversation updates for efficiency
 */
export interface ConversationsBulkUpdate {
    updates: ConversationLastMessageUpdate[];
    timestamp: number;
}

/**
 * Request DTO for getting last messages
 */
export interface GetConversationsLastMessagesDto {
    conversationIds: string[];
    userId?: string; // For read status context
}

/**
 * Read status update for lastMessage
 */
export interface LastMessageReadStatusUpdate {
    conversationId: string;
    messageId: string;
    userId: string;
    isRead: boolean;
    readAt: number;
}

/**
 * File message content for lastMessage display
 */
export interface FileMessagePreview {
    type: 'single_file' | 'multiple_files';
    fileName?: string; // For single file
    fileCount?: number; // For multiple files
    fileType: 'image' | 'video' | 'audio' | 'document' | 'other';
    preview: string; // Display text like "📎 Sent a photo" or "📎 Sent 3 files"
}

/**
 * Content optimization for lastMessage display
 */
export interface OptimizedMessageContent {
    original: string;
    preview: string; // Truncated/optimized for display
    hasMore: boolean; // True if content was truncated
    filePreview?: FileMessagePreview;
}

/**
 * Socket.IO event DTOs
 */

/**
 * Single conversation lastMessage update event
 */
export interface ConversationLastMessageUpdateEvent {
    conversationId: string;
    lastMessage: LastMessageDto;
    unreadCount: number;
    participantCounts: {
        total: number;
        online: number;
    };
    timestamp: number;
}

/**
 * Bulk conversations update event
 */
export interface ConversationsBulkUpdateEvent {
    updates: ConversationLastMessageUpdate[];
    timestamp: number;
    reason: 'new_message' | 'read_status' | 'bulk_sync';
}

/**
 * LastMessage service interface
 */
export interface ILastMessageService {
    /**
     * Get lastMessage for specific conversation
     */
    getConversationLastMessage(
        conversationId: string,
        userId: string
    ): Promise<LastMessageDto | null>;

    /**
     * Get lastMessages for multiple conversations
     */
    getBulkConversationsLastMessages(
        conversationIds: string[],
        userId: string
    ): Promise<Map<string, LastMessageDto>>;

    /**
     * Update lastMessage when new message is sent
     */
    updateLastMessageOnSend(
        message: any,
        conversationId: string
    ): Promise<void>;

    /**
     * Update read status for lastMessage
     */
    updateLastMessageReadStatus(
        conversationId: string,
        messageId: string,
        userId: string,
        isRead: boolean
    ): Promise<void>;

    /**
     * Generate optimized content for display
     */
    optimizeMessageContent(
        content: string,
        messageType: string,
        attachments?: any[]
    ): OptimizedMessageContent;
}
