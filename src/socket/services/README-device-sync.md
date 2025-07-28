# Device Sync Service - Implementation Complete

## 🎯 Overview
DeviceSyncService implements **Zalo/Messenger-style multi-device synchronization** với **Clean Architecture** và **Event-Driven patterns** cho real-time device state management.

## 🏗️ Architecture Design

### **Clean Architecture Principles Applied:**
- **Single Responsibility**: Service chỉ handle device synchronization
- **Dependency Inversion**: Sử dụng EventEmitter2 và repository interfaces
- **Open/Closed**: Event-driven design cho phép extend without modification
- **Interface Segregation**: Clear separation of sync concerns

### **Event-Driven Pattern:**
```typescript
// Thay vì circular dependency:
// DeviceSyncService -> ChatGateway ❌

// Sử dụng Event-Driven:
// DeviceSyncService -> EventEmitter2 -> ChatGateway ✅
```

## 🚀 Implemented Features

### 1. **Multi-Device Connection Sync**
- **Auto-sync on device connect**: Missed messages, conversation states, read status
- **Redis-based device tracking**: Online/offline status với TTL management
- **Device-specific last seen**: Per-conversation tracking cho accurate unread counts

```typescript
// Device connection và sync
await deviceSyncService.syncDeviceOnConnect(userId, deviceId, socket);
```

### 2. **Missed Messages Sync**
- **Database integration**: Query messages sau last sync timestamp
- **Smart filtering**: Only relevant conversations và messages after lastSync
- **Performance optimized**: Limit 200 messages per sync, 50 per conversation

```typescript
// Missed messages với timestamp filtering
const missedMessages = await this.getMissedMessages(userId, lastSync);
// Result: { id, conversationId, senderId, content, messageType, timestamp }[]
```

### 3. **Conversation States Sync**
- **Full conversation context**: Name, type, lastMessage, participant count
- **Unread counts**: Device-specific unread tracking
- **Last activity**: Conversation ordering và prioritization

```typescript
// Conversation states với full context
const conversationStates = await this.getConversationStates(userId);
// Result: { conversationId, name, type, lastMessage, unreadCount, isMuted }[]
```

### 4. **Read Status Synchronization**
- **Cross-device read sync**: Khi read trên device này, sync sang devices khác
- **Read conflict resolution**: "Earliest read wins" strategy
- **Redis-based tracking**: Persistent read status với TTL

```typescript
// Read status sync to other devices
await deviceSyncService.syncReadStatusToOtherDevices(
    userId, 
    excludeDeviceId, 
    messageIds, 
    readAt
);
```

### 5. **Unread Count Calculation**
- **Device-specific**: Based on device's last seen per conversation
- **Redis optimization**: Cache device last seen timestamps
- **Accurate counting**: Exclude own messages, respect device boundaries

```typescript
// Device-specific unread counts
const unreadCounts = await this.getUnreadCounts(userId, deviceId);
// Result: { conversationId: unreadCount }
```

### 6. **Read Updates Tracking**
- **Incremental sync**: Only read updates since last sync
- **Conflict resolution**: Handle same message read on multiple devices
- **Performance optimized**: Limit 500 read updates per sync

## 📊 Redis Schema Design

### **Device Management:**
```redis
# User's devices
SADD user_devices:userId deviceId1 deviceId2

# Device info
HSET device_info:deviceId userId socketId lastActiveAt status deviceType platform

# Socket to device mapping
SET socket_device:socketId deviceId EX 86400
```

### **Sync Tracking:**
```redis
# Device sync timestamps
HSET device_sync:deviceId lastMessageSync lastReadSync userId

# Device last seen per conversation
SET device_last_seen:deviceId:conversationId timestamp EX 2592000
```

### **Read Status Management:**
```redis
# Message delivery status
HSET msg_delivery:messageId userId "read:timestamp"

# Read conflict resolution
HSET msg_read_resolved:messageId userId deviceId readAt resolvedAt
```

## 🎮 Event Handlers

### **Device Read Sync Event:**
```typescript
@OnEvent('device.read.sync')
handleDeviceReadSync(payload: {
    socketId: string;
    messageIds: string[];
    readAt: number;
    syncedFrom: string;
    targetDeviceId: string;
}) {
    this.server.to(payload.socketId).emit('messages_read_sync', {
        messageIds: payload.messageIds,
        readAt: payload.readAt,
        syncedFrom: payload.syncedFrom
    });
}
```

### **Force Sync Event:**
```typescript
@OnEvent('device.force.sync')
handleForceSync(payload: {
    socketId: string;
    userId: string;
    deviceId: string;
    timestamp: number;
}) {
    // Trigger complete re-sync for device
}
```

## 🛠️ API Usage Examples

### **Integration with ChatGateway:**
```typescript
// Trong ChatGateway - khi user connect
const user = await this.socketAuthService.authenticateSocket(token);
if (user) {
    await this.deviceSyncService.syncDeviceOnConnect(
        user.sub, 
        deviceId, 
        socket
    );
}
```

### **Integration with MessagesService:**
```typescript
// Sau khi user read messages
await this.deviceSyncService.syncReadStatusToOtherDevices(
    userId,
    currentDeviceId,
    messageIds,
    Date.now()
);

// Update device last seen
await this.deviceSyncService.updateDeviceLastSeenInConversation(
    deviceId,
    conversationId
);
```

### **Admin Monitoring:**
```typescript
// GET /api/v1/socket/devices/:userId/sync-stats
const stats = await this.deviceSyncService.getDeviceSyncStats(userId);

// POST /api/v1/socket/devices/:userId/force-sync
await this.deviceSyncService.forceSyncAllDevices(userId);
```

## 🔍 Monitoring & Debugging

### **Log Examples:**
```log
[DeviceSyncService] Device sync completed for device123 (user: user456)
[DeviceSyncService] Found 15 missed messages for user456 since 2025-01-27T10:30:00.000Z
[DeviceSyncService] Synced read status for 5 messages to 2 other devices
[ChatGateway] Synced read status for 5 messages to device device789
```

### **Performance Metrics:**
```json
{
  "totalDevices": 3,
  "onlineDevices": 2,
  "lastSyncTimes": {
    "device123": "2025-01-27T10:35:00.000Z",
    "device456": "2025-01-27T10:30:00.000Z"
  }
}
```

## 🧪 Testing Strategy

### **Unit Tests:**
- Test device registration/deregistration
- Test missed messages filtering
- Test unread count calculation
- Test read conflict resolution

### **Integration Tests:**
- Test database integration với repositories
- Test event emission và handling
- Test Redis state management
- Test multi-device scenarios

### **Load Testing:**
- 100 concurrent devices per user
- 1000 missed messages per sync
- Cross-device read status propagation
- Memory usage monitoring

## 🚀 Production Deployment

### **Environment Variables:**
```env
# Sync configuration
DEVICE_SYNC_MISSED_MESSAGES_LIMIT=200
DEVICE_SYNC_READ_UPDATES_LIMIT=500
DEVICE_LAST_SEEN_TTL=2592000  # 30 days

# Redis TTL settings
DEVICE_INFO_TTL=86400         # 24 hours
SYNC_TIMESTAMP_TTL=2592000    # 30 days
READ_STATUS_TTL=2592000       # 30 days
```

### **Monitoring Alerts:**
- Device sync failure rate > 1%
- Missed messages > 200 per user
- Redis connection failures
- Memory usage > 80%

### **Performance Optimizations:**
- **Pagination**: Limit queries để avoid overwhelming database
- **Redis Pipelining**: Batch Redis operations
- **Event Batching**: Group related sync events
- **TTL Management**: Automatic cleanup of expired data

## 📚 References

- **Multi-Device Sync**: Zalo/Messenger architecture patterns
- **Event-Driven Architecture**: Martin Fowler patterns
- **Clean Architecture**: Uncle Bob Martin principles
- **Redis Patterns**: Redis Labs best practices
- **Socket.IO**: Real-time communication optimization
