# Real-time Last Message Updates Architecture

## 🎯 Problem Analysis

Conversation list cần hiển thị lastMessage với thông tin:
- **Sender Name**: Tên người gửi
- **Content**: Nội dung tin nhắn (hoặc file description)
- **Timestamp**: Thời gian gửi (relative time)
- **Read Status**: Đã đọc hay chưa
- **Real-time Updates**: Cập nhật ngay khi có tin nhắn mới

## 🏗️ Architecture Design

### Data Flow
```
📱 New Message Sent
    ↓
🔌 ChatGateway (handleSendMessage)
    ↓
💾 MessagesService (save message)
    ↓
🔄 Emit lastMessage update events
    ↓
📋 Frontend updates conversation list
```

### Event Strategy
```typescript
// Server → Client Events
'conversation_last_message_update' // Update lastMessage for specific conversation
'conversations_bulk_update'        // Bulk update multiple conversations
```

## 🎯 Implementation Strategy

### 1. LastMessage Data Structure
```typescript
interface LastMessageDto {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'audio' | 'video';
  timestamp: number;
  readBy: string[]; // Array of userIds who read this message
  isRead: boolean;  // For current user context
  deliveredTo: string[];
}
```

### 2. Socket.IO Events

#### Server → Client
```typescript
// Single conversation update
socket.emit('conversation_last_message_update', {
  conversationId: 'conv_123',
  lastMessage: LastMessageDto,
  unreadCount: 5
});

// Bulk conversations update (for efficiency)
socket.emit('conversations_bulk_update', {
  updates: [
    { conversationId: 'conv_123', lastMessage: LastMessageDto, unreadCount: 5 },
    { conversationId: 'conv_456', lastMessage: LastMessageDto, unreadCount: 0 }
  ]
});
```

#### Client → Server
```typescript
// Request fresh lastMessage data
socket.emit('get_conversations_last_messages', {
  conversationIds: ['conv_123', 'conv_456']
});
```

### 3. Integration Points

#### In ChatGateway.handleSendMessage()
```typescript
// After message is saved successfully
await this.broadcastLastMessageUpdate(message, conversation);
```

#### In Message Read Handlers
```typescript
// After messages marked as read
await this.updateLastMessageReadStatus(conversationId, userId);
```

## 🚀 Performance Optimizations

### 1. Smart Broadcasting
- **Participant-only**: Chỉ broadcast cho conversation participants
- **User rooms**: Sử dụng `user:${userId}` rooms thay vì broadcast toàn bộ
- **Batch updates**: Group multiple updates together

### 2. Content Optimization
- **File messages**: Show "📎 Sent a photo" thay vì full content
- **Long messages**: Truncate content > 100 characters
- **Emoji handling**: Proper emoji display trong previews

### 3. Read Status Optimization
- **Redis caching**: Cache read status để tránh query DB
- **Smart updates**: Chỉ update khi read status thực sự thay đổi

## 📱 Frontend Integration

### React/Vue Example
```typescript
// Listen for lastMessage updates
socket.on('conversation_last_message_update', (data) => {
  updateConversationInList(data.conversationId, {
    lastMessage: data.lastMessage,
    unreadCount: data.unreadCount
  });
});

// Handle bulk updates
socket.on('conversations_bulk_update', (data) => {
  data.updates.forEach(update => {
    updateConversationInList(update.conversationId, update);
  });
});
```

### Mobile Considerations
```typescript
// Efficient updates for mobile
const ConversationList = {
  handleLastMessageUpdate(data) {
    // Update only visible conversations
    if (this.isConversationVisible(data.conversationId)) {
      this.updateUI(data);
    } else {
      // Queue update for when conversation becomes visible
      this.queueUpdate(data);
    }
  }
};
```

## 🛡️ Edge Cases Handling

### 1. Message Deletion
```typescript
// When message is deleted, update lastMessage to previous message
await this.handleMessageDeletion(messageId, conversationId);
```

### 2. Edit Message
```typescript
// When lastMessage is edited, update content in conversation list
await this.handleMessageEdit(messageId, newContent);
```

### 3. Multiple Device Sync
```typescript
// Ensure lastMessage consistency across user's devices
await this.syncLastMessageToAllDevices(userId, conversationId, lastMessage);
```

## 🎉 Benefits

1. **Real-time UX**: Conversation list luôn up-to-date
2. **Performance**: Efficient broadcasting và caching
3. **Consistency**: Đồng bộ across multiple devices
4. **Rich Content**: Support files, emoji, mentions
5. **Read Status**: Accurate unread counts và read indicators

---

**Next Steps**: Implement ChatGateway integration và lastMessage broadcasting system
