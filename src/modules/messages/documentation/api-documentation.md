# Messages API Documentation

## 📱 Messages Module API Reference

### Overview
The Messages module provides comprehensive messaging functionality with real-time Socket.IO support and REST API fallback. This hybrid architecture ensures reliable message delivery across all network conditions.

---

## 🚀 API Architecture

### Hybrid Messaging Strategy
```
Primary: Socket.IO (Real-time) → REST API (Fallback) → Database
```

**Socket.IO Use Cases:**
- Real-time message sending
- Live typing indicators
- Instant read receipts
- Online presence

**REST API Use Cases:**
- Offline message queuing
- Message history pagination
- Search and analytics
- Bulk operations
- Retry failed messages

---

## 📋 API Endpoints

### 1. Send Message
**Endpoint:** `POST /api/v1/messages`

**Purpose:** Send a new message to a conversation (fallback when Socket.IO fails)

**Request Parameters:**
```json
{
  "localId": "client_msg_12345",           // Client UUID for optimistic UI
  "conversationId": "conv_abc123",         // Target conversation UUID
  "content": "Hello @john! 😊",            // Message text (supports mentions)
  "type": "text",                          // Message type enum
  "attachments": [                         // File attachments array
    {
      "fileId": "file_xyz789",             // From Files service
      "fileName": "photo.jpg",             // Original filename
      "mimeType": "image/jpeg",            // File MIME type
      "fileSize": 2048576,                 // Size in bytes
      "thumbnailUrl": "https://...",       // CDN thumbnail URL
      "width": 1920,                       // Image width (pixels)
      "height": 1080,                      // Image height (pixels)
      "duration": 120.5                    // Audio/video duration (seconds)
    }
  ],
  "replyToMessageId": "msg_reply123",      // UUID of message being replied to
  "mentions": ["user_john123"]             // Array of mentioned user UUIDs
}
```

**Response Example:**
```json
{
  "id": "msg_server123",
  "localId": "client_msg_12345",
  "conversationId": "conv_abc123",
  "senderId": "user_sender123",
  "content": "Hello @john! 😊",
  "type": "text",
  "attachments": [...],
  "replyTo": { "id": "msg_reply123", "content": "..." },
  "mentions": [{ "userId": "user_john123", "name": "John Doe" }],
  "status": "sent",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

---

### 2. Get Conversation Messages
**Endpoint:** `GET /api/v1/messages/conversation/{conversationId}`

**Purpose:** Retrieve message history with pagination support

**Query Parameters:**
- `page` (number, optional): Page number (default: 1, starts from 1)
- `limit` (number, optional): Messages per page (default: 20, max: 100)
- `cursor` (string, optional): ISO timestamp for cursor-based pagination

**URL Parameters:**
- `conversationId` (string, required): Conversation UUID (user must be member)

**Response Example:**
```json
{
  "data": [
    {
      "id": "msg_123",
      "content": "Hello world!",
      "senderId": "user_123",
      "senderName": "John Doe",
      "type": "text",
      "status": "read",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "attachments": [],
      "replyTo": null,
      "mentions": []
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "hasNext": true,
    "hasPrev": false,
    "nextCursor": "2024-01-15T10:29:00.000Z",
    "prevCursor": null
  }
}
```

---

### 3. Search Messages
**Endpoint:** `GET /api/v1/messages/conversation/{conversationId}/search`

**Purpose:** Full-text search within conversation messages

**Query Parameters:**
- `query` (string, required): Search text to find in message content
- `type` (string, optional): Filter by message type (text, image, video, etc.)
- `senderId` (string, optional): Filter by specific sender UUID
- `fromDate` (string, optional): Start date (ISO 8601 format)
- `toDate` (string, optional): End date (ISO 8601 format)

**URL Parameters:**
- `conversationId` (string, required): Conversation UUID to search within

**Example Request:**
```
GET /api/v1/messages/conversation/conv_123/search?query=meeting&type=text&fromDate=2024-01-01T00:00:00.000Z
```

**Response:** Same structure as Get Conversation Messages with search relevance scoring

---

### 4. Edit Message
**Endpoint:** `PUT /api/v1/messages/{messageId}`

**Purpose:** Edit existing message content (user can only edit own messages)

**URL Parameters:**
- `messageId` (string, required): Message UUID to edit

**Request Body:**
```json
{
  "content": "Updated message content",
  "attachments": [...]  // Updated attachments (replaces existing)
}
```

**Business Rules:**
- Users can only edit their own messages
- Edit window: 15 minutes after sending (configurable)
- Edit history preserved for audit
- Real-time update to all conversation members

---

### 5. Delete Message
**Endpoint:** `DELETE /api/v1/messages/{messageId}`

**Purpose:** Soft delete a message

**URL Parameters:**
- `messageId` (string, required): Message UUID to delete

**Business Rules:**
- Users can delete their own messages anytime
- Conversation admins can delete any message
- Soft delete: marked as deleted but preserved in database
- Real-time removal from all conversation members

**Response:** 204 No Content on success

---

### 6. Mark as Read
**Endpoint:** `POST /api/v1/messages/{messageId}/read`

**Purpose:** Mark message as read by current user

**URL Parameters:**
- `messageId` (string, required): Message UUID to mark as read

**Business Logic:**
- Updates message status to 'read' for current user
- Triggers read receipt to sender (if enabled)
- Updates conversation unread count
- Real-time update to sender about read status

**Response:** 204 No Content on success

---

### 7. Bulk Operations
**Endpoint:** `POST /api/v1/messages/bulk-operation`

**Purpose:** Perform operations on multiple messages

**Request Body:**
```json
{
  "messageIds": ["msg_1", "msg_2", "msg_3"],  // Max 100 messages
  "operation": "mark_read"                     // delete, mark_read, mark_unread
}
```

**Response:**
```json
{
  "success": 8,
  "failed": 2,
  "results": [
    {
      "messageId": "msg_1",
      "success": true,
      "error": null
    },
    {
      "messageId": "msg_2",
      "success": false,
      "error": "Permission denied"
    }
  ]
}
```

---

### 8. Forward Message
**Endpoint:** `POST /api/v1/messages/{messageId}/forward`

**Purpose:** Forward message to other conversations

**URL Parameters:**
- `messageId` (string, required): Message UUID to forward

**Request Body:**
```json
{
  "conversationIds": ["conv_1", "conv_2"]  // Max 10 conversations
}
```

**Business Rules:**
- User must be member of all target conversations
- Creates new messages in target conversations
- Preserves original message reference
- Maintains forwarding chain tracking

---

### 9. Message Analytics
**Endpoint:** `GET /api/v1/messages/analytics/{conversationId}`

**Purpose:** Get conversation message statistics

**URL Parameters:**
- `conversationId` (string, required): Conversation UUID

**Response:**
```json
{
  "totalMessages": 1250,
  "messagesPerDay": 42.5,
  "mostActiveUsers": [
    {
      "userId": "user_123",
      "messageCount": 125
    }
  ],
  "messageTypeDistribution": {
    "text": 1000,
    "image": 150,
    "file": 50,
    "video": 30
  }
}
```

---

## 🔐 Authentication & Security

### JWT Authentication
All endpoints require valid JWT token in Authorization header:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Conversation Membership
Users must be members of conversation to:
- Send messages
- Read message history
- Search messages
- Get analytics

### Message Ownership
Users can only edit/delete their own messages unless they have admin role in conversation.

---

## 📊 Response Codes

| Code | Description | When |
|------|-------------|------|
| 200 | OK | Successful GET requests |
| 201 | Created | Message sent successfully |
| 204 | No Content | Successful DELETE/mark read |
| 400 | Bad Request | Validation errors |
| 401 | Unauthorized | Invalid/missing JWT |
| 403 | Forbidden | Not conversation member |
| 404 | Not Found | Message/conversation not found |
| 500 | Server Error | Internal server error |

---

## 🔄 Real-time Integration

### Socket.IO Events
The REST APIs work in conjunction with Socket.IO events:

**Outgoing Events (Server → Client):**
- `message_received`: New message in conversation
- `message_edited`: Message content updated
- `message_deleted`: Message removed
- `message_status_updated`: Read/delivery status changed

**Incoming Events (Client → Server):**
- `send_message`: Primary real-time message sending
- `mark_read`: Real-time read status update
- `typing_start/stop`: Typing indicators

### Fallback Strategy
```typescript
// Client-side implementation
try {
  // Try Socket.IO first (real-time)
  socket.emit('send_message', messageData);
  showOptimisticUI(messageData);
} catch (error) {
  // Fallback to REST API
  const response = await fetch('/api/v1/messages', {
    method: 'POST',
    body: JSON.stringify(messageData)
  });
  updateUIWithServerResponse(response);
}
```

---

## 🚀 Performance Considerations

### Pagination Strategy
1. **Offset-based**: Good for page numbers (`page` + `limit`)
2. **Cursor-based**: Better performance for large datasets (`cursor`)

### Search Optimization
- Uses MongoDB text indexes for full-text search
- Compound indexes for filtered searches
- Results sorted by relevance score

### Caching Strategy
- Message lists cached in Redis for 5 minutes
- Search results cached for 2 minutes
- Analytics data cached for 1 hour

### Rate Limiting
- Send message: 30 requests/minute
- Get messages: 100 requests/minute
- Search: 20 requests/minute
- Bulk operations: 5 requests/minute

---

## 📱 Mobile App Integration

### Optimistic UI
```typescript
// 1. Show message immediately
displayMessage(localMessage);

// 2. Send via Socket.IO
socket.emit('send_message', messageData);

// 3. Update with server response
socket.on('message_received', (serverMessage) => {
  updateMessage(localMessage.id, serverMessage);
});
```

### Offline Support
```typescript
// Queue messages when offline
if (!navigator.onLine) {
  queueMessage(messageData);
} else {
  sendMessage(messageData);
}

// Sync when back online
window.addEventListener('online', () => {
  syncQueuedMessages();
});
```

### Background Sync
```typescript
// Service Worker for background message sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'messages-sync') {
    event.waitUntil(syncMessages());
  }
});
```

---

## 🛠️ Development Tools

### Swagger UI
Access interactive API documentation at:
```
http://localhost:3000/api/docs
```

### Testing Endpoints
```bash
# Send a message
curl -X POST http://localhost:3000/api/v1/messages \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"conv_123","content":"Hello world!"}'

# Get messages
curl -X GET "http://localhost:3000/api/v1/messages/conversation/conv_123?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_JWT"
```

### WebSocket Testing
Use the included `socket-test.html` file to test real-time functionality.

---

## 🔮 Future Enhancements

### Planned Features
- [ ] Message reactions (emoji)
- [ ] Thread/reply system
- [ ] Scheduled messages
- [ ] Message translation
- [ ] Voice messages
- [ ] Message encryption
- [ ] Custom message types
- [ ] Message templates
- [ ] Auto-moderation
- [ ] Message analytics dashboard

### API Versioning
```
/api/v1/messages  (Current)
/api/v2/messages  (Future - with breaking changes)
```

---

This documentation provides comprehensive information about the Messages API endpoints, their parameters, business logic, and integration patterns. Each endpoint is designed to work seamlessly with the Socket.IO real-time system while providing reliable fallback capabilities.
