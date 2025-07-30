# Online Presence System Architecture

## 🎯 Overview

Implementation của real-time online status tracking system cho chat application, sử dụng hybrid approach với Redis và Socket.IO.

## 🏗️ Architecture Design

### Core Components

```
📱 Client Connect/Disconnect
    ↓
🔌 ChatGateway (Socket.IO Events)
    ↓
🔴 PresenceService (Business Logic)
    ↓
📊 Redis (Persistent Storage) + 🔄 Socket.IO (Real-time Broadcast)
```

### Data Flow

1. **User Connection:**
   - Client connects → ChatGateway receives connection
   - Store user online status in Redis with TTL
   - Broadcast online status to user's contacts
   - Join user to presence rooms

2. **User Disconnection:**
   - Client disconnects → ChatGateway receives disconnection
   - Remove user online status from Redis
   - Broadcast offline status to user's contacts
   - Leave presence rooms

3. **Heartbeat Mechanism:**
   - Client sends periodic heartbeat (every 30s)
   - Server updates Redis TTL
   - Detect stale connections

## 🚀 Implementation Strategy

### 1. Redis Data Structure

```typescript
// User online status
presence:user:{userId} -> {
  status: 'online' | 'away' | 'busy' | 'offline',
  lastSeen: timestamp,
  deviceId: string,
  deviceType: 'mobile' | 'web' | 'desktop',
  connectedAt: timestamp
}

// Device connections (support multiple devices)
presence:devices:{userId} -> Set<deviceId>

// Contact relationships for presence notifications
presence:contacts:{userId} -> Set<contactUserId>
```

### 2. Socket.IO Events

```typescript
// Client → Server
'presence_update' // Update status (online, away, busy)
'heartbeat'       // Keep connection alive

// Server → Client  
'user_online'     // Friend came online
'user_offline'    // Friend went offline
'presence_status' // Status change notification
```

### 3. Service Architecture

```typescript
@Injectable()
export class PresenceService {
  // Core presence operations
  async setUserOnline(userId: string, deviceInfo: DeviceInfo): Promise<void>
  async setUserOffline(userId: string, deviceId: string): Promise<void>
  async updateUserStatus(userId: string, status: PresenceStatus): Promise<void>
  
  // Query operations
  async getUserPresence(userId: string): Promise<UserPresence | null>
  async getBulkPresence(userIds: string[]): Promise<Map<string, UserPresence>>
  async getUserContacts(userId: string): Promise<string[]>
  
  // Heartbeat management
  async updateHeartbeat(userId: string, deviceId: string): Promise<void>
  async cleanupStaleConnections(): Promise<void>
}
```

## 🔧 Performance Optimizations

### 1. Efficient Broadcasting
- **Contact-based notifications:** Only notify actual contacts, not all users
- **Room-based broadcasting:** Use Socket.IO rooms for efficient message delivery
- **Batch operations:** Group multiple presence updates together

### 2. Redis Optimizations
- **TTL management:** Auto-expire stale presence data
- **Pipeline operations:** Batch Redis commands for better performance
- **Lua scripts:** Atomic operations for complex presence logic

### 3. Memory Management
- **Connection tracking:** Use WeakMap for client connections
- **Cleanup strategies:** Regular cleanup of disconnected sockets
- **Rate limiting:** Prevent presence spam attacks

## 📱 Multi-Device Support

### Device Management
```typescript
interface DeviceInfo {
  deviceId: string;
  deviceType: 'mobile' | 'web' | 'desktop';
  platform: string;
  lastActive: number;
  socketId: string;
}

// User can be online on multiple devices
// Overall status = most active device status
```

### Status Priority
```typescript
online > busy > away > offline

// If user has mobile=online, web=away
// → Overall status = online
```

## 🛡️ Reliability Features

### 1. Connection Recovery
- **Reconnection detection:** Handle duplicate connections gracefully
- **Status persistence:** Maintain status across reconnections
- **Graceful degradation:** Fallback to periodic polling if WebSocket fails

### 2. Error Handling
- **Redis failures:** Cache presence data locally as fallback
- **Network issues:** Queue presence updates for retry
- **Invalid states:** Auto-correct inconsistent presence data

### 3. Monitoring
- **Connection metrics:** Track active connections and presence updates
- **Performance monitoring:** Monitor Redis operations and broadcast latency
- **Health checks:** Regular validation of presence data consistency

## 🔐 Privacy & Security

### 1. Permission Control
- **Contact visibility:** Only show presence to approved contacts
- **Privacy settings:** Allow users to hide online status
- **Blocking support:** Respect user blocking relationships

### 2. Data Protection
- **Minimal data:** Store only necessary presence information
- **TTL enforcement:** Auto-expire all presence data
- **Access control:** Validate permissions before showing presence

## 📊 Scalability Considerations

### 1. Horizontal Scaling
- **Redis Cluster:** Distribute presence data across multiple Redis nodes
- **Socket.IO Adapter:** Use Redis adapter for multi-server Socket.IO
- **Load balancing:** Distribute connections across server instances

### 2. Performance Metrics
- **Target latency:** < 100ms for presence updates
- **Throughput:** Support 10K+ concurrent connections per server
- **Storage:** Efficient Redis memory usage

## 🎉 Benefits

1. **Real-time Updates:** Instant online/offline notifications
2. **Multi-device Support:** Handle users with multiple active devices
3. **Scalable:** Redis-based architecture supports horizontal scaling
4. **Reliable:** Heartbeat mechanism detects stale connections
5. **Privacy-aware:** Respect user privacy and blocking settings
6. **Performance:** Optimized for high-concurrency scenarios

## 🚀 Implementation Phases

### Phase 1: Core Presence
- [x] Basic online/offline detection
- [x] Redis storage integration
- [x] Socket.IO broadcasting

### Phase 2: Advanced Features
- [ ] Multi-device support
- [ ] Custom status messages
- [ ] Away detection (inactive timeout)

### Phase 3: Optimizations
- [ ] Contact-based filtering
- [ ] Batch presence updates
- [ ] Performance monitoring

---

**Status:** 🔄 **READY TO IMPLEMENT** - Core architecture designed
