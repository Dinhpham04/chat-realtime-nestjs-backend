/**
 * Conversations Service Interface
 * 
 * 🎯 Purpose: Define contract for conversation business logic
 * 📱 Mobile-First: Optimized for real-time chat operations
 * 🚀 Clean Architecture: Service layer interface
 */

import { Types } from 'mongoose';

export interface PrepareConversationResult {
  conversationId: string;
  exists: boolean;
  isActive: boolean;
  participant: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
    isOnline: boolean;
    lastSeen?: string;
  };
  conversation?: {
    id: string;
    type: 'direct' | 'group';
    createdAt: string;
    lastActivity: string;
  };
}

export interface ActivateConversationResult {
  conversation: {
    id: string;
    type: 'direct' | 'group';
    participants: Array<{
      userId: string;
      role: 'admin' | 'member';
      joinedAt: string;
      user: {
        id: string;
        username: string;
        fullName: string;
        avatarUrl?: string;
        isOnline: boolean;
      };
    }>;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    lastMessage: {
      id: string;
      content: string;
      messageType: string;
      senderId: string;
      createdAt: string;
    } | null;
    isActive: boolean;
    unreadCount: number;
  };
  message: {
    id: string;
    conversationId: string;
    senderId: string;
    messageType: 'text' | 'image' | 'file' | 'video' | 'audio';
    content: {
      text: string;
      mentions?: Array<{
        userId: string;
        username: string;
        offset: number;
        length: number;
      }>;
    };
    attachments?: Array<{
      id: string;
      fileName: string;
      originalName: string;
      mimeType: string;
      fileSize: number;
      url: string;
    }>;
    createdAt: string;
    updatedAt: string;
  };
  created: boolean;
}

export interface InitialMessageData {
  content: {
    text: string;
    mentions?: Array<{
      userId: string;
      username: string;
      offset: number;
      length: number;
    }>;
  };
  attachments?: Array<{
    fileName: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    url: string;
  }>;
  messageType?: 'text' | 'image' | 'file' | 'video' | 'audio';
  metadata?: {
    platform?: 'ios' | 'android' | 'web';
    deviceInfo?: string;
  };
}

export interface IConversationsService {
  /**
   * Prepare conversation for direct messaging
   * Called when user clicks on contact in contact list
   */
  prepareDirectConversation(
    userId: string,
    participantId: string
  ): Promise<PrepareConversationResult>;

  /**
   * Activate conversation with first message
   * Called when user sends first message to activate dormant conversation
   */
  activateConversation(
    conversationId: string,
    senderId: string,
    initialMessageData: InitialMessageData
  ): Promise<ActivateConversationResult>;

  /**
   * Get conversation by ID with all details
   */
  getConversationById(
    conversationId: string,
    userId: string
  ): Promise<ActivateConversationResult['conversation'] | null>;
}
