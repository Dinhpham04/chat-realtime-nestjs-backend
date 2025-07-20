# Friends Module API Documentation - MVP Phase

## 🎯 **Overview**

REST API endpoints cho Friends Module với mobile-first approach và WhatsApp-style functionality.

**Base URL:** `/api/v1/friends`
**Authentication:** Bearer Token required

---

## 🔐 **Authentication**

Tất cả endpoints require JWT authentication:

```bash
Authorization: Bearer <your-jwt-token>
```

---

## 📱 **Friends API Endpoints**

### **1. Send Friend Request**

Send friend request bằng user ID hoặc phone number.

```http
POST /friends/send-request
```

**Request Body:**
```json
{
  "receiverId": "67890abcdef1234567890123",  // Optional: User ID
  "phoneNumber": "+84901234567",             // Optional: Phone number
  "message": "Hi! Let's be friends",         // Optional: Custom message
  "addMethod": "manual"                      // Optional: How they found user
}
```

**Response (201):**
```json
{
  "id": "67890abcdef1234567890123",
  "friend": {
    "id": "67890abcdef1234567890123",
    "fullName": "John Doe",
    "username": "johndoe",
    "phoneNumber": "+84901234567",
    "avatarUrl": "https://example.com/avatar.jpg"
  },
  "status": "pending",
  "message": "Hi! Let's be friends",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### **2. Accept Friend Request**

Accept incoming friend request.

```http
PUT /friends/accept/{requestId}
```

**Response (200):**
```json
{
  "message": "Friend request accepted successfully",
  "success": true
}
```

### **3. Decline Friend Request**

Decline incoming friend request.

```http
PUT /friends/decline/{requestId}
```

**Response (200):**
```json
{
  "message": "Friend request declined successfully", 
  "success": true
}
```

### **4. Get Friends List**

Get paginated friends list với mobile optimizations.

```http
GET /friends?page=1&limit=20&search=john&includeOnlineStatus=true
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page, max 100 (default: 20)
- `search` (optional): Search friends by name
- `includeOnlineStatus` (optional): Include online status (default: true)

**Response (200):**
```json
{
  "friends": [
    {
      "id": "67890abcdef1234567890123",
      "fullName": "John Doe",
      "username": "johndoe",
      "phoneNumber": "+84901234567",
      "avatarUrl": "https://example.com/avatar.jpg",
      "isOnline": true,
      "lastSeen": "2024-01-15T10:30:00Z",
      "mutualFriends": 5,
      "addedAt": "2024-01-10T08:15:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### **5. Remove Friend**

Remove friend từ friends list.

```http
DELETE /friends/{friendId}
```

**Response (200):**
```json
{
  "message": "Friend removed successfully",
  "success": true
}
```

### **6. Block User**

Block user và remove from friends if exists.

```http
PUT /friends/block/{userId}
```

**Request Body (optional):**
```json
{
  "reason": "Inappropriate behavior"
}
```

**Response (200):**
```json
{
  "message": "User blocked successfully",
  "success": true
}
```

### **7. Unblock User**

Remove user từ blocked list.

```http
PUT /friends/unblock/{userId}
```

**Response (200):**
```json
{
  "message": "User unblocked successfully",
  "success": true
}
```

### **8. Search Users**

Search users để send friend requests.

```http
GET /friends/search?query=john&page=1&limit=10
```

**Query Parameters:**
- `query` (required): Search query (name, username, phone)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page, max 50 (default: 10)

**Response (200):**
```json
{
  "users": [
    {
      "id": "67890abcdef1234567890123",
      "fullName": "John Doe",
      "username": "johndoe",
      "phoneNumber": "+84901234567",
      "avatarUrl": "https://example.com/avatar.jpg",
      "mutualFriends": 3,
      "friendStatus": "none"  // "friend", "pending", "none"
    }
  ],
  "pagination": {
    "total": 10,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

### **9. Get Pending Requests**

Get incoming và outgoing pending friend requests.

```http
GET /friends/requests/pending
```

**Response (200):**
```json
{
  "incoming": [
    {
      "id": "67890abcdef1234567890123",
      "sender": {
        "id": "67890abcdef1234567890123",
        "fullName": "John Doe",
        "username": "johndoe",
        "avatarUrl": "https://example.com/avatar.jpg"
      },
      "message": "Hi! Let's be friends",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "outgoing": [
    {
      "id": "67890abcdef1234567890123",
      "receiver": {
        "id": "67890abcdef1234567890123",
        "fullName": "Jane Smith",
        "username": "janesmith",
        "avatarUrl": "https://example.com/avatar2.jpg"
      },
      "message": "Hello!",
      "createdAt": "2024-01-15T09:15:00Z"
    }
  ]
}
```

---

## 📱 **Contacts API Endpoints**

### **1. Bulk Import Contacts**

Import contacts từ mobile phone và auto-friend registered users.

```http
POST /contacts/import
```

**Request Body:**
```json
{
  "contacts": [
    {
      "phoneNumber": "+84901234567",
      "contactName": "John Doe",
      "contactSource": "phonebook"  // "phonebook", "gmail", "facebook"
    },
    {
      "phoneNumber": "+84987654321", 
      "contactName": "Jane Smith",
      "contactSource": "phonebook"
    }
  ],
  "autoFriend": true  // Auto-friend registered contacts
}
```

**Response (201):**
```json
{
  "imported": 150,
  "registered": [
    {
      "phoneNumber": "+84901234567",
      "contactName": "John Doe",
      "user": {
        "id": "67890abcdef1234567890123",
        "fullName": "John Doe",
        "username": "johndoe",
        "phoneNumber": "+84901234567",
        "avatarUrl": "https://example.com/avatar.jpg",
        "isOnline": true,
        "lastSeen": "2024-01-15T10:30:00Z"
      },
      "isAlreadyFriend": false,
      "autoFriended": true
    }
  ],
  "newFriends": [
    {
      "id": "67890abcdef1234567890123",
      "fullName": "John Doe",
      "username": "johndoe",
      "phoneNumber": "+84901234567",
      "avatarUrl": "https://example.com/avatar.jpg"
    }
  ],
  "duplicates": 5,
  "errors": []
}
```

### **2. Find Registered Contacts**

Check which phone numbers belong to registered users.

```http
POST /contacts/find-registered
```

**Request Body:**
```json
{
  "phoneNumbers": ["+84901234567", "+84987654321"]
}
```

**Response (200):**
```json
{
  "registered": [
    {
      "phoneNumber": "+84901234567",
      "contactName": "John Doe",
      "user": {
        "id": "67890abcdef1234567890123",
        "fullName": "John Doe",
        "username": "johndoe",
        "phoneNumber": "+84901234567",
        "avatarUrl": "https://example.com/avatar.jpg",
        "isOnline": true,
        "lastSeen": "2024-01-15T10:30:00Z"
      },
      "isAlreadyFriend": false,
      "autoFriended": false
    }
  ]
}
```

### **3. Contact Statistics**

Get user contact import statistics.

```http
GET /contacts/stats
```

**Response (200):**
```json
{
  "total": 200,
  "registered": 45,
  "autoFriended": 12
}
```

### **4. Get User Contacts**

Get all imported contacts for user.

```http
GET /contacts
```

**Response (200):**
```json
{
  "contacts": [
    {
      "id": "67890abcdef1234567890123",
      "phoneNumber": "+84901234567",
      "contactName": "John Doe",
      "contactSource": "phonebook",
      "autoFriendWhenRegisters": true,
      "registeredUserId": "67890abcdef1234567890123",
      "autoFriended": true,
      "lastSyncAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-10T08:15:00Z"
    }
  ]
}
```

### **5. Delete Contact**

Delete imported contact.

```http
DELETE /contacts/{contactId}
```

**Response (200):**
```json
{
  "message": "Contact deleted successfully",
  "success": true
}
```

---

## 🚨 **Error Responses**

All endpoints return consistent error format:

```json
{
  "statusCode": 400,
  "message": "Friend request already exists",
  "error": "FRIEND_REQUEST_EXISTS",
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/friends/send-request",
  "method": "POST"
}
```

**Common Error Codes:**
- `ALREADY_FRIENDS` - Users are already friends
- `FRIEND_REQUEST_EXISTS` - Friend request already pending
- `NOT_FOUND` - Resource not found
- `USER_BLOCKED` - User is blocked
- `INVALID_PHONE_NUMBER` - Invalid phone number format
- `VALIDATION_ERROR` - Request validation failed

---

## 📱 **Mobile-First Features**

### **Bulk Operations**
- Import up to 1000 contacts at once
- Efficient pagination với mobile-optimized responses
- Auto-friend registered contacts

### **WhatsApp-Style Features**
- Friend requests với custom messages
- Online status tracking
- Contact sync từ phone address book
- Block/unblock system

### **Performance Optimizations**
- Indexed MongoDB queries
- Pagination për large datasets
- Cached online status (Redis)
- Bulk contact processing

---

## 🔄 **Integration Points**

### **Required Dependencies**
- **UserCore Schema**: User information và relationships
- **Redis Cache**: Online status và caching
- **Push Notifications**: Friend request notifications
- **WebSocket**: Real-time friend status updates

### **Future Enhancements**
- QR code friend adding
- Friend suggestions based on mutual friends
- Location-based friend discovery
- Integration với social media platforms
