# 📋 Conversations API Examples

## 🎯 **API Flow Walkthrough**

### **Scenario: User muốn nhắn tin với một người bạn**

---

## **Step 1: Prepare Conversation** 📱

**Use Case:** User click vào contact "Nguyễn Văn A" trong contact list

**API Call:**
```http
POST /api/v1/conversations/prepare
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "participantId": "64f1a2b3c4d5e6f7a8b9c0d1"
}
```

**Response (Conversation chưa tồn tại):**
```json
{
  "conversationId": "64f2b3c4d5e6f7a8b9c0d2e3",
  "exists": false,
  "isActive": false,
  "participant": {
    "id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "username": "nguyenvana",
    "fullName": "Nguyễn Văn A",
    "avatarUrl": "https://example.com/avatars/user1.jpg",
    "isOnline": true,
    "lastSeen": "2025-01-20T10:30:00.000Z"
  },
  "conversation": {
    "id": "64f2b3c4d5e6f7a8b9c0d2e3",
    "type": "direct",
    "createdAt": "2025-01-20T11:00:00.000Z",
    "lastActivity": "2025-01-20T11:00:00.000Z"
  }
}
```

**Response (Conversation đã tồn tại):**
```json
{
  "conversationId": "64f2b3c4d5e6f7a8b9c0d2e3",
  "exists": true,
  "isActive": true,
  "participant": {
    "id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "username": "nguyenvana",
    "fullName": "Nguyễn Văn A",
    "avatarUrl": "https://example.com/avatars/user1.jpg",
    "isOnline": false,
    "lastSeen": "2025-01-20T09:15:00.000Z"
  },
  "conversation": {
    "id": "64f2b3c4d5e6f7a8b9c0d2e3",
    "type": "direct",
    "createdAt": "2025-01-19T14:30:00.000Z",
    "lastActivity": "2025-01-20T08:45:00.000Z"
  }
}
```

**Frontend Logic:**
```typescript
// User clicks contact
async function onContactClick(contactId: string) {
  try {
    // Step 1: Prepare conversation
    const result = await api.prepareConversation({ participantId: contactId });
    
    // Step 2: Navigate to chat screen immediately  
    router.push(`/chat/${result.conversationId}`);
    
    // Step 3: Setup chat screen
    setChatContext({
      conversationId: result.conversationId,
      participant: result.participant,
      isActive: result.isActive,
      exists: result.exists
    });
    
    // Step 4: If conversation is active, load messages
    if (result.isActive) {
      loadMessages(result.conversationId);
    }
  } catch (error) {
    showError('Cannot start conversation');
  }
}
```

---

## **Step 2: Activate Conversation** 💬

**Use Case:** User gõ tin nhắn đầu tiên và nhấn Send

**API Call (Text Message):**
```http
POST /api/v1/conversations/activate
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "conversationId": "64f2b3c4d5e6f7a8b9c0d2e3",
  "initialMessage": {
    "content": {
      "text": "Chào bạn! Bạn có khỏe không? 😊",
      "mentions": []
    },
    "messageType": "text",
    "metadata": {
      "platform": "web",
      "deviceInfo": "Chrome 96.0"
    }
  }
}
```

**API Call (With Image Attachment):**
```http
POST /api/v1/conversations/activate
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "conversationId": "64f2b3c4d5e6f7a8b9c0d2e3",
  "initialMessage": {
    "content": {
      "text": "Xem hình này nè! 📸",
      "mentions": []
    },
    "attachments": [
      {
        "fileName": "IMG_001.jpg",
        "originalName": "beautiful_sunset.jpg",
        "mimeType": "image/jpeg",
        "fileSize": 2048576,
        "url": "https://cdn.example.com/uploads/IMG_001.jpg"
      }
    ],
    "messageType": "image",
    "metadata": {
      "platform": "android",
      "deviceInfo": "Samsung Galaxy S23"
    }
  }
}
```

**Response:**
```json
{
  "conversation": {
    "id": "64f2b3c4d5e6f7a8b9c0d2e3",
    "type": "direct",
    "participants": [
      {
        "userId": "64f0a1b2c3d4e5f6a7b8c9d0",
        "role": "admin",
        "joinedAt": "2025-01-20T11:00:00.000Z",
        "user": {
          "id": "64f0a1b2c3d4e5f6a7b8c9d0",
          "username": "currentuser",
          "fullName": "Current User",
          "avatarUrl": "https://example.com/avatars/current.jpg",
          "isOnline": true
        }
      },
      {
        "userId": "64f1a2b3c4d5e6f7a8b9c0d1",
        "role": "admin", 
        "joinedAt": "2025-01-20T11:00:00.000Z",
        "user": {
          "id": "64f1a2b3c4d5e6f7a8b9c0d1",
          "username": "nguyenvana",
          "fullName": "Nguyễn Văn A",
          "avatarUrl": "https://example.com/avatars/user1.jpg",
          "isOnline": true
        }
      }
    ],
    "createdBy": "64f0a1b2c3d4e5f6a7b8c9d0",
    "createdAt": "2025-01-20T11:00:00.000Z",
    "updatedAt": "2025-01-20T11:05:00.000Z",
    "lastMessage": {
      "id": "64f3c5d6e7f8a9b0c1d2e3f4",
      "content": "Chào bạn! Bạn có khỏe không? 😊",
      "messageType": "text",
      "senderId": "64f0a1b2c3d4e5f6a7b8c9d0",
      "createdAt": "2025-01-20T11:05:00.000Z"
    },
    "isActive": true,
    "unreadCount": 0
  },
  "message": {
    "id": "64f3c5d6e7f8a9b0c1d2e3f4",
    "conversationId": "64f2b3c4d5e6f7a8b9c0d2e3",
    "senderId": "64f0a1b2c3d4e5f6a7b8c9d0",
    "messageType": "text",
    "content": {
      "text": "Chào bạn! Bạn có khỏe không? 😊",
      "mentions": []
    },
    "attachments": [],
    "createdAt": "2025-01-20T11:05:00.000Z",
    "updatedAt": "2025-01-20T11:05:00.000Z"
  },
  "created": true
}
```

**Frontend Logic:**
```typescript
// User sends first message
async function sendFirstMessage(messageData: any) {
  try {
    setLoading(true);
    
    const result = await api.activateConversation({
      conversationId: chatContext.conversationId,
      initialMessage: messageData
    });
    
    // Update conversation context
    setConversation(result.conversation);
    
    // Add message to chat
    addMessageToChat(result.message);
    
    // Clear input
    clearMessageInput();
    
    // Set as active conversation
    setIsActive(true);
    
    // Start real-time connection
    connectWebSocket(result.conversation.id);
    
  } catch (error) {
    showError('Failed to send message');
  } finally {
    setLoading(false);
  }
}
```

---

## **Step 3: Get Conversation Details** 📄

**Use Case:** Load conversation details khi vào chat screen của conversation đã active

**API Call:**
```http
GET /api/v1/conversations/64f2b3c4d5e6f7a8b9c0d2e3
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "id": "64f2b3c4d5e6f7a8b9c0d2e3",
  "type": "direct",
  "participants": [
    {
      "userId": "64f0a1b2c3d4e5f6a7b8c9d0",
      "role": "admin",
      "joinedAt": "2025-01-20T11:00:00.000Z",
      "user": {
        "id": "64f0a1b2c3d4e5f6a7b8c9d0",
        "username": "currentuser", 
        "fullName": "Current User",
        "avatarUrl": "https://example.com/avatars/current.jpg",
        "isOnline": true
      }
    },
    {
      "userId": "64f1a2b3c4d5e6f7a8b9c0d1",
      "role": "admin",
      "joinedAt": "2025-01-20T11:00:00.000Z", 
      "user": {
        "id": "64f1a2b3c4d5e6f7a8b9c0d1",
        "username": "nguyenvana",
        "fullName": "Nguyễn Văn A",
        "avatarUrl": "https://example.com/avatars/user1.jpg",
        "isOnline": false
      }
    }
  ],
  "createdBy": "64f0a1b2c3d4e5f6a7b8c9d0",
  "createdAt": "2025-01-20T11:00:00.000Z",
  "updatedAt": "2025-01-20T11:45:00.000Z",
  "lastMessage": {
    "id": "64f3c5d6e7f8a9b0c1d2e3f4",
    "content": "Cảm ơn bạn nhé! 👍",
    "messageType": "text", 
    "senderId": "64f1a2b3c4d5e6f7a8b9c0d1",
    "createdAt": "2025-01-20T11:45:00.000Z"
  },
  "isActive": true,
  "unreadCount": 2
}
```

---

## 🔥 **Error Handling Examples**

### **Error 1: Target User Not Found**
```json
{
  "statusCode": 404,
  "message": "Target user not found",
  "error": "Not Found",
  "timestamp": "2025-01-20T11:00:00.000Z",
  "path": "/api/v1/conversations/prepare"
}
```

### **Error 2: Cannot Message Yourself**
```json
{
  "statusCode": 400,
  "message": "Cannot create conversation with yourself",
  "error": "Bad Request",
  "timestamp": "2025-01-20T11:00:00.000Z",
  "path": "/api/v1/conversations/prepare"
}
```

### **Error 3: Conversation Not Found**
```json
{
  "statusCode": 404,
  "message": "Conversation not found",
  "error": "Not Found", 
  "timestamp": "2025-01-20T11:00:00.000Z",
  "path": "/api/v1/conversations/activate"
}
```

### **Error 4: Not a Participant**
```json
{
  "statusCode": 400,
  "message": "User is not a participant in this conversation",
  "error": "Bad Request",
  "timestamp": "2025-01-20T11:00:00.000Z", 
  "path": "/api/v1/conversations/activate"
}
```

---

## 🎯 **Complete Mobile App Flow**

```typescript
class ChatApp {
  // Step 1: User clicks contact
  async onContactClick(contact: Contact) {
    try {
      // Show loading
      this.showChatLoading();
      
      // Prepare conversation
      const result = await this.api.prepareConversation({
        participantId: contact.id
      });
      
      // Navigate to chat screen
      this.navigateToChat({
        conversationId: result.conversationId,
        participant: result.participant,
        isActive: result.isActive,
        exists: result.exists
      });
      
      // Load messages if active
      if (result.isActive) {
        await this.loadMessages(result.conversationId);
      }
      
    } catch (error) {
      this.handleError(error);
    }
  }
  
  // Step 2: User sends message
  async sendMessage(messageText: string, attachments: File[] = []) {
    try {
      const messageData = {
        content: { text: messageText, mentions: [] },
        attachments: await this.uploadAttachments(attachments),
        messageType: attachments.length > 0 ? 'image' : 'text'
      };
      
      if (!this.conversation.isActive) {
        // First message - activate conversation
        const result = await this.api.activateConversation({
          conversationId: this.conversation.id,
          initialMessage: messageData
        });
        
        this.conversation = result.conversation;
        this.addMessage(result.message);
        this.connectWebSocket();
        
      } else {
        // Regular message
        const result = await this.api.sendMessage({
          conversationId: this.conversation.id,
          ...messageData
        });
        
        this.addMessage(result.message);
      }
      
    } catch (error) {
      this.handleError(error);
    }
  }
}
```

**Đây là toàn bộ luồng hoàn chỉnh cho 2 APIs prepare và activate conversation theo pattern Zalo/Messenger!** 🚀
