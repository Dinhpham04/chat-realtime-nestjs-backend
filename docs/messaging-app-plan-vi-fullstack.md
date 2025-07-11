# 💬 Kế Hoạch Phát Triển App Nhắn Tin - Bản Đầy Đủ (MongoDB + Redis Cloud)

## 📋 Tổng Quan Dự Án

**Dự án:** Ứng dụng nhắn tin real-time (MVP mở rộng, sẵn sàng scale)  
**Kiến trúc:** Clean Architecture, hướng microservices, sử dụng cloud database/cache  
**Database:** MongoDB Atlas (Cloud)  
**Cache/Realtime:** Redis Cloud (Cache, Pub/Sub, Session)  
**Thời gian:** 8-10 tuần  
**Quy mô team:** 2-3 developers  

---

## 🎯 Phân Tích Yêu Cầu & Tính Năng

### Tính năng cốt lõi (MVP)
- Đăng ký/đăng nhập user (JWT, refresh token)
- Gửi tin nhắn 1-1 và nhóm (real-time)
- Tạo/join/leave group chat
- Lịch sử tin nhắn, phân trang
- Trạng thái online/offline, last seen
- Upload ảnh/file (local hoặc cloud)
- Quản lý bạn bè (add/block)
- Tìm kiếm user, tìm kiếm cuộc trò chuyện

### Tính năng nâng cao (Có thể bổ sung sau MVP)
- Trạng thái tin nhắn (sent/delivered/read)
- Typing indicator
- Message reactions
- Push notification
- Message search nâng cao (full-text)
- Voice/Video call
- Admin dashboard, analytics
- Message encryption

---

## 🏗️ Kiến Trúc Hệ Thống

### Sơ đồ tổng quan
```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Client App  │<--►│ NestJS API   │<--►│ Redis Cloud  │
│ (Web/Mobile) │    │ + WebSocket  │    │ (Cache/Pub)  │
└──────────────┘    └──────────────┘    └──────────────┘
         │                  │                  │
         └──────────────────┼──────────────────┘
                            │
                   ┌────────▼────────┐
                   │ MongoDB Atlas   │
                   │ (Cloud DB)      │
                   └─────────────────┘
```

### Clean Architecture
```
src/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── conversations/
│   ├── messages/
│   ├── friends/
│   └── notifications/
├── shared/
│   ├── dto/
│   ├── schemas/
│   ├── guards/
│   └── utils/
└── main.ts
```

---

## 🗄️ Thiết Kế Database (MongoDB)

### 1. users
```json
{
  _id: ObjectId,
  email: String,
  username: String,
  passwordHash: String,
  fullName: String,
  avatarUrl: String,
  status: 'active' | 'inactive' | 'banned',
  lastSeen: Date,
  isOnline: Boolean,
  friends: [ObjectId], // userId
  blocked: [ObjectId],
  createdAt: Date,
  updatedAt: Date
}
```

### 2. conversations
```json
{
  _id: ObjectId,
  type: 'direct' | 'group',
  name: String, // group
  avatarUrl: String,
  members: [ObjectId], // userId
  admins: [ObjectId],
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### 3. messages
```json
{
  _id: ObjectId,
  conversationId: ObjectId,
  senderId: ObjectId,
  content: String,
  messageType: 'text' | 'image' | 'file' | 'system',
  fileUrl: String,
  replyTo: ObjectId,
  status: [ // trạng thái từng user
    { userId: ObjectId, status: 'sent' | 'delivered' | 'read', timestamp: Date }
  ],
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date
}
```

### 4. friend_requests
```json
{
  _id: ObjectId,
  from: ObjectId, // userId
  to: ObjectId,   // userId
  status: 'pending' | 'accepted' | 'declined' | 'blocked',
  createdAt: Date,
  updatedAt: Date
}
```

### 5. notifications (optional)
```json
{
  _id: ObjectId,
  userId: ObjectId,
  type: String,
  data: Object,
  isRead: Boolean,
  createdAt: Date
}
```

### Index đề xuất
- users: email, username, isOnline
- conversations: members, type
- messages: conversationId + createdAt, senderId
- friend_requests: from, to, status

---

## 🛠️ Tech Stack

- **NestJS** (TypeScript)
- **Mongoose** (ODM cho MongoDB)
- **Redis Cloud** (cache, pub/sub, session)
- **Socket.io** (real-time)
- **JWT** (auth)
- **bcrypt** (hash password)
- **Multer** (upload file)
- **Swagger** (API docs)
- **Jest** (test)
- **Docker Compose** (dev)

---

## 📁 Cấu Trúc Project

```
src/
├── auth/
├── users/
├── conversations/
├── messages/
├── friends/
├── notifications/
├── shared/
│   ├── guards/
│   ├── decorators/
│   ├── dto/
│   ├── schemas/
│   └── utils/
├── config/
└── main.ts
```

---

## 🚀 Lộ Trình Phát Triển - 8 Tuần

### Tuần 1: Setup & Auth
- Setup project, Docker, kết nối MongoDB Atlas, Redis Cloud
- Auth module: đăng ký, đăng nhập, JWT, refresh token
- User profile cơ bản

### Tuần 2: User & Friend
- User CRUD, update profile, upload avatar
- Friend request, accept/decline/block
- Tìm kiếm user

### Tuần 3: Conversation
- Tạo/join/leave conversation
- Group chat, thêm/xóa thành viên
- List conversations (pagination)

### Tuần 4: Message (REST)
- Gửi/nhận tin nhắn (REST)
- Lưu trữ file/ảnh (local/cloud)
- Lịch sử tin nhắn (pagination)

### Tuần 5: Real-time & Status
- Socket.io integration, join room
- Real-time message delivery
- Online/offline status (Redis pub/sub)
- Typing indicator (nếu kịp)

### Tuần 6: Message Status & Notification
- Trạng thái tin nhắn (delivered/read)
- Push notification (nếu kịp)
- Notification module (optional)

### Tuần 7: Testing & Security
- Unit test, integration test
- Input validation, rate limiting, logging
- API docs với Swagger

### Tuần 8: Polish & Deploy
- Fix bug, tối ưu code
- Chuẩn bị production (env, scripts)
- Tài liệu hóa, hướng dẫn deploy

---

## 🔒 Bảo Mật & Hiệu Năng
- JWT + refresh token
- Input validation (class-validator)
- Rate limiting (Redis)
- Hash password (bcrypt)
- Audit log (MongoDB)
- CORS, Helmet
- Index cho các truy vấn lớn
- Redis cache cho user/session/conversation

---

## 📚 API Endpoints (MVP)

### Auth
```
POST /auth/register
POST /auth/login
POST /auth/refresh
GET  /auth/profile
```

### Users
```
GET  /users/me
PUT  /users/me
POST /users/avatar
GET  /users/search
```

### Friends
```
POST /friends/request
POST /friends/accept
POST /friends/block
GET  /friends/list
```

### Conversations
```
GET  /conversations
POST /conversations
GET  /conversations/:id
POST /conversations/:id/join
POST /conversations/:id/leave
```

### Messages
```
GET  /messages/:conversationId
POST /messages
POST /messages/upload
POST /messages/:id/read
```

### WebSocket Events
- join_conversation
- send_message
- new_message
- user_online
- user_offline
- typing

---

## 🐳 Docker Compose (dev)
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - MONGODB_URI=mongodb+srv://... # MongoDB Atlas
      - REDIS_URL=redis://...         # Redis Cloud
    depends_on:
      - redis
    volumes:
      - .:/app
      - /app/node_modules

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

# MongoDB dùng cloud, không cần container local
```

---

## ✅ Checklist MVP
- [ ] Setup project, kết nối MongoDB Atlas, Redis Cloud
- [ ] Auth module (JWT, refresh token)
- [ ] User CRUD, upload avatar
- [ ] Friend request, block
- [ ] Conversation/group chat
- [ ] Message REST + real-time
- [ ] Online/offline status
- [ ] Message status (delivered/read)
- [ ] API docs, test, deploy

---

**Tổng thời gian:** 8-10 tuần  
**Team:** 2-3 devs  
**Ưu tiên:** Đầy đủ database, cloud ready, code clean, dễ mở rộng

Kế hoạch này cân bằng giữa MVP nhanh và khả năng mở rộng, tận dụng cloud database/cache, phù hợp cho team nhỏ nhưng không bị giới hạn về kiến trúc!


- Thành viên
- Ý tưởng đề tài
- Chức năng sẽ làm
- Công nghệ sử dụng
- Phân chia công việc