/**
 * Messages Module Types
 *
 * 🎯 Purpose: Define shared types and interfaces for messages module
 * 📱 Mobile-First: Types optimized for real-time messaging
 * 🚀 Clean Architecture: Type definitions following domain-driven design
 *
 * Design Principles:
 * - Single Responsibility: Each type has focused purpose
 * - Type Safety: Strong typing for better development experience
 * - Reusability: Types shared across service layers
 * - Extensibility: Easy to extend without breaking changes
 */

// =============== ENUMS ===============

export enum MessageType {
    TEXT = 'text',
    IMAGE = 'image',
    VIDEO = 'video',
    AUDIO = 'audio',
    VOICE = 'voice',
    FILE = 'file',
    LOCATION = 'location',
    CONTACT = 'contact',
    STICKER = 'sticker',
    SYSTEM = 'system'
}

export enum MessageStatus {
    SENDING = 'sending',     // Client is sending
    SENT = 'sent',          // Server received  
    DELIVERED = 'delivered', // Delivered to device
    READ = 'read',          // User has seen it
    FAILED = 'failed'       // Send failed
}

export enum MessagePriority {
    LOW = 'low',
    NORMAL = 'normal',
    HIGH = 'high',
    URGENT = 'urgent'
}

export enum MessageReaction {
    LIKE = 'like',
    LOVE = 'love',
    LAUGH = 'laugh',
    ANGRY = 'angry',
    SAD = 'sad',
    SURPRISE = 'surprise'
}

// =============== INTERFACES ===============

/**
 * Message Attachment Interface
 */
export interface MessageAttachment {
    id: string;
    fileId: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    thumbnailUrl?: string;
    downloadUrl?: string;
    width?: number;
    height?: number;
    duration?: number; // for audio/video
}

/**
 * Message Metadata Interface
 */
export interface MessageMetadata {
    deviceId?: string;
    isForwarded?: boolean;
    mentions?: string[];
    editHistory?: Array<{
        editedAt: Date;
        previousContent: string;
    }>;
    reactions?: Record<string, MessageReaction[]>;
    priority?: MessagePriority;
    [key: string]: any; // Allow custom metadata
}

/**
 * Message Location Interface
 */
export interface MessageLocation {
    latitude: number;
    longitude: number;
    address?: string;
    name?: string;
}

/**
 * Message Contact Interface
 */
export interface MessageContact {
    name: string;
    phoneNumber?: string;
    email?: string;
    avatar?: string;
}

/**
 * Message Entity Interface (Domain Model)
 */
export interface Message {
    id: string;
    conversationId: string;
    senderId: string;
    messageType: MessageType;
    content?: string;
    attachments: MessageAttachment[];
    location?: MessageLocation;
    contact?: MessageContact;
    replyToId?: string;
    forwardedFromId?: string;
    status: MessageStatus;
    timestamp: Date;
    editedAt?: Date;
    deliveredAt?: Date;
    readAt?: Date;
    metadata: MessageMetadata;
}

/**
 * Message Search Criteria Interface
 */
export interface MessageSearchCriteria {
    query?: string;
    messageType?: MessageType;
    senderId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    hasAttachments?: boolean;
    status?: MessageStatus;
}

/**
 * Message Analytics Interface
 */
export interface MessageAnalytics {
    totalMessages: number;
    messagesPerDay: number;
    mostActiveUsers: Array<{
        userId: string;
        messageCount: number;
    }>;
    messageTypeDistribution: Record<MessageType, number>;
    averageResponseTime: number;
    peakHours: Array<{
        hour: number;
        messageCount: number;
    }>;
}

/**
 * Pagination Interface
 */
export interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

/**
 * Paginated Response Interface
 */
export interface PaginatedResponse<T> {
    data: T[];
    pagination: PaginationInfo;
}

/**
 * Bulk Operation Result Interface
 */
export interface BulkOperationResult {
    messageId: string;
    success: boolean;
    error?: string;
}

/**
 * Message Event Interfaces for Socket.IO
 */
export interface MessageSentEvent {
    message: Message;
    conversationId: string;
    senderId: string;
}

export interface MessageEditedEvent {
    message: Message;
    conversationId: string;
    editedBy: string;
}

export interface MessageDeletedEvent {
    messageId: string;
    conversationId: string;
    deletedBy: string;
    timestamp: Date;
}

export interface MessageReadEvent {
    messageId: string;
    readBy: string;
    readAt: Date;
    deviceId?: string;
}

export interface MessageDeliveredEvent {
    messageId: string;
    deliveredTo: string;
    deliveredAt: Date;
    deviceId?: string;
}

export interface MessageStatusUpdatedEvent {
    messageId: string;
    status: MessageStatus;
    updatedBy: string;
    timestamp: Date;
}

/**
 * Type Guards
 */
export function isTextMessage(message: Message): boolean {
    return message.messageType === MessageType.TEXT;
}

export function isMediaMessage(message: Message): boolean {
    return [MessageType.IMAGE, MessageType.VIDEO, MessageType.AUDIO, MessageType.FILE].includes(message.messageType);
}

export function hasAttachments(message: Message): boolean {
    return message.attachments && message.attachments.length > 0;
}

export function isSystemMessage(message: Message): boolean {
    return message.messageType === MessageType.SYSTEM;
}

/**
 * Utility Types
 */
export type MessageId = string;
export type ConversationId = string;
export type UserId = string;
export type DeviceId = string;

/**
 * Message Creation Input Type
 */
export type CreateMessageInput = Omit<Message, 'id' | 'timestamp' | 'status' | 'deliveredAt' | 'readAt'>;

/**
 * Message Update Input Type
 */
export type UpdateMessageInput = Partial<Pick<Message, 'content' | 'attachments' | 'metadata'>>;

/**
 * Message Filter Type
 */
export type MessageFilter = Partial<Pick<Message, 'conversationId' | 'senderId' | 'messageType' | 'status'>> & {
    dateFrom?: Date;
    dateTo?: Date;
    hasAttachments?: boolean;
};
