# 📋 Conversations & Messages API Specification

**Version:** MVP 1.0  
**Purpose:** Complete API definition for Chat System  
**Architecture:** REST API + WebSocket for real-time features  

---

## 🎯 **FUNCTIONAL REQUIREMENTS**

### **👥 Conversations Module**

#### **Core Features:**
```typescript
// 🎯 Feature 1: Conversation Management
- Create direct conversation (1-on-1)
- Create group conversation (multiple users)
- Get user's conversations list
- Get specific conversation details
- Update conversation metadata (name, avatar, settings)
- Archive/restore conversations
- Delete conversations

// 🎯 Feature 2: Participant Management  
- Add participants to group
- Remove participants from group
- Update participant roles (admin/member)
- Leave conversation
- Get conversation participants
- Check user permissions in conversation

// 🎯 Feature 3: Conversation Settings
- Mute/unmute notifications
- Set disappearing messages timer
- Configure group permissions
- Pin/unpin conversations
- Block conversations

// 🎯 Feature 4: Conversation Discovery
- Search conversations by name/content
- Get recent conversations
- Get archived conversations
- Get conversation by participants (check if exists)
```

#### **Business Rules:**
```typescript
// Direct Conversations
- Auto-create if doesn't exist between 2 users
- Cannot have more than 2 participants
- Cannot be deleted, only archived
- Both users are default admins

// Group Conversations
- Minimum 3 participants (creator + 2 others)
- Maximum 1000 participants for performance
- Creator is default admin
- At least 1 admin must remain
- Can be deleted by admin
- Name is required, max 100 characters

// Permissions
- Only participants can see conversation
- Only admins can add/remove members (if allowed in settings)
- Only admins can change group metadata
- Members can leave anytime
```

---

### **💬 Messages Module**

#### **Core Features:**
```typescript
// 🎯 Feature 1: Message Sending
- Send text message
- Send message with attachments (images, files, videos)
- Send system messages (user joined, left, etc.)
- Reply to specific message (threading)
- Forward messages
- Send message with mentions (@user)

// 🎯 Feature 2: Message Retrieval
- Get conversation messages (paginated)
- Get message by ID
- Get messages around specific message (context)
- Search messages in conversation
- Get message thread (replies)

// 🎯 Feature 3: Message Management
- Edit message content
- Delete message (soft delete)
- React to message (emoji reactions)
- Remove reaction
- Report message

// 🎯 Feature 4: Message Status
- Track message delivery status
- Mark messages as read
- Get unread message count
- Sync read status across devices
- Get message read receipts

// 🎯 Feature 5: Real-time Features
- Real-time message delivery
- Typing indicators
- Online/offline status
- Message status updates
- Reaction updates
```

#### **Business Rules:**
```typescript
// Message Constraints
- Text messages: max 4000 characters
- File attachments: max 100MB per file
- Max 10 attachments per message
- Message edit timeout: 24 hours
- Message history: unlimited retention

// Message Status
- Sent: message sent from client
- Delivered: message reached recipient device
- Read: recipient opened conversation and saw message
- Failed: delivery failed after retries

// Permissions
- Only sender can edit/delete own messages
- Admins can delete any message in group
- System messages cannot be edited/deleted
- Deleted messages show "Message deleted" placeholder

// Reactions
- Max 20 different reaction types per message
- Max 1000 total reactions per message
- User can react with multiple different emojis
- Real-time reaction updates to all participants
```

---

## 🔌 **API ENDPOINTS SPECIFICATION**

### **👥 Conversations REST API**

```typescript
// Base URL: /api/v1/conversations

interface ConversationEndpoints {
  // =============== CONVERSATION MANAGEMENT ===============
  
  // Create direct conversation
  'POST /': {
    body: {
      participantId: string; // Other user ID
      initialMessage?: string; // Optional first message
    };
    response: {
      conversation: ConversationResponse;
      created: boolean; // true if new, false if existing
    };
  };

  // Create group conversation  
  'POST /group': {
    body: {
      name: string;
      description?: string;
      participantIds: string[]; // Min 2 other users
      avatarUrl?: string;
      settings?: GroupSettings;
    };
    response: {
      conversation: ConversationResponse;
      invitesSent: string[]; // User IDs notified
    };
  };

  // Get user's conversations
  'GET /': {
    query: {
      type?: 'direct' | 'group' | 'all';
      status?: 'active' | 'archived' | 'all';
      limit?: number; // Default 20, max 100
      offset?: number;
      search?: string; // Search by name/last message
      sortBy?: 'updated' | 'created' | 'name';
    };
    response: {
      conversations: ConversationListItem[];
      total: number;
      hasMore: boolean;
    };
  };

  // Get specific conversation
  'GET /:conversationId': {
    response: {
      conversation: ConversationResponse;
      permissions: UserPermissions;
    };
  };

  // Update conversation metadata
  'PUT /:conversationId': {
    body: {
      name?: string;
      description?: string;
      avatarUrl?: string;
      settings?: Partial<GroupSettings>;
    };
    response: {
      conversation: ConversationResponse;
    };
  };

  // Archive/restore conversation
  'PUT /:conversationId/archive': {
    body: {
      archived: boolean;
    };
    response: {
      success: true;
    };
  };

  // Delete conversation (groups only)
  'DELETE /:conversationId': {
    response: {
      success: true;
    };
  };

  // =============== PARTICIPANT MANAGEMENT ===============

  // Get conversation participants
  'GET /:conversationId/participants': {
    query: {
      limit?: number;
      offset?: number;
      role?: 'admin' | 'member' | 'all';
    };
    response: {
      participants: ParticipantResponse[];
      total: number;
    };
  };

  // Add participants to group
  'POST /:conversationId/participants': {
    body: {
      userIds: string[];
      role?: 'member' | 'admin'; // Default member
    };
    response: {
      added: ParticipantResponse[];
      failed: { userId: string; reason: string }[];
    };
  };

  // Update participant role
  'PUT /:conversationId/participants/:userId': {
    body: {
      role: 'admin' | 'member';
    };
    response: {
      participant: ParticipantResponse;
    };
  };

  // Remove participant
  'DELETE /:conversationId/participants/:userId': {
    response: {
      success: true;
    };
  };

  // Leave conversation
  'POST /:conversationId/leave': {
    response: {
      success: true;
    };
  };

  // =============== CONVERSATION UTILITIES ===============

  // Check if conversation exists between users
  'POST /check-exists': {
    body: {
      participantIds: string[];
    };
    response: {
      exists: boolean;
      conversationId?: string;
    };
  };

  // Search conversations
  'GET /search': {
    query: {
      q: string; // Search term
      limit?: number;
      type?: 'direct' | 'group' | 'all';
    };
    response: {
      conversations: ConversationListItem[];
      total: number;
    };
  };
}
```

### **💬 Messages REST API**

```typescript
// Base URL: /api/v1/messages

interface MessageEndpoints {
  // =============== MESSAGE SENDING ===============

  // Send text message
  'POST /': {
    body: {
      conversationId: string;
      content: {
        text: string;
        mentions?: MentionData[];
      };
      replyToMessageId?: string;
      metadata?: {
        platform: 'ios' | 'android' | 'web';
        deviceInfo?: string;
      };
    };
    response: {
      message: MessageResponse;
      deliveryStatus: 'sent' | 'queued';
    };
  };

  // Send message with attachments
  'POST /with-attachments': {
    body: FormData; // multipart/form-data
    fields: {
      conversationId: string;
      content: string; // JSON string
      attachments: File[]; // Max 10 files
      replyToMessageId?: string;
    };
    response: {
      message: MessageResponse;
      uploadResults: UploadResult[];
    };
  };

  // Forward message
  'POST /:messageId/forward': {
    body: {
      conversationIds: string[];
      comment?: string; // Optional comment when forwarding
    };
    response: {
      results: {
        conversationId: string;
        message: MessageResponse;
        success: boolean;
      }[];
    };
  };

  // =============== MESSAGE RETRIEVAL ===============

  // Get conversation messages
  'GET /conversation/:conversationId': {
    query: {
      limit?: number; // Default 50, max 100
      beforeMessageId?: string; // For pagination (older messages)
      afterMessageId?: string;  // For loading newer messages
      messageTypes?: string; // Comma-separated: text,image,file
      includeSystem?: boolean; // Include system messages
    };
    response: {
      messages: MessageResponse[];
      hasMoreBefore: boolean;
      hasMoreAfter: boolean;
      oldestMessageId?: string;
      newestMessageId?: string;
    };
  };

  // Get specific message
  'GET /:messageId': {
    response: {
      message: MessageResponse;
      context: {
        conversation: ConversationSummary;
        replyTo?: MessageResponse;
        replies: MessageResponse[];
      };
    };
  };

  // Get messages around specific message (context loading)
  'GET /:messageId/context': {
    query: {
      beforeCount?: number; // Messages before (default 10)
      afterCount?: number;  // Messages after (default 10)
    };
    response: {
      messages: MessageResponse[];
      targetMessage: MessageResponse;
    };
  };

  // Search messages in conversation
  'GET /conversation/:conversationId/search': {
    query: {
      q: string; // Search query
      messageTypes?: string;
      fromDate?: string; // ISO date
      toDate?: string;
      fromUser?: string; // User ID
      limit?: number;
      offset?: number;
    };
    response: {
      messages: MessageResponse[];
      total: number;
      hasMore: boolean;
    };
  };

  // =============== MESSAGE MANAGEMENT ===============

  // Edit message
  'PUT /:messageId': {
    body: {
      content: {
        text: string;
        mentions?: MentionData[];
      };
      editReason?: string;
    };
    response: {
      message: MessageResponse;
      previousContent: string;
    };
  };

  // Delete message
  'DELETE /:messageId': {
    body: {
      deleteForEveryone: boolean; // true = delete for all, false = delete for me
    };
    response: {
      success: true;
      deletedAt: string;
    };
  };

  // React to message
  'POST /:messageId/reactions': {
    body: {
      emoji: string; // Unicode emoji
      action: 'add' | 'remove';
    };
    response: {
      reactions: {
        emoji: string;
        users: string[];
        count: number;
      }[];
      userReactions: string[]; // Current user's reactions
    };
  };

  // Get message reactions
  'GET /:messageId/reactions': {
    query: {
      emoji?: string; // Filter by specific emoji
      limit?: number;
      offset?: number;
    };
    response: {
      reactions: {
        emoji: string;
        users: UserSummary[];
        count: number;
        addedAt: string;
      }[];
      total: number;
    };
  };

  // =============== MESSAGE STATUS ===============

  // Mark messages as read
  'POST /conversation/:conversationId/mark-read': {
    body: {
      messageIds?: string[]; // Specific messages, or all if empty
      readTimestamp?: string; // ISO timestamp
    };
    response: {
      markedCount: number;
      lastReadMessageId: string;
    };
  };

  // Get unread count
  'GET /unread-count': {
    query: {
      conversationId?: string; // Specific conversation or all
    };
    response: {
      totalUnread: number;
      conversations: {
        conversationId: string;
        unreadCount: number;
        lastMessage: MessageSummary;
      }[];
    };
  };

  // Get message delivery status
  'GET /:messageId/delivery-status': {
    response: {
      messageId: string;
      deliveryStatus: {
        sent: number;
        delivered: number;
        read: number;
        failed: number;
      };
      recipients: {
        userId: string;
        status: 'sent' | 'delivered' | 'read' | 'failed';
        timestamp: string;
        deviceInfo?: string;
      }[];
    };
  };

  // =============== MESSAGE UTILITIES ===============

  // Report message
  'POST /:messageId/report': {
    body: {
      reason: 'spam' | 'harassment' | 'inappropriate' | 'other';
      description?: string;
    };
    response: {
      reportId: string;
      status: 'received';
    };
  };

  // Get message edit history
  'GET /:messageId/edit-history': {
    response: {
      messageId: string;
      edits: {
        content: string;
        editedAt: string;
        editedBy: string;
        editReason?: string;
      }[];
      totalEdits: number;
    };
  };
}
```

### **🔄 WebSocket Events**

```typescript
// WebSocket connection: ws://localhost:3000/chat
// Authentication: JWT token in connection query

interface WebSocketEvents {
  // =============== CONNECTION EVENTS ===============
  
  // Client connects
  connect: {
    auth: {
      token: string; // JWT token
      deviceId?: string;
      platform?: 'ios' | 'android' | 'web';
    };
  };

  // Join conversation rooms
  'join-conversations': {
    data: {
      conversationIds: string[];
    };
  };

  // Leave conversation rooms  
  'leave-conversations': {
    data: {
      conversationIds: string[];
    };
  };

  // =============== MESSAGE EVENTS ===============

  // Send message (real-time)
  'send-message': {
    data: {
      conversationId: string;
      content: {
        text: string;
        mentions?: MentionData[];
      };
      replyToMessageId?: string;
      tempId: string; // Client-generated ID for deduplication
    };
    response: {
      message: MessageResponse;
      tempId: string;
      status: 'sent' | 'failed';
      error?: string;
    };
  };

  // Receive new message
  'new-message': {
    data: {
      message: MessageResponse;
      conversation: ConversationSummary;
    };
  };

  // Message status update
  'message-status-update': {
    data: {
      messageId: string;
      status: 'delivered' | 'read';
      userId: string;
      timestamp: string;
    };
  };

  // Message edited
  'message-edited': {
    data: {
      message: MessageResponse;
      previousContent: string;
      editedAt: string;
    };
  };

  // Message deleted
  'message-deleted': {
    data: {
      messageId: string;
      conversationId: string;
      deletedBy: string;
      deletedAt: string;
      deleteForEveryone: boolean;
    };
  };

  // Message reactions update
  'message-reactions-update': {
    data: {
      messageId: string;
      reactions: {
        emoji: string;
        users: string[];
        count: number;
      }[];
    };
  };

  // =============== CONVERSATION EVENTS ===============

  // New conversation created
  'new-conversation': {
    data: {
      conversation: ConversationResponse;
    };
  };

  // Conversation updated
  'conversation-updated': {
    data: {
      conversationId: string;
      changes: Partial<ConversationResponse>;
      updatedBy: string;
    };
  };

  // User joined conversation
  'user-joined': {
    data: {
      conversationId: string;
      user: UserSummary;
      addedBy: string;
      joinedAt: string;
    };
  };

  // User left conversation
  'user-left': {
    data: {
      conversationId: string;
      userId: string;
      leftAt: string;
      reason: 'left' | 'removed' | 'banned';
    };
  };

  // =============== PRESENCE EVENTS ===============

  // Typing indicators
  'typing-start': {
    data: {
      conversationId: string;
    };
  };

  'typing-stop': {
    data: {
      conversationId: string;  
    };
  };

  'user-typing': {
    data: {
      conversationId: string;
      userId: string;
      isTyping: boolean;
    };
  };

  // Online status
  'user-online': {
    data: {
      userId: string;
      lastSeen: string;
    };
  };

  'user-offline': {
    data: {
      userId: string;
      lastSeen: string;
    };
  };

  // =============== ERROR EVENTS ===============

  'error': {
    data: {
      code: string;
      message: string;
      details?: any;
    };
  };

  'rate-limit-exceeded': {
    data: {
      retryAfter: number; // Seconds
    };
  };
}
```

---

## 📄 **RESPONSE DATA TYPES**

```typescript
// Core conversation response
interface ConversationResponse {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  description?: string;
  avatarUrl?: string;
  participants: ParticipantResponse[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: MessageSummary;
  unreadCount: number;
  settings: GroupSettings;
  status: {
    isActive: boolean;
    isArchived: boolean;
    isPinned: boolean;
  };
  permissions: UserPermissions;
}

// Conversation list item (lightweight)
interface ConversationListItem {
  id: string;
  type: 'direct' | 'group';
  name: string;
  avatarUrl?: string;
  participantCount: number;
  lastMessage?: MessageSummary;
  unreadCount: number;
  lastActivity: string;
  isArchived: boolean;
  isPinned: boolean;
  isMuted: boolean;
}

// Participant details
interface ParticipantResponse {
  userId: string;
  role: 'admin' | 'member';
  joinedAt: string;
  lastSeenAt?: string;
  addedBy: string;
  isOnline: boolean;
  user: UserSummary;
}

// Core message response
interface MessageResponse {
  id: string;
  conversationId: string;
  senderId: string;
  messageType: 'text' | 'image' | 'file' | 'video' | 'audio' | 'system';
  content: {
    text: string;
    mentions: MentionData[];
  };
  attachments: AttachmentData[];
  replyTo?: MessageSummary;
  reactions: ReactionData[];
  status: {
    isEdited: boolean;
    editedAt?: string;
    isDeleted: boolean;
    deletedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
  sender: UserSummary;
  deliveryStatus?: {
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: string;
  };
}

// Supporting data types
interface UserSummary {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastSeen?: string;
}

interface MessageSummary {
  id: string;
  content: string;
  messageType: string;
  senderId: string;
  createdAt: string;
}

interface MentionData {
  userId: string;
  username: string;
  offset: number;
  length: number;
}

interface AttachmentData {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  url: string;
  thumbnailUrl?: string;
  duration?: number;
}

interface ReactionData {
  emoji: string;
  users: UserSummary[];
  count: number;
}

interface GroupSettings {
  allowMembersToAdd: boolean;
  allowAllToSend: boolean;
  muteNotifications: boolean;
  disappearingMessages: number; // Hours, 0 = disabled
}

interface UserPermissions {
  canSendMessages: boolean;
  canAddMembers: boolean;
  canRemoveMembers: boolean;
  canEditGroup: boolean;
  canDeleteGroup: boolean;
  isAdmin: boolean;
}
```

---

## 🎯 **MVP PRIORITY MATRIX**

### **🔴 Phase 1 - Core Chat (Week 1-2)**
```typescript
Priority: CRITICAL - Must have for basic chat

Conversations:
✅ POST / (create direct conversation)
✅ GET / (get conversations list)  
✅ GET /:id (get conversation details)

Messages:
✅ POST / (send text message)
✅ GET /conversation/:id (get messages)
✅ POST /conversation/:id/mark-read (mark as read)

WebSocket:
✅ send-message (real-time sending)
✅ new-message (real-time receiving)
✅ message-status-update (delivery status)
```

### **🟡 Phase 2 - Group Chat (Week 3-4)**  
```typescript
Priority: HIGH - Essential for group features

Conversations:
✅ POST /group (create group)
✅ POST /:id/participants (add members)
✅ DELETE /:id/participants/:userId (remove member)
✅ PUT /:id (update group info)

Messages:
✅ Message with mentions
✅ Reply to message
✅ Message reactions

WebSocket:  
✅ typing indicators
✅ user-joined/user-left events
```

### **🟢 Phase 3 - Rich Features (Week 5-6)**
```typescript
Priority: MEDIUM - Nice to have

Messages:
✅ File attachments
✅ Message edit/delete
✅ Message search
✅ Forward messages

Advanced:
✅ Online/offline status
✅ Message delivery receipts
✅ Conversation archive/pin
```

Bây giờ với API spec này, chúng ta có thể bắt đầu implement Repository và Service layers một cách có hệ thống! 🚀
