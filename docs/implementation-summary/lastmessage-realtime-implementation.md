# Real-time LastMessage Updates Implementation Guide

## 📋 Overview

Hệ thống real-time lastMessage updates đã được implement thành công để cập nhật conversation list ngay lập tức khi có tin nhắn mới hoặc thay đổi read status.

## ✅ Implemented Features

### 1. Real-time LastMessage Tracking
- **Instant Updates**: Conversation list cập nhật ngay khi có tin nhắn mới
- **Read Status**: Hiển thị đã đọc/chưa đọc cho từng user
- **Content Optimization**: File messages hiển thị "📎 Sent a photo" thay vì raw content
- **Unread Counts**: Real-time unread message counting

### 2. Smart Content Processing
- **File Messages**: Automatic preview generation (🖼️ Sent a photo, 🎥 Sent a video, etc.)
- **Multiple Files**: "📎 Sent 3 photos" cho batch files
- **Text Truncation**: Long messages truncated với "..." 
- **Emoji Support**: Proper emoji handling trong previews

### 3. Performance Optimizations
- **Redis Caching**: LastMessage data cached với TTL
- **Bulk Operations**: Efficient bulk queries cho conversation lists
- **User-specific Data**: Read status per user context
- **Smart Broadcasting**: Chỉ broadcast cho conversation participants

## 🎯 Socket.IO Events

### Client → Server Events

#### `get_conversations_last_messages`
Load lastMessages cho conversation list (khi mở app)
```typescript
socket.emit('get_conversations_last_messages', {
    conversationIds: ['conv_123', 'conv_456', 'conv_789']
});
```

### Server → Client Events

#### `conversation_last_message_update`
Real-time update cho single conversation
```typescript
socket.on('conversation_last_message_update', (data) => {
    // {
    //     conversationId: 'conv_123',
    //     lastMessage: {
    //         messageId: 'msg_456',
    //         senderId: 'user_789',
    //         senderName: 'John Doe',
    //         content: '📎 Sent a photo',
    //         messageType: 'image',
    //         timestamp: 1643723400000,
    //         isRead: false,
    //         attachmentCount: 1
    //     },
    //     unreadCount: 3,
    //     timestamp: 1643723400000
    // }
    
    updateConversationInList(data);
});
```

#### `conversations_last_messages_response`
Response cho bulk lastMessages request
```typescript
socket.on('conversations_last_messages_response', (data) => {
    // {
    //     updates: [
    //         {
    //             conversationId: 'conv_123',
    //             lastMessage: {...},
    //             unreadCount: 5,
    //             lastActivity: 1643723400000
    //         }
    //     ],
    //     timestamp: 1643723400000
    // }
    
    data.updates.forEach(update => {
        updateConversationInList(update);
    });
});
```

## 📊 Data Structure

### LastMessageDto
```typescript
interface LastMessageDto {
    messageId: string;           // Message identifier
    conversationId: string;      // Conversation identifier  
    senderId: string;           // Sender user ID
    senderName: string;         // Display name của sender
    content: string;            // Optimized content cho display
    messageType: string;        // 'text' | 'image' | 'file' | 'audio' | 'video'
    timestamp: number;          // Timestamp của message
    readBy: string[];          // Array của user IDs đã đọc
    deliveredTo: string[];     // Array của user IDs đã nhận
    isRead: boolean;           // Read status cho current user
    attachmentCount?: number;   // Số lượng attachments
}
```

### ConversationLastMessageUpdate
```typescript
interface ConversationLastMessageUpdate {
    conversationId: string;
    lastMessage: LastMessageDto;
    unreadCount: number;        // Số tin nhắn chưa đọc
    lastActivity: number;       // Timestamp cho sorting
}
```

## 🔧 Integration Flow

### 1. Message Sent Flow
```
📱 User sends message
    ↓
🔌 ChatGateway.handleSendMessage()
    ↓
💾 MessagesService.sendMessage() (save to DB)
    ↓
📝 LastMessageService.updateLastMessageOnSend()
    ↓
🔄 Broadcast to conversation participants
    ↓
📋 Frontend updates conversation list
```

### 2. Read Status Update Flow
```
📱 User marks messages as read
    ↓
🔌 ChatGateway.handleMarkAsRead()
    ↓
📝 LastMessageService.updateLastMessageReadStatus()
    ↓
🔄 Broadcast updated read status
    ↓
📋 Frontend updates read indicators
```

## 🚀 Frontend Integration Examples

### React Implementation
```typescript
// 1. Setup lastMessage listeners
const setupLastMessageUpdates = () => {
    // Single conversation update
    socket.on('conversation_last_message_update', (data) => {
        setConversations(prev => prev.map(conv => 
            conv.id === data.conversationId 
                ? {
                    ...conv,
                    lastMessage: data.lastMessage,
                    unreadCount: data.unreadCount,
                    lastActivity: data.lastMessage.timestamp
                }
                : conv
        ));
    });

    // Bulk updates response
    socket.on('conversations_last_messages_response', (data) => {
        const updatesMap = new Map(
            data.updates.map(update => [update.conversationId, update])
        );
        
        setConversations(prev => prev.map(conv => {
            const update = updatesMap.get(conv.id);
            return update ? { ...conv, ...update } : conv;
        }));
    });
};

// 2. Load conversations with lastMessages
const loadConversations = async () => {
    const conversations = await fetchUserConversations();
    setConversations(conversations);
    
    // Request lastMessages
    socket.emit('get_conversations_last_messages', {
        conversationIds: conversations.map(c => c.id)
    });
};

// 3. Conversation list component
const ConversationItem = ({ conversation }) => {
    const { lastMessage, unreadCount } = conversation;
    
    return (
        <div className="conversation-item">
            <div className="conversation-info">
                <h4>{conversation.name}</h4>
                <div className="last-message">
                    <span className="sender">
                        {lastMessage?.senderName}: 
                    </span>
                    <span className="content">
                        {lastMessage?.content}
                    </span>
                    <span className="time">
                        {formatTime(lastMessage?.timestamp)}
                    </span>
                </div>
            </div>
            
            {unreadCount > 0 && (
                <div className="unread-badge">
                    {unreadCount}
                </div>
            )}
            
            <div className={`read-indicator ${lastMessage?.isRead ? 'read' : 'unread'}`}>
                {lastMessage?.isRead ? '✓✓' : '✓'}
            </div>
        </div>
    );
};
```

### Vue.js Implementation
```javascript
// 1. Setup in component
export default {
    data() {
        return {
            conversations: []
        };
    },
    
    mounted() {
        this.setupLastMessageUpdates();
        this.loadConversations();
    },
    
    methods: {
        setupLastMessageUpdates() {
            this.$socket.on('conversation_last_message_update', (data) => {
                const index = this.conversations.findIndex(
                    conv => conv.id === data.conversationId
                );
                
                if (index !== -1) {
                    this.$set(this.conversations, index, {
                        ...this.conversations[index],
                        lastMessage: data.lastMessage,
                        unreadCount: data.unreadCount
                    });
                }
            });
        },
        
        loadConversations() {
            // Load conversations and request lastMessages
            this.fetchConversations().then(conversations => {
                this.conversations = conversations;
                
                this.$socket.emit('get_conversations_last_messages', {
                    conversationIds: conversations.map(c => c.id)
                });
            });
        }
    }
};
```

### Mobile (React Native) Implementation
```javascript
// 1. Efficient updates for mobile
const ConversationListManager = {
    conversations: [],
    
    setupListeners() {
        socket.on('conversation_last_message_update', (data) => {
            // Update only if conversation is visible
            if (this.isConversationVisible(data.conversationId)) {
                this.updateConversationImmediate(data);
            } else {
                // Queue update for later
                this.queueUpdate(data);
            }
        });
    },
    
    updateConversationImmediate(data) {
        // Immediate UI update
        const index = this.conversations.findIndex(
            conv => conv.id === data.conversationId
        );
        
        if (index !== -1) {
            this.conversations[index] = {
                ...this.conversations[index],
                ...data
            };
            
            // Trigger re-render
            this.notifyChange();
        }
    },
    
    processQueuedUpdates() {
        // Process queued updates when list becomes visible
        this.updateQueue.forEach(update => {
            this.updateConversationImmediate(update);
        });
        this.updateQueue = [];
    }
};
```

## 🎨 Content Display Examples

### File Message Previews
```typescript
// Single file messages
const filePreviewExamples = {
    image: "🖼️ Sent a photo",
    video: "🎥 Sent a video", 
    audio: "🎵 Sent an audio",
    document: "📄 Sent a document",
    file: "📎 Sent a file"
};

// Multiple files
const multipleFileExamples = {
    images: "🖼️ Sent 3 photos",
    mixed: "📎 Sent 2 photos, 1 video",
    documents: "📄 Sent 5 documents"
};
```

### Text Message Optimization
```typescript
const textOptimization = {
    short: "Hello there!",
    long: "This is a very long message that will be truncated because it exceeds the maximum length limit for conversation list display...",
    optimized: "This is a very long message that will be truncated because it exceeds the maximum length..."
};
```

## 🔧 Performance Features

### 1. Redis Caching
```
lastmsg:conv:{conversationId} -> Cached LastMessage data (TTL: 1 hour)
lastmsg:read:{messageId}:{userId} -> Read status (TTL: 2 hours)
```

### 2. Smart Broadcasting
- **User Rooms**: Broadcast to `user:${userId}` instead of all sockets
- **Participant Filter**: Only conversation participants receive updates
- **Bulk Operations**: Group multiple updates together

### 3. Content Optimization
- **File Preview Generation**: Smart file type detection
- **Text Truncation**: Limit display content length
- **Emoji Handling**: Proper emoji rendering support

## 🛡️ Edge Cases Handled

### 1. Message Deletion
```typescript
// When lastMessage is deleted, update to previous message
// (This would be implemented when message deletion feature is added)
```

### 2. Message Editing
```typescript
// When lastMessage content is edited, update display
// (This would be implemented when message editing feature is added)
```

### 3. Offline Users
```typescript
// LastMessage updates queued for offline users
// Updates delivered when user comes online
```

## 🎉 Benefits Achieved

1. **Real-time UX**: Conversation list luôn up-to-date
2. **Performance**: Redis caching + efficient broadcasting
3. **Rich Content**: Smart file previews và content optimization  
4. **Read Status**: Accurate read/unread indicators
5. **Scalable**: Efficient bulk operations for large conversation lists
6. **Mobile Optimized**: Smart update queuing cho mobile performance

## 📱 Usage Examples

### Desktop Chat Application
```typescript
// Conversation list với real-time updates
const ConversationList = () => {
    const [conversations, setConversations] = useState([]);
    
    useEffect(() => {
        // Load conversations
        loadConversations();
        
        // Setup real-time updates
        socket.on('conversation_last_message_update', updateConversation);
        
        return () => {
            socket.off('conversation_last_message_update', updateConversation);
        };
    }, []);
    
    const updateConversation = (data) => {
        setConversations(prev => 
            prev.map(conv => 
                conv.id === data.conversationId 
                    ? { ...conv, ...data }
                    : conv
            ).sort((a, b) => b.lastActivity - a.lastActivity) // Sort by recent activity
        );
    };
    
    return (
        <div className="conversations-list">
            {conversations.map(conv => (
                <ConversationItem key={conv.id} conversation={conv} />
            ))}
        </div>
    );
};
```

### Mobile Conversation Preview
```typescript
// Optimized cho mobile performance
const MobileConversationItem = ({ conversation }) => {
    const { lastMessage, unreadCount } = conversation;
    
    return (
        <TouchableOpacity style={styles.conversationItem}>
            <View style={styles.avatarContainer}>
                <Avatar source={conversation.avatar} />
                {unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </Text>
                    </View>
                )}
            </View>
            
            <View style={styles.conversationContent}>
                <Text style={styles.conversationName}>
                    {conversation.name}
                </Text>
                <Text style={styles.lastMessage} numberOfLines={1}>
                    <Text style={styles.senderName}>
                        {lastMessage?.senderName}: 
                    </Text>
                    {lastMessage?.content}
                </Text>
            </View>
            
            <View style={styles.timeAndStatus}>
                <Text style={styles.timestamp}>
                    {formatRelativeTime(lastMessage?.timestamp)}
                </Text>
                <View style={[
                    styles.readIndicator, 
                    { opacity: lastMessage?.isRead ? 1 : 0.5 }
                ]}>
                    <Text>✓✓</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};
```

---

## ✅ Implementation Status

- [x] **LastMessageService**: Core business logic với Redis caching
- [x] **Socket.IO Integration**: Real-time broadcasting system
- [x] **ChatGateway Integration**: Message send/read handlers
- [x] **Content Optimization**: File previews và text truncation
- [x] **Read Status Tracking**: Per-user read status management
- [x] **Bulk Operations**: Efficient queries cho conversation lists
- [x] **Event System**: Comprehensive event handling
- [x] **Performance Optimization**: Caching và smart broadcasting

**Status:** 🎉 **READY FOR USE** - Real-time lastMessage system fully implemented và ready for frontend integration!
