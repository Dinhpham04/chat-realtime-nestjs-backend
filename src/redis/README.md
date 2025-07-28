# Redis Real-time State Management

## 🚀 **Overview**

Redis-based real-time state management for mobile-first chat application. Optimized for high performance, scalability, and mobile-specific requirements.

## 🏗️ **Architecture**

```
Client Apps    ←→    Socket.IO    ←→    Redis     ←→    MongoDB
(Mobile/Web)         Gateway           (Cache)         (Persistence)
     ↓                  ↓                ↓               ↓
UI State          Connection       Real-time        Permanent
Settings          Management        State           Storage
Local Cache       Broadcasting      Cache           Backup
```

## 📦 **Services**

### **1. RealTimeStateService**
**Purpose**: User presence, typing indicators, online status
```typescript
// User presence
await realTimeState.setUserOnline(userId, deviceId, socketId);
await realTimeState.setUserOffline(userId, deviceId);
await realTimeState.updateUserStatus(userId, ActivityStatus.AWAY);

// Typing indicators
await realTimeState.setUserTyping(userId, conversationId);
await realTimeState.stopUserTyping(userId, conversationId);

// Online status
const isOnline = await realTimeState.isUserOnline(userId);
const onlineUsers = await realTimeState.getOnlineUsers();
```

### **2. RedisCacheService**
**Purpose**: Message cache, sessions, notifications, rate limiting
```typescript
// Message caching
await cacheService.addMessageToCache(message);
const messages = await cacheService.getCachedMessages(conversationId);

// Session management
await cacheService.createSession(session);
await cacheService.updateSessionActivity(userId, deviceId);

// Push notifications
await cacheService.queuePushNotification({
  userId,
  title: 'New Message',
  body: 'Hello!',
  priority: 'high'
});

// Rate limiting
const rateLimit = await cacheService.checkRateLimit(userId, 'send_message', 10, 60);
```

### **3. WebSocketStateService**
**Purpose**: WebSocket connection management, event broadcasting
```typescript
// Connection management
await wsState.handleUserConnect(socketId, userId, deviceId, ip, userAgent);
await wsState.handleUserDisconnect(socketId);

// Broadcasting
await wsState.broadcastToUser(userId, event);
await wsState.broadcastToConversation(conversationId, event);
await wsState.broadcastToFriends(userId, event);

// Event handling
await wsState.handleNewMessage(message);
await wsState.handleUserTyping(userId, conversationId, true);
```

### **4. RedisCleanupService**
**Purpose**: Background maintenance tasks
```typescript
// Automatic cleanup (runs in background)
// - Expired sessions cleanup (every 5 minutes)
// - Notification processing (every 30 seconds)

// Manual operations
const result = await cleanupService.manualCleanup();
const stats = await cleanupService.logRedisStats();
```

## 🔧 **Setup & Configuration**

### **1. Environment Variables**
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password_here
```

### **2. Module Import**
```typescript
// app.module.ts
import { RedisModule } from './redis';

@Module({
  imports: [
    ConfigModule.forRoot(),
    RedisModule,
    // ... other modules
  ],
})
export class AppModule {}
```

### **3. Service Injection**
```typescript
// your.service.ts
import { RealTimeStateService, RedisCacheService } from '../redis';

@Injectable()
export class YourService {
  constructor(
    private readonly realTimeState: RealTimeStateService,
    private readonly cacheService: RedisCacheService,
  ) {}
}
```

## 📊 **Redis Data Structure**

### **Presence Data**
```
presence:{userId}           → UserPresence object (TTL: 5min)
presence:{userId}:{deviceId} → Device-specific presence
online:users                → Set of online user IDs
socket:{socketId}           → User ID mapping
```

### **Typing Indicators**
```
typing:{conversationId}:{userId} → TypingStatus (TTL: 10sec)
typing:{conversationId}:users    → Set of typing users
```

### **Message Cache**
```
messages:{conversationId}   → Sorted set (by timestamp, last 100)
```

### **Sessions**
```
session:{userId}:{deviceId} → UserSession object (TTL: 1hr)
sessions:{userId}           → Set of session keys
```

### **Friends Cache**
```
friends:{userId}            → Set of friend IDs (TTL: 2hr)
```

### **Notifications**
```
notifications:{userId}      → List of notifications (max 100)
notification_queue:high     → High priority queue
notification_queue:normal   → Normal priority queue
```

### **Rate Limiting**
```
rate_limit:{userId}:{action} → Sorted set of timestamps
```

## 🎯 **Performance Optimizations**

### **TTL Strategy**
- **User Presence**: 5 minutes (auto-refresh on activity)
- **Typing Indicators**: 10 seconds (auto-expire)
- **Message Cache**: 24 hours (recent messages)
- **Sessions**: 1 hour (extend on activity)
- **Friend Lists**: 2 hours (sync from DB when needed)

### **Memory Management**
- **Message Cache**: Max 100 messages per conversation
- **Security Logs**: Max 100 entries per user
- **Notifications**: Max 100 per user
- **Rate Limiting**: Sliding window cleanup

### **Connection Optimization**
- **Lazy Connect**: Connect only when needed
- **Connection Pooling**: Reuse connections
- **Pipeline**: Batch Redis operations
- **TTL Auto-cleanup**: Automatic memory management

## 🔍 **Monitoring & Health Check**

### **Health Endpoints**
```
GET /redis/health          → Connection status & latency
GET /redis/stats           → Real-time statistics
GET /redis/online-users    → Current online users
```

### **Cleanup Tasks**
- **Expired Sessions**: Every 5 minutes
- **Notification Processing**: Every 30 seconds
- **Statistics Logging**: On demand

## 🚀 **Usage Examples**

### **User Login Flow**
```typescript
// 1. User connects via WebSocket
await wsState.handleUserConnect(socketId, userId, deviceId, ip, userAgent);

// 2. Cache friend list for quick access
const friends = await userService.getFriends(userId);
await cacheService.cacheFriendList(userId, friends);

// 3. Notify friends about online status
await wsState.broadcastToFriends(userId, {
  type: 'user_online',
  data: { userId, timestamp: new Date() }
});
```

### **Sending Message Flow**
```typescript
// 1. Check rate limit
const rateLimit = await cacheService.checkRateLimit(userId, 'send_message', 10, 60);
if (!rateLimit.allowed) {
  throw new Error('Rate limit exceeded');
}

// 2. Save message and cache
const message = await messageService.create(messageData);
await cacheService.addMessageToCache(message);

// 3. Broadcast to conversation
await wsState.handleNewMessage(message);
```

### **Typing Indicator Flow**
```typescript
// User starts typing
await wsState.handleUserTyping(userId, conversationId, true);

// Auto-stop after timeout (handled by TTL)
// Or manual stop
await wsState.handleUserTyping(userId, conversationId, false);
```

## 🎛️ **Configuration Tips**

### **Production Settings**
- Enable Redis persistence (RDB + AOF)
- Set up Redis Cluster for high availability
- Configure memory limits and eviction policies
- Monitor Redis metrics (memory, connections, operations)

### **Development Settings**
- Use Redis in Docker container
- Enable debug logging
- Use Redis CLI for debugging
- Monitor health endpoints

## 📈 **Scaling Considerations**

- **Horizontal Scaling**: Redis Cluster or Redis Sentinel
- **Memory Optimization**: Adjust TTL values based on usage
- **Network Optimization**: Use Redis pipelines for batch operations
- **Monitoring**: Set up alerts for Redis memory and connection limits
