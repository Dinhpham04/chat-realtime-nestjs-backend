# 🏗️ Repository Layer Specifications

**Purpose:** Define exact repository methods needed for API implementation  
**Architecture:** Interface-first design following Clean Architecture  
**Pattern:** Based on existing UserFriendRepository structure  

---

## 🎯 **REPOSITORY ANALYSIS**

### **Conversations Repository Requirements**

#### **Core Methods Needed:**
```typescript
interface IConversationRepository {
  // =============== CONVERSATION CRUD ===============
  
  // Create direct conversation (with duplicate check)
  createDirectConversation(
    user1Id: string, 
    user2Id: string
  ): Promise<ConversationDocument>;

  // Create group conversation
  createGroupConversation(params: {
    name: string;
    description?: string;
    createdBy: string;
    participantIds: string[];
    settings?: Partial<GroupSettings>;
  }): Promise<ConversationDocument>;

  // Find conversation by ID
  findById(conversationId: string): Promise<ConversationDocument | null>;

  // Find direct conversation between users  
  findDirectConversation(
    user1Id: string, 
    user2Id: string
  ): Promise<ConversationDocument | null>;

  // Check if conversation exists by participants
  findByParticipants(
    participantIds: string[]
  ): Promise<ConversationDocument | null>;

  // Update conversation metadata
  updateById(
    conversationId: string, 
    updateData: Partial<Conversation>
  ): Promise<ConversationDocument | null>;

  // =============== CONVERSATION QUERIES ===============

  // Get user's conversations with filters and pagination
  findUserConversations(userId: string, options: {
    type?: 'direct' | 'group' | 'all';
    status?: 'active' | 'archived' | 'all';
    limit?: number;
    offset?: number;
    search?: string;
    sortBy?: 'updated' | 'created' | 'name';
  }): Promise<{
    conversations: ConversationDocument[];
    total: number;
  }>;

  // Search conversations by name/content
  searchConversations(userId: string, options: {
    searchTerm: string;
    type?: 'direct' | 'group' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<{
    conversations: ConversationDocument[];
    total: number;
  }>;

  // Get conversations with unread counts
  findWithUnreadCounts(
    userId: string,
    conversationIds?: string[]
  ): Promise<Array<{
    conversation: ConversationDocument;
    unreadCount: number;
    lastMessage?: MessageDocument;
  }>>;

  // =============== PARTICIPANT MANAGEMENT ===============

  // Add participants to conversation
  addParticipants(
    conversationId: string,
    participantData: Array<{
      userId: string;
      role?: 'admin' | 'member';
      addedBy: string;
    }>
  ): Promise<ConversationDocument>;

  // Remove participant from conversation
  removeParticipant(
    conversationId: string,
    userId: string
  ): Promise<ConversationDocument>;

  // Update participant role
  updateParticipantRole(
    conversationId: string,
    userId: string,
    role: 'admin' | 'member'
  ): Promise<ConversationDocument>;

  // Get conversation participants with pagination
  getParticipants(conversationId: string, options: {
    limit?: number;
    offset?: number;
    role?: 'admin' | 'member' | 'all';
  }): Promise<{
    participants: ParticipantInfo[];
    total: number;
  }>;

  // =============== CONVERSATION STATUS ===============

  // Archive/restore conversation for user
  updateUserArchiveStatus(
    conversationId: string,
    userId: string,
    archived: boolean
  ): Promise<boolean>;

  // Pin/unpin conversation for user
  updateUserPinStatus(
    conversationId: string,
    userId: string,
    pinned: boolean
  ): Promise<boolean>;

  // Mute/unmute conversation for user
  updateUserMuteStatus(
    conversationId: string,
    userId: string,
    muteUntil?: Date
  ): Promise<boolean>;

  // =============== UTILITIES ===============

  // Check user permissions in conversation
  getUserPermissions(
    conversationId: string,
    userId: string
  ): Promise<UserPermissions | null>;

  // Update last message reference
  updateLastMessage(
    conversationId: string,
    messageId: string
  ): Promise<boolean>;

  // Soft delete conversation (groups only)
  softDelete(conversationId: string): Promise<boolean>;

  // Get conversation statistics
  getConversationStats(conversationId: string): Promise<{
    participantCount: number;
    messageCount: number;
    createdAt: Date;
    lastActivity: Date;
  }>;
}
```

---

### **Messages Repository Requirements**

#### **Core Methods Needed:**
```typescript
interface IMessageRepository {
  // =============== MESSAGE CRUD ===============

  // Create new message
  create(messageData: {
    conversationId: string;
    senderId: string;
    content: MessageContent;
    messageType: MessageType;
    replyToMessageId?: string;
    attachments?: AttachmentData[];
    mentions?: MentionData[];
    metadata?: MessageMetadata;
  }): Promise<MessageDocument>;

  // Find message by ID
  findById(messageId: string): Promise<MessageDocument | null>;

  // Find message with full context (conversation, sender, reply-to)
  findByIdWithContext(messageId: string): Promise<{
    message: MessageDocument;
    conversation: ConversationDocument;
    replyTo?: MessageDocument;
    sender: UserDocument;
  } | null>;

  // Update message content (editing)
  updateContent(
    messageId: string,
    newContent: MessageContent,
    editReason?: string
  ): Promise<MessageDocument | null>;

  // Soft delete message
  softDelete(
    messageId: string,
    deletedBy: string,
    deleteForEveryone: boolean
  ): Promise<boolean>;

  // =============== MESSAGE QUERIES ===============

  // Get conversation messages with pagination
  findConversationMessages(conversationId: string, options: {
    limit?: number;
    beforeMessageId?: string; // For older messages
    afterMessageId?: string;  // For newer messages
    messageTypes?: MessageType[];
    includeSystem?: boolean;
    includeDeleted?: boolean;
  }): Promise<{
    messages: MessageDocument[];
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
    oldestMessageId?: string;
    newestMessageId?: string;
  }>;

  // Get messages around specific message (context)
  findMessagesAround(messageId: string, options: {
    beforeCount?: number;
    afterCount?: number;
  }): Promise<{
    messages: MessageDocument[];
    targetMessage: MessageDocument;
  }>;

  // Search messages in conversation
  searchInConversation(conversationId: string, options: {
    searchTerm: string;
    messageTypes?: MessageType[];
    fromDate?: Date;
    toDate?: Date;
    fromUserId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    messages: MessageDocument[];
    total: number;
  }>;

  // Get user's messages across conversations
  findUserMessages(userId: string, options: {
    conversationIds?: string[];
    messageTypes?: MessageType[];
    limit?: number;
    offset?: number;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<{
    messages: MessageDocument[];
    total: number;
  }>;

  // =============== MESSAGE STATUS ===============

  // Get unread message count for user
  getUnreadCount(userId: string, options?: {
    conversationId?: string;
    sinceDate?: Date;
  }): Promise<{
    totalUnread: number;
    conversationCounts: Array<{
      conversationId: string;
      unreadCount: number;
      lastUnreadMessage: MessageDocument;
    }>;
  }>;

  // Get messages user hasn't read in conversation
  findUnreadMessages(
    conversationId: string,
    userId: string,
    options?: {
      limit?: number;
      sinceDate?: Date;
    }
  ): Promise<MessageDocument[]>;

  // Mark messages as read for user (bulk operation)
  markAsRead(
    userId: string,
    messageIds: string[],
    readAt?: Date
  ): Promise<{
    markedCount: number;
    failedIds: string[];
  }>;

  // Mark all conversation messages as read
  markConversationAsRead(
    conversationId: string,
    userId: string,
    upToMessageId?: string,
    readAt?: Date
  ): Promise<{
    markedCount: number;
    lastReadMessageId: string;
  }>;

  // =============== MESSAGE REACTIONS ===============

  // Add reaction to message
  addReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<{
    success: boolean;
    reactions: ReactionSummary[];
  }>;

  // Remove reaction from message
  removeReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<{
    success: boolean;
    reactions: ReactionSummary[];
  }>;

  // Get message reactions
  getMessageReactions(messageId: string, options?: {
    emoji?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    reactions: Array<{
      emoji: string;
      users: UserDocument[];
      count: number;
      addedAt: Date;
    }>;
    total: number;
  }>;

  // =============== MESSAGE ATTACHMENTS ===============

  // Add attachment to message
  addAttachment(
    messageId: string,
    attachmentData: AttachmentData
  ): Promise<MessageDocument | null>;

  // Remove attachment from message
  removeAttachment(
    messageId: string,
    attachmentId: string
  ): Promise<boolean>;

  // Get message attachments
  getMessageAttachments(messageId: string): Promise<AttachmentData[]>;

  // =============== MESSAGE MENTIONS ===============

  // Get messages where user is mentioned
  findUserMentions(userId: string, options: {
    conversationIds?: string[];
    isRead?: boolean;
    limit?: number;
    offset?: number;
    fromDate?: Date;
  }): Promise<{
    messages: MessageDocument[];
    total: number;
  }>;

  // Mark mention as read
  markMentionAsRead(
    messageId: string,
    userId: string
  ): Promise<boolean>;

  // =============== MESSAGE THREADING ===============

  // Get replies to a message
  findMessageReplies(messageId: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<{
    replies: MessageDocument[];
    total: number;
  }>;

  // Get thread context (original + all replies)
  findMessageThread(messageId: string): Promise<{
    originalMessage: MessageDocument;
    replies: MessageDocument[];
    totalReplies: number;
  }>;

  // =============== UTILITIES ===============

  // Get conversation's latest message
  findLastMessage(conversationId: string): Promise<MessageDocument | null>;

  // Get message statistics
  getMessageStats(messageId: string): Promise<{
    replyCount: number;
    reactionCount: number;
    mentionCount: number;
    attachmentCount: number;
  }>;

  // Bulk operations for performance
  findMultipleById(messageIds: string[]): Promise<MessageDocument[]>;

  // Clean up old messages (for maintenance)
  cleanupOldMessages(options: {
    olderThan: Date;
    conversationId?: string;
    dryRun?: boolean;
  }): Promise<{
    deletedCount: number;
    freedSpace: number;
  }>;
}
```

---

### **Message Status Repository Requirements**

```typescript
interface IMessageStatusRepository {
  // =============== STATUS TRACKING ===============

  // Create/update message status for user
  upsertStatus(
    messageId: string,
    userId: string,
    status: MessageDeliveryStatus,
    metadata?: {
      deviceId?: string;
      platform?: string;
      timestamp?: Date;
    }
  ): Promise<MessageStatusDocument>;

  // Get message delivery status
  getMessageStatus(messageId: string): Promise<{
    messageId: string;
    deliveryStats: {
      sent: number;
      delivered: number;
      read: number;
      failed: number;
    };
    recipients: Array<{
      userId: string;
      status: MessageDeliveryStatus;
      timestamp: Date;
      deviceInfo?: string;
    }>;
  }>;

  // Get status for multiple messages
  getMultipleMessageStatus(
    messageIds: string[]
  ): Promise<Map<string, MessageStatusSummary>>;

  // Mark as delivered for user
  markAsDelivered(
    messageId: string,
    userId: string,
    deviceId?: string
  ): Promise<boolean>;

  // Mark as read for user  
  markAsRead(
    messageId: string,
    userId: string,
    deviceId?: string
  ): Promise<boolean>;

  // Bulk status update
  bulkUpdateStatus(updates: Array<{
    messageId: string;
    userId: string;
    status: MessageDeliveryStatus;
    timestamp?: Date;
  }>): Promise<{
    successCount: number;
    failedCount: number;
  }>;

  // =============== STATUS QUERIES ===============

  // Get user's read status across conversations
  getUserReadStatus(userId: string, options?: {
    conversationIds?: string[];
    sinceDate?: Date;
  }): Promise<Array<{
    messageId: string;
    conversationId: string;
    status: MessageDeliveryStatus;
    timestamp: Date;
  }>>;

  // Get conversation read status summary
  getConversationReadStatus(
    conversationId: string
  ): Promise<Array<{
    userId: string;
    lastReadMessageId?: string;
    lastReadAt?: Date;
    unreadCount: number;
  }>>;

  // =============== UTILITIES ===============

  // Cleanup old status records
  cleanupOldStatus(olderThan: Date): Promise<{
    deletedCount: number;
  }>;

  // Sync status with Redis (for real-time)
  syncWithRedis(messageId: string): Promise<boolean>;
}
```

---

## 🛠️ **IMPLEMENTATION PRIORITY**

### **🔴 Phase 1 - Core Methods (Week 1)**
```typescript
ConversationRepository:
✅ createDirectConversation
✅ createGroupConversation  
✅ findById
✅ findDirectConversation
✅ findUserConversations
✅ addParticipants
✅ updateLastMessage

MessageRepository:
✅ create
✅ findById
✅ findConversationMessages
✅ getUnreadCount
✅ markConversationAsRead
✅ findLastMessage

MessageStatusRepository:
✅ upsertStatus
✅ markAsDelivered
✅ markAsRead
✅ getMessageStatus
```

### **🟡 Phase 2 - Advanced Methods (Week 2-3)**
```typescript
✅ Search functionality
✅ Message reactions
✅ Message mentions  
✅ File attachments
✅ Message threading
✅ Bulk operations
```

### **🟢 Phase 3 - Optimization (Week 4+)**
```typescript
✅ Complex aggregations
✅ Performance optimizations
✅ Caching strategies
✅ Cleanup utilities
✅ Analytics methods
```

---

## 🎯 **NEXT STEPS**

1. **Create Repository Interfaces** - Define TypeScript interfaces
2. **Implement Core Methods** - Start with Phase 1 methods
3. **Write Unit Tests** - Test each method thoroughly  
4. **Performance Optimization** - Add proper indexing
5. **Integration Testing** - Test repository interactions

**With this specification, we now have a clear roadmap for implementing the Repository layer!** 🚀
