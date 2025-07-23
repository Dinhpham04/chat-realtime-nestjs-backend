# 🔧 Service Layer Specifications

**Purpose:** Define business logic layer for Conversations & Messages  
**Architecture:** Interface-first design with dependency injection  
**Pattern:** Service orchestrates repositories and implements business rules  

---

## 🎯 **SERVICE LAYER ANALYSIS**

### **Conversations Service Requirements**

#### **Business Logic Methods:**
```typescript
interface IConversationService {
  // =============== CONVERSATION MANAGEMENT ===============

  // Create direct conversation with business rules
  createDirectConversation(
    currentUserId: string,
    participantId: string,
    initialMessage?: string
  ): Promise<{
    conversation: ConversationResponse;
    created: boolean; // true if new, false if existing
    message?: MessageResponse; // if initialMessage provided
  }>;

  // Create group conversation with validation
  createGroupConversation(
    creatorId: string,
    params: {
      name: string;
      description?: string;
      participantIds: string[]; // Min 2 other users
      avatarUrl?: string;
      settings?: Partial<GroupSettings>;
    }
  ): Promise<{
    conversation: ConversationResponse;
    invitesSent: string[]; // User IDs that were notified
    failedInvites: Array<{ userId: string; reason: string }>;
  }>;

  // Get user's conversations with business logic
  getUserConversations(
    userId: string,
    options: {
      type?: 'direct' | 'group' | 'all';
      status?: 'active' | 'archived' | 'all';
      limit?: number;
      offset?: number;
      search?: string;
      sortBy?: 'updated' | 'created' | 'name';
      includeUnreadCount?: boolean;
    }
  ): Promise<{
    conversations: ConversationListItem[];
    total: number;
    hasMore: boolean;
  }>;

  // Get specific conversation with permissions
  getConversationById(
    conversationId: string,
    userId: string
  ): Promise<{
    conversation: ConversationResponse;
    permissions: UserPermissions;
  } | null>;

  // Update conversation metadata with permission check
  updateConversation(
    conversationId: string,
    userId: string,
    updates: {
      name?: string;
      description?: string;
      avatarUrl?: string;
      settings?: Partial<GroupSettings>;
    }
  ): Promise<{
    conversation: ConversationResponse;
    notifiedUsers: string[];
  }>;

  // Archive/restore conversation for user
  updateArchiveStatus(
    conversationId: string,
    userId: string,
    archived: boolean
  ): Promise<{ success: true }>;

  // Delete conversation (groups only, admin only)
  deleteConversation(
    conversationId: string,
    userId: string
  ): Promise<{
    success: true;
    notifiedUsers: string[];
  }>;

  // =============== PARTICIPANT MANAGEMENT ===============

  // Get conversation participants with online status
  getConversationParticipants(
    conversationId: string,
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      role?: 'admin' | 'member' | 'all';
      includeOnlineStatus?: boolean;
    }
  ): Promise<{
    participants: ParticipantResponse[];
    total: number;
    hasMore: boolean;
  }>;

  // Add participants with business rules
  addParticipants(
    conversationId: string,
    currentUserId: string,
    params: {
      userIds: string[];
      role?: 'member' | 'admin';
      welcomeMessage?: string;
    }
  ): Promise<{
    added: ParticipantResponse[];
    failed: Array<{ userId: string; reason: string }>;
    systemMessage: MessageResponse;
  }>;

  // Remove participant with permission check
  removeParticipant(
    conversationId: string,
    currentUserId: string,
    targetUserId: string,
    reason?: string
  ): Promise<{
    success: true;
    systemMessage: MessageResponse;
    notifiedUsers: string[];
  }>;

  // Update participant role
  updateParticipantRole(
    conversationId: string,
    currentUserId: string,
    targetUserId: string,
    newRole: 'admin' | 'member'
  ): Promise<{
    participant: ParticipantResponse;
    systemMessage: MessageResponse;
  }>;

  // Leave conversation
  leaveConversation(
    conversationId: string,
    userId: string
  ): Promise<{
    success: true;
    systemMessage?: MessageResponse; // For groups
    conversationDeleted?: boolean; // If last person in group
  }>;

  // =============== CONVERSATION UTILITIES ===============

  // Check if conversation exists between users
  checkConversationExists(
    participantIds: string[]
  ): Promise<{
    exists: boolean;
    conversationId?: string;
    conversation?: ConversationResponse;
  }>;

  // Search conversations with advanced filters
  searchConversations(
    userId: string,
    query: string,
    options?: {
      type?: 'direct' | 'group' | 'all';
      limit?: number;
      includeMessageContent?: boolean;
    }
  ): Promise<{
    conversations: ConversationListItem[];
    total: number;
  }>;

  // Get conversation statistics
  getConversationStats(
    conversationId: string,
    userId: string
  ): Promise<{
    participantCount: number;
    messageCount: number;
    unreadCount: number;
    createdAt: Date;
    lastActivity: Date;
    userJoinedAt: Date;
    isAdmin: boolean;
  }>;

  // =============== BUSINESS RULES VALIDATION ===============

  // Check if user can perform action
  validateUserPermission(
    conversationId: string,
    userId: string,
    action: 'send_message' | 'add_member' | 'remove_member' | 'edit_group' | 'delete_group'
  ): Promise<{
    allowed: boolean;
    reason?: string;
  }>;

  // Validate conversation data
  validateConversationData(data: {
    name?: string;
    description?: string;
    participantIds?: string[];
    settings?: GroupSettings;
  }): Promise<{
    valid: boolean;
    errors: string[];
  }>;
}
```

---

### **Messages Service Requirements**

#### **Business Logic Methods:**
```typescript
interface IMessageService {
  // =============== MESSAGE SENDING ===============

  // Send text message with business logic
  sendMessage(
    senderId: string,
    params: {
      conversationId: string;
      content: {
        text: string;
        mentions?: MentionData[];
      };
      replyToMessageId?: string;
      metadata?: {
        platform?: 'ios' | 'android' | 'web';
        deviceInfo?: string;
      };
    }
  ): Promise<{
    message: MessageResponse;
    deliveryStatus: 'sent' | 'queued';
    notifiedUsers: string[];
    mentionedUsers: string[];
  }>;

  // Send message with attachments
  sendMessageWithAttachments(
    senderId: string,
    params: {
      conversationId: string;
      content: {
        text?: string;
        mentions?: MentionData[];
      };
      attachments: Array<{
        file: Buffer;
        fileName: string;
        mimeType: string;
        fileSize: number;
      }>;
      replyToMessageId?: string;
    }
  ): Promise<{
    message: MessageResponse;
    uploadResults: Array<{
      attachmentId: string;
      success: boolean;
      url?: string;
      error?: string;
    }>;
    deliveryStatus: 'sent' | 'queued';
  }>;

  // Forward message to conversations
  forwardMessage(
    userId: string,
    messageId: string,
    params: {
      conversationIds: string[];
      comment?: string;
    }
  ): Promise<{
    results: Array<{
      conversationId: string;
      message?: MessageResponse;
      success: boolean;
      error?: string;
    }>;
  }>;

  // =============== MESSAGE RETRIEVAL ===============

  // Get conversation messages with business logic
  getConversationMessages(
    conversationId: string,
    userId: string,
    options?: {
      limit?: number;
      beforeMessageId?: string;
      afterMessageId?: string;
      messageTypes?: MessageType[];
      includeSystem?: boolean;
      markAsRead?: boolean; // Auto-mark as read when loading
    }
  ): Promise<{
    messages: MessageResponse[];
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
    oldestMessageId?: string;
    newestMessageId?: string;
    unreadCount: number;
  }>;

  // Get specific message with context
  getMessageById(
    messageId: string,
    userId: string
  ): Promise<{
    message: MessageResponse;
    context: {
      conversation: ConversationSummary;
      replyTo?: MessageResponse;
      replies: MessageResponse[];
    };
  } | null>;

  // Get messages around specific message
  getMessageContext(
    messageId: string,
    userId: string,
    options?: {
      beforeCount?: number;
      afterCount?: number;
    }
  ): Promise<{
    messages: MessageResponse[];
    targetMessage: MessageResponse;
    conversation: ConversationSummary;
  }>;

  // Search messages with advanced filters
  searchMessages(
    userId: string,
    query: string,
    options?: {
      conversationId?: string;
      messageTypes?: MessageType[];
      fromDate?: Date;
      toDate?: Date;
      fromUserId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    messages: MessageResponse[];
    total: number;
    hasMore: boolean;
    conversations: ConversationSummary[]; // Related conversations
  }>;

  // =============== MESSAGE MANAGEMENT ===============

  // Edit message with permission check
  editMessage(
    messageId: string,
    userId: string,
    params: {
      content: {
        text: string;
        mentions?: MentionData[];
      };
      editReason?: string;
    }
  ): Promise<{
    message: MessageResponse;
    previousContent: string;
    notifiedUsers: string[];
  }>;

  // Delete message with business rules
  deleteMessage(
    messageId: string,
    userId: string,
    deleteForEveryone: boolean = false
  ): Promise<{
    success: true;
    deletedAt: Date;
    notifiedUsers: string[];
  }>;

  // React to message
  reactToMessage(
    messageId: string,
    userId: string,
    emoji: string,
    action: 'add' | 'remove'
  ): Promise<{
    reactions: ReactionSummary[];
    userReactions: string[];
    notifiedUsers: string[]; // Message author + other reactors
  }>;

  // Get message reactions with user info
  getMessageReactions(
    messageId: string,
    userId: string,
    options?: {
      emoji?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    reactions: Array<{
      emoji: string;
      users: UserSummary[];
      count: number;
      userReacted: boolean;
      addedAt: Date;
    }>;
    total: number;
  }>;

  // =============== MESSAGE STATUS ===============

  // Mark messages as read with side effects
  markMessagesAsRead(
    userId: string,
    params: {
      conversationId: string;
      messageIds?: string[]; // If empty, mark all as read
      readTimestamp?: Date;
    }
  ): Promise<{
    markedCount: number;
    lastReadMessageId: string;
    notifiedUsers: string[]; // For read receipts
    updatedUnreadCount: number;
  }>;

  // Get unread count with conversation details
  getUnreadCount(
    userId: string,
    conversationId?: string
  ): Promise<{
    totalUnread: number;
    conversations: Array<{
      conversationId: string;
      conversationName: string;
      unreadCount: number;
      lastMessage: MessageSummary;
      lastUnreadMessage: MessageSummary;
    }>;
  }>;

  // Get message delivery status with user info
  getMessageDeliveryStatus(
    messageId: string,
    userId: string
  ): Promise<{
    messageId: string;
    deliveryStats: {
      sent: number;
      delivered: number;
      read: number;
      failed: number;
      total: number;
    };
    recipients: Array<{
      user: UserSummary;
      status: MessageDeliveryStatus;
      timestamp: Date;
      deviceInfo?: string;
    }>;
    canViewStatus: boolean; // Based on privacy settings
  }>;

  // =============== MESSAGE UTILITIES ===============

  // Get message thread (original + replies)
  getMessageThread(
    messageId: string,
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    originalMessage: MessageResponse;
    replies: MessageResponse[];
    totalReplies: number;
    hasMoreReplies: boolean;
  }>;

  // Report message
  reportMessage(
    messageId: string,
    reporterId: string,
    params: {
      reason: 'spam' | 'harassment' | 'inappropriate' | 'other';
      description?: string;
    }
  ): Promise<{
    reportId: string;
    status: 'received' | 'reviewing';
  }>;

  // Get message edit history
  getMessageEditHistory(
    messageId: string,
    userId: string
  ): Promise<{
    messageId: string;
    canView: boolean;
    edits: Array<{
      content: string;
      editedAt: Date;
      editedBy: UserSummary;
      editReason?: string;
    }>;
    totalEdits: number;
  }>;

  // =============== BUSINESS RULES VALIDATION ===============

  // Validate message content
  validateMessageContent(
    senderId: string,
    conversationId: string,
    content: {
      text?: string;
      attachments?: AttachmentData[];
      mentions?: MentionData[];
    }
  ): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }>;

  // Check if user can send message
  canSendMessage(
    userId: string,
    conversationId: string
  ): Promise<{
    allowed: boolean;
    reason?: string;
  }>;

  // Check rate limits
  checkRateLimit(
    userId: string,
    conversationId: string
  ): Promise<{
    allowed: boolean;
    remainingQuota: number;
    resetTime?: Date;
  }>;
}
```

---

### **Real-time Service Requirements**

#### **WebSocket Event Handlers:**
```typescript
interface IRealtimeService {
  // =============== CONNECTION MANAGEMENT ===============

  // Handle user connection
  handleUserConnect(
    userId: string,
    socketId: string,
    metadata: {
      deviceId?: string;
      platform?: string;
      appVersion?: string;
    }
  ): Promise<{
    conversationIds: string[];
    unreadCount: number;
    onlineContacts: string[];
  }>;

  // Handle user disconnection
  handleUserDisconnect(
    userId: string,
    socketId: string
  ): Promise<{
    updatedPresence: boolean;
    notifiedContacts: string[];
  }>;

  // Join conversation rooms
  joinConversationRooms(
    userId: string,
    socketId: string,
    conversationIds: string[]
  ): Promise<{
    joined: string[];
    failed: string[];
  }>;

  // Leave conversation rooms
  leaveConversationRooms(
    userId: string,
    socketId: string,
    conversationIds: string[]
  ): Promise<{
    left: string[];
  }>;

  // =============== MESSAGE EVENTS ===============

  // Handle real-time message sending
  handleSendMessage(
    userId: string,
    socketId: string,
    data: {
      conversationId: string;
      content: MessageContent;
      replyToMessageId?: string;
      tempId: string; // Client-side ID for deduplication
    }
  ): Promise<{
    message?: MessageResponse;
    tempId: string;
    status: 'sent' | 'failed';
    error?: string;
    broadcastedTo: string[];
  }>;

  // Broadcast new message to participants
  broadcastNewMessage(
    message: MessageDocument,
    excludeUserId?: string
  ): Promise<{
    deliveredTo: string[];
    failedDeliveries: string[];
  }>;

  // Broadcast message status update
  broadcastMessageStatusUpdate(
    messageId: string,
    status: MessageDeliveryStatus,
    userId: string,
    timestamp: Date
  ): Promise<{
    notifiedUsers: string[];
  }>;

  // Broadcast message edit
  broadcastMessageEdit(
    message: MessageDocument,
    previousContent: string,
    editedBy: string
  ): Promise<{
    notifiedUsers: string[];
  }>;

  // Broadcast message deletion
  broadcastMessageDeletion(
    messageId: string,
    conversationId: string,
    deletedBy: string,
    deleteForEveryone: boolean
  ): Promise<{
    notifiedUsers: string[];
  }>;

  // Broadcast reaction update
  broadcastReactionUpdate(
    messageId: string,
    reactions: ReactionSummary[]
  ): Promise<{
    notifiedUsers: string[];
  }>;

  // =============== CONVERSATION EVENTS ===============

  // Broadcast new conversation
  broadcastNewConversation(
    conversation: ConversationDocument,
    createdBy: string
  ): Promise<{
    notifiedUsers: string[];
  }>;

  // Broadcast conversation update
  broadcastConversationUpdate(
    conversationId: string,
    changes: Partial<ConversationResponse>,
    updatedBy: string
  ): Promise<{
    notifiedUsers: string[];
  }>;

  // Broadcast user joined conversation
  broadcastUserJoined(
    conversationId: string,
    user: UserDocument,
    addedBy: string
  ): Promise<{
    notifiedUsers: string[];
  }>;

  // Broadcast user left conversation
  broadcastUserLeft(
    conversationId: string,
    userId: string,
    reason: 'left' | 'removed' | 'banned'
  ): Promise<{
    notifiedUsers: string[];
  }>;

  // =============== PRESENCE EVENTS ===============

  // Handle typing indicators
  handleTypingEvent(
    userId: string,
    conversationId: string,
    isTyping: boolean
  ): Promise<{
    broadcastedTo: string[];
  }>;

  // Update user presence
  updateUserPresence(
    userId: string,
    status: 'online' | 'offline' | 'away',
    lastSeen?: Date
  ): Promise<{
    notifiedContacts: string[];
    conversationsUpdated: string[];
  }>;

  // Get conversation presence
  getConversationPresence(
    conversationId: string
  ): Promise<{
    onlineUsers: string[];
    typingUsers: string[];
    totalParticipants: number;
  }>;

  // =============== UTILITIES ===============

  // Get user's active connections
  getUserConnections(userId: string): Promise<{
    socketIds: string[];
    devices: Array<{
      socketId: string;
      deviceId?: string;
      platform?: string;
      connectedAt: Date;
    }>;
  }>;

  // Broadcast custom event to user
  broadcastToUser(
    userId: string,
    event: string,
    data: any
  ): Promise<{
    delivered: boolean;
    activeConnections: number;
  }>;

  // Broadcast event to conversation
  broadcastToConversation(
    conversationId: string,
    event: string,
    data: any,
    excludeUserId?: string
  ): Promise<{
    deliveredTo: string[];
    totalRecipients: number;
  }>;
}
```

---

## 🎯 **SERVICE DEPENDENCIES**

### **Dependency Injection Setup:**
```typescript
// ConversationService dependencies
interface ConversationServiceDeps {
  conversationRepository: IConversationRepository;
  messageRepository: IMessageRepository;
  userRepository: IUserRepository;
  realtimeService: IRealtimeService;
  notificationService: INotificationService;
  cacheService: ICacheService;
  logger: ILogger;
}

// MessageService dependencies  
interface MessageServiceDeps {
  messageRepository: IMessageRepository;
  conversationRepository: IConversationRepository;
  messageStatusRepository: IMessageStatusRepository;
  attachmentRepository: IAttachmentRepository;
  userRepository: IUserRepository;
  realtimeService: IRealtimeService;
  fileService: IFileService;
  notificationService: INotificationService;
  cacheService: ICacheService;
  logger: ILogger;
}

// RealtimeService dependencies
interface RealtimeServiceDeps {
  conversationService: IConversationService;
  messageService: IMessageService;
  userRepository: IUserRepository;
  redisService: IRedisService;
  socketGateway: ISocketGateway;
  logger: ILogger;
}
```

---

## 🚀 **IMPLEMENTATION PRIORITY**

### **🔴 Phase 1 - Core Services (Week 1)**
```typescript
ConversationService:
✅ createDirectConversation
✅ createGroupConversation
✅ getUserConversations
✅ getConversationById
✅ addParticipants

MessageService:
✅ sendMessage
✅ getConversationMessages  
✅ markMessagesAsRead
✅ getUnreadCount

RealtimeService:
✅ handleUserConnect
✅ handleSendMessage
✅ broadcastNewMessage
```

### **🟡 Phase 2 - Advanced Features (Week 2-3)**
```typescript
✅ Message editing/deletion
✅ Message reactions
✅ File attachments
✅ Typing indicators
✅ Presence management
✅ Search functionality
```

### **🟢 Phase 3 - Premium Features (Week 4+)**
```typescript
✅ Message threading
✅ Advanced permissions
✅ Rate limiting
✅ Analytics
✅ Reporting system
```

**With API Spec, Repository Spec, and now Service Spec completed, we have a complete blueprint for implementation!** 🎯
