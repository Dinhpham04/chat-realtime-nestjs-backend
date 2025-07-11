# 💬 Kế Hoạch Phát Triển App Nhắn Tin - Phiên Bản Tối Giản

## 📋 Tổng Quan Dự Án

**Dự án:** Ứng dụng nhắn tin real-time (MVP)  
**Kiến trúc:** Clean Architecture đơn giản với NestJS  
**Mục tiêu:** MVP hoàn chình, sẵn sàng mở rộng sau này  
**Thời gian:** 6-8 tuần  
**Quy mô team:** 1-2 developers  

---

## 🎯 Phân Tích Yêu Cầu MVP

### Tính năng cốt lõi (Ưu tiên cao)
- ✅ Đăng ký/đăng nhập user
- ✅ Gửi tin nhắn 1-1 (real-time)
- ✅ Tạo/tham gia nhóm chat
- ✅ Lịch sử tin nhắn cơ bản
- ✅ Trạng thái online/offline
- ✅ Upload ảnh/file đơn giản

### Tính năng bổ sung (Có thể bỏ qua lần đầu)
- ⏸️ Trạng thái tin nhắn (đã gửi/đã đọc)
- ⏸️ Typing indicator
- ⏸️ Message reactions
- ⏸️ Tìm kiếm tin nhắn
- ⏸️ Push notifications

### Tính năng nâng cao (Phase 2)
- 🔄 End-to-end encryption
- 🔄 Voice/Video call
- 🔄 Stories/Status
- 🔄 Admin dashboard

---

## 🏗️ Kiến Trúc Đơn Giản

### Sơ đồ tổng quan
```
┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │    │   NestJS API    │
│  (Web/Mobile)   │◄──►│  + WebSocket    │
└─────────────────┘    └─────────────────┘
                                │
                    ┌───────────┼───────────┐
                    │                       │
            ┌───────▼────────┐    ┌────────▼─────┐
            │   PostgreSQL   │    │    Redis     │
            │  (Main Data)   │    │  (Sessions)  │
            └────────────────┘    └──────────────┘
```

### Clean Architecture (Đơn giản hóa)
```
src/
├── modules/              # Các module chính
│   ├── auth/            # Xác thực
│   ├── users/           # Quản lý user
│   ├── conversations/   # Cuộc trò chuyện
│   └── messages/        # Tin nhắn
├── shared/              # Code dùng chung
│   ├── dto/
│   ├── entities/
│   ├── guards/
│   └── utils/
└── main.ts
```

---

## 🗄️ Thiết Kế Database Tối Giản

### 4 bảng chính (thay vì 6 bảng phức tạp)

#### 1. Users - Thông tin người dùng
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    avatar_url VARCHAR(500),
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. Conversations - Cuộc trò chuyện
```sql
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255), -- Null cho chat 1-1
    type ENUM('direct', 'group') NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. Conversation_Members - Thành viên
```sql
CREATE TABLE conversation_members (
    conversation_id INTEGER REFERENCES conversations(id),
    user_id INTEGER REFERENCES users(id),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (conversation_id, user_id)
);
```

#### 4. Messages - Tin nhắn
```sql
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id),
    sender_id INTEGER REFERENCES users(id),
    content TEXT NOT NULL,
    message_type ENUM('text', 'image', 'file') DEFAULT 'text',
    file_url VARCHAR(500), -- Cho ảnh/file
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index cơ bản cho hiệu năng
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_users_email ON users(email);
```

---

## 🛠️ Tech Stack Đơn Giản

### Backend
- **NestJS** - Framework chính
- **TypeORM** - ORM với PostgreSQL
- **Socket.io** - WebSocket cho real-time
- **JWT** - Authentication
- **bcrypt** - Hash password
- **Multer** - Upload file

### Database & Storage
- **PostgreSQL** - Database chính (SQLite cho dev)
- **Redis** - Session storage (tùy chọn)
- **Local Storage** - File upload (đơn giản)

### Dev Tools
- **Docker Compose** - Dev environment
- **Swagger** - API docs
- **Jest** - Testing cơ bản

---

## 📁 Cấu Trúc Project Đơn Giản

```
src/
├── auth/                    # Module xác thực
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── jwt.strategy.ts
│   ├── dto/
│   │   ├── login.dto.ts
│   │   └── register.dto.ts
│   └── auth.module.ts
│
├── users/                   # Module user
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── entities/user.entity.ts
│   └── users.module.ts
│
├── conversations/           # Module cuộc trò chuyện
│   ├── conversations.controller.ts
│   ├── conversations.service.ts
│   ├── entities/
│   │   ├── conversation.entity.ts
│   │   └── conversation-member.entity.ts
│   └── conversations.module.ts
│
├── messages/                # Module tin nhắn
│   ├── messages.controller.ts
│   ├── messages.service.ts
│   ├── messages.gateway.ts   # WebSocket
│   ├── entities/message.entity.ts
│   └── messages.module.ts
│
├── shared/                  # Code chung
│   ├── guards/
│   │   └── jwt-auth.guard.ts
│   ├── decorators/
│   │   └── current-user.decorator.ts
│   ├── dto/
│   │   └── pagination.dto.ts
│   └── utils/
│       └── file-upload.util.ts
│
├── config/
│   ├── database.config.ts
│   └── jwt.config.ts
│
└── main.ts
```

---

## 🚀 Lộ Trình Phát Triển - 6 Tuần

### Tuần 1: Setup & Authentication
**Mục tiêu:** Có hệ thống đăng ký/đăng nhập hoạt động

- **Ngày 1-2:** Setup project, Docker, database
- **Ngày 3-4:** Auth module (register, login, JWT)
- **Ngày 5-7:** User profile, validation, tests cơ bản

### Tuần 2: User Management & Basic Structure
**Mục tiêu:** Quản lý user và cấu trúc cơ bản

- **Ngày 1-2:** User CRUD, profile update
- **Ngày 3-4:** File upload (avatar)
- **Ngày 5-7:** API documentation với Swagger

### Tuần 3: Conversations
**Mục tiêu:** Tạo và quản lý cuộc trò chuyện

- **Ngày 1-3:** Conversation entity, create/join conversation
- **Ngày 4-5:** List conversations, conversation members
- **Ngày 6-7:** Basic validation và error handling

### Tuần 4: Messages (REST API)
**Mục tiêu:** Gửi/nhận tin nhắn qua REST

- **Ngày 1-3:** Message entity, send/get messages
- **Ngày 4-5:** File sharing (ảnh, document)
- **Ngày 6-7:** Pagination cho message history

### Tuần 5: Real-time với WebSocket
**Mục tiêu:** Tin nhắn real-time

- **Ngày 1-3:** Socket.io integration, join rooms
- **Ngày 4-5:** Real-time message delivery
- **Ngày 6-7:** Online/offline status

### Tuần 6: Polish & Deploy
**Mục tiêu:** Hoàn thiện và deploy

- **Ngày 1-2:** Bug fixes, testing
- **Ngày 3-4:** Performance tuning cơ bản
- **Ngày 5-7:** Deployment setup, documentation

---

## 🔒 Bảo Mật Cơ Bản

### Authentication đơn giản
```typescript
// JWT Guard
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}

// Usage
@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile(@CurrentUser() user: User) {
  return user;
}
```

### Validation cơ bản
```typescript
// DTO validation
export class SendMessageDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  content: string;

  @IsEnum(MessageType)
  type: MessageType;

  @IsInt()
  conversationId: number;
}
```

### Rate limiting đơn giản
```typescript
// Trong main.ts
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));
```

---

## 📊 Performance Cơ Bản

### Database optimization đơn giản
```sql
-- Chỉ những index cần thiết nhất
CREATE INDEX idx_messages_conversation_time ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_conversation_members ON conversation_members(user_id);
```

### Caching cơ bản (nếu cần)
```typescript
// Simple in-memory cache cho user sessions
@Injectable()
export class CacheService {
  private cache = new Map<string, any>();
  
  set(key: string, value: any, ttl = 300000) { // 5 mins
    this.cache.set(key, { value, expires: Date.now() + ttl });
  }
  
  get(key: string) {
    const item = this.cache.get(key);
    if (!item || Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }
}
```

---

## 🧪 Testing Đơn Giản

### Unit test cơ bản
```typescript
describe('MessagesService', () => {
  it('should send message', async () => {
    const dto = { content: 'Hello', conversationId: 1, type: 'text' };
    const result = await service.sendMessage(mockUser, dto);
    
    expect(result).toBeDefined();
    expect(result.content).toBe('Hello');
  });
});
```

### E2E test cho API quan trọng
```typescript
describe('Messages API', () => {
  it('POST /messages', async () => {
    return request(app.getHttpServer())
      .post('/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Test message', conversationId: 1 })
      .expect(201);
  });
});
```

---

## 📚 API Endpoints Tối Giản

### Authentication
```
POST /auth/register    - Đăng ký
POST /auth/login       - Đăng nhập
GET  /auth/profile     - Thông tin user hiện tại
```

### Users
```
GET  /users/me         - Profile của tôi
PUT  /users/me         - Cập nhật profile
POST /users/avatar     - Upload avatar
GET  /users/search     - Tìm user (đơn giản)
```

### Conversations
```
GET  /conversations           - Danh sách cuộc trò chuyện
POST /conversations           - Tạo cuộc trò chuyện mới
GET  /conversations/:id       - Chi tiết cuộc trò chuyện
POST /conversations/:id/join  - Tham gia nhóm
```

### Messages
```
GET  /messages/:conversationId  - Lịch sử tin nhắn
POST /messages                  - Gửi tin nhắn
POST /messages/upload           - Upload file/ảnh
```

### WebSocket Events
```javascript
// Client events
socket.emit('join_conversation', { conversationId: 1 });
socket.emit('send_message', { content: 'Hello', conversationId: 1 });
socket.emit('user_online');

// Server events  
socket.on('new_message', (message) => { ... });
socket.on('user_status', (status) => { ... });
```

---

## 🐳 Setup Development Đơn Giản

### docker-compose.yml
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DB_HOST=postgres
    depends_on:
      - postgres
    volumes:
      - .:/app
      - /app/node_modules

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: messaging_app
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### package.json scripts
```json
{
  "scripts": {
    "start:dev": "nest start --watch",
    "build": "nest build",
    "test": "jest",
    "db:migrate": "typeorm migration:run",
    "db:seed": "ts-node src/database/seeds/seed.ts"
  }
}
```

---

## 📈 Chiến Lược Mở Rộng Sau Này

### Phase 2: Tối ưu Performance (2-3 tuần)
- Redis caching
- Database indexing nâng cao
- File storage với S3
- Load balancing

### Phase 3: Tính Năng Nâng Cao (3-4 tuần)
- Message status (đã đọc/đã gửi)
- Push notifications
- Message search
- Voice/Video calling

### Phase 4: Enterprise Features
- Admin dashboard
- Analytics
- Multi-tenant
- Advanced security

---

## ✅ Checklist Hoàn Thành MVP

### Tuần 1-2: Foundation
- [ ] Project setup với Docker
- [ ] User registration/login
- [ ] JWT authentication
- [ ] Basic user profile
- [ ] File upload cho avatar

### Tuần 3-4: Core Features
- [ ] Create/join conversations
- [ ] Send/receive messages (REST)
- [ ] Message history với pagination
- [ ] Basic file sharing

### Tuần 5-6: Real-time & Polish
- [ ] WebSocket integration
- [ ] Real-time messaging
- [ ] Online/offline status
- [ ] API documentation
- [ ] Basic testing
- [ ] Deployment ready

---

## 🎯 Lời Khuyên Thực Tế

### Đừng over-engineer từ đầu
- Dùng SERIAL thay vì UUID (đơn giản hơn)
- File upload local trước, S3 sau
- SQLite cho dev, PostgreSQL cho production
- In-memory cache trước, Redis sau

### Focus vào MVP
- Làm được gửi/nhận tin nhắn là đủ
- Real-time là must-have
- UI/UX đơn giản, hoạt động tốt
- Performance optimization sau

### Chuẩn bị cho tương lai
- Code clean, dễ đọc
- Database schema có thể mở rộng
- Module structure rõ ràng
- Documentation cơ bản

---

**Tổng thời gian:** 6-8 tuần  
**Effort:** 1-2 developers part-time  
**Mục tiêu:** MVP hoạt động tốt, sẵn sàng mở rộng  

Kế hoạch này tập trung vào **speed to market** nhưng vẫn đảm bảo **code quality** và **scalability** cho tương lai. Ưu tiên làm được sản phẩm hoạt động trước, tối ưu sau!
