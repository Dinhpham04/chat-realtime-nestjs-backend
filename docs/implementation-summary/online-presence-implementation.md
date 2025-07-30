# Online Presence Implementation Guide

## 📋 Overview

Hệ thống online presence đã được implement thành công với các features sau:

## ✅ Implemented Features

### 1. Real-time Presence Tracking
- **Online/Offline Detection**: Tự động detect khi user connect/disconnect
- **Multi-device Support**: Handle user với multiple devices (mobile, web, desktop)
- **Status Updates**: Support các status: online, away, busy, offline
- **Custom Status Messages**: User có thể set custom status message

### 2. Heartbeat Mechanism
- **Keep-alive System**: Client gửi heartbeat mỗi 30 giây
- **Stale Connection Detection**: Auto-detect và cleanup connections không hoạt động
- **Background Cleanup**: Scheduled job cleanup stale connections mỗi 2 phút

### 3. Contact-based Notifications
- **Privacy Aware**: Chỉ notify presence cho contacts/friends
- **Efficient Broadcasting**: Sử dụng Socket.IO rooms cho targeted notifications
- **Bulk Presence Queries**: Optimized cho contact lists

## 🎯 Socket.IO Events

### Client → Server Events

#### `update_presence`
Update user's status manually
```typescript
socket.emit('update_presence', {
    status: 'away', // 'online' | 'away' | 'busy' | 'offline'
    statusMessage: 'In a meeting' // optional
});
```

#### `heartbeat`
Keep connection alive
```typescript
// Send every 30 seconds
socket.emit('heartbeat', {
    deviceId: 'device_123',
    timestamp: Date.now()
});
```

#### `get_bulk_presence`
Get presence for multiple users (contacts)
```typescript
socket.emit('get_bulk_presence', {
    userIds: ['user1', 'user2', 'user3']
});
```

#### `get_user_presence`  
Get presence for specific user
```typescript
socket.emit('get_user_presence', {
    userId: 'user_123'
});
```

### Server → Client Events

#### `contact_presence_update`
Notification khi contact thay đổi presence
```typescript
socket.on('contact_presence_update', (data) => {
    console.log(`${data.userId} is now ${data.status}`);
    // {
    //     userId: 'user_123',
    //     status: 'online',
    //     lastSeen: 1643723400000,
    //     statusMessage: 'Available',
    //     timestamp: 1643723400000
    // }
});
```

#### `heartbeat_ack`
Response cho heartbeat
```typescript
socket.on('heartbeat_ack', (data) => {
    console.log('Heartbeat confirmed:', data.timestamp);
});
```

#### `bulk_presence_response`
Response cho bulk presence request
```typescript
socket.on('bulk_presence_response', (data) => {
    console.log(`${data.onlineCount} contacts online`);
    data.presences.forEach(presence => {
        console.log(`${presence.userId}: ${presence.status}`);
    });
});
```

## 🔧 Integration trong ChatGateway

### Connection Flow
```typescript
// 1. User connects
handleConnection(client) {
    // ... authentication ...
    
    // Set user online
    await this.presenceService.setUserOnline(userId, deviceInfo);
    
    // Join presence room
    await client.join(`presence:${userId}`);
    
    // Notify contacts
    await this.notifyContactsAboutPresenceChange(userId, 'online');
}
```

### Disconnection Flow
```typescript
// 2. User disconnects
handleDisconnect(client) {
    // ... cleanup ...
    
    // Set user offline (if no other devices)
    await this.presenceService.setUserOffline(userId, deviceId);
    
    // Notify contacts
    await this.notifyContactsAboutPresenceChange(userId, 'offline');
}
```

## 📊 Redis Data Structure

### User Presence
```
presence:user:{userId} = {
    status: 'online',
    lastSeen: 1643723400000,
    deviceId: 'device_123',
    deviceType: 'mobile',
    platform: 'ios',
    socketId: 'socket_abc',
    statusMessage: 'Available'
}
TTL: 5 minutes
```

### Active Devices
```
presence:devices:{userId} = Set['device_123', 'device_456']
TTL: 5 minutes
```

### Contact Relationships
```
presence:contacts:{userId} = Set['friend1', 'friend2', 'friend3']
```

## 🚀 Frontend Integration Examples

### React/Vue Implementation
```typescript
// 1. Setup presence tracking
const setupPresence = () => {
    // Listen for contact presence updates
    socket.on('contact_presence_update', (data) => {
        updateContactStatus(data.userId, data.status);
    });

    // Send heartbeat every 30 seconds
    setInterval(() => {
        socket.emit('heartbeat', {
            deviceId: getDeviceId(),
            timestamp: Date.now()
        });
    }, 30000);
};

// 2. Update user status
const changeStatus = (status, message) => {
    socket.emit('update_presence', {
        status,
        statusMessage: message
    });
};

// 3. Load contact presence
const loadContactsPresence = (contactIds) => {
    socket.emit('get_bulk_presence', {
        userIds: contactIds
    });
    
    socket.once('bulk_presence_response', (data) => {
        setContactsPresence(data.presences);
    });
};
```

### Mobile Implementation
```javascript
// React Native example
const PresenceManager = {
    init() {
        // Handle app state changes
        AppState.addEventListener('change', this.handleAppStateChange);
        
        // Setup heartbeat
        this.startHeartbeat();
    },

    handleAppStateChange(nextAppState) {
        if (nextAppState === 'active') {
            socket.emit('update_presence', { status: 'online' });
        } else if (nextAppState === 'background') {
            socket.emit('update_presence', { status: 'away' });
        }
    },

    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (socket.connected) {
                socket.emit('heartbeat', {
                    deviceId: DeviceInfo.getUniqueId(),
                    timestamp: Date.now()
                });
            }
        }, 30000);
    }
};
```

## 🔄 Background Processing

### Cleanup Job
```typescript
// Runs every 2 minutes
@Cron('0 */2 * * * *')
async cleanupStaleConnections() {
    // Find connections without heartbeat > 2 minutes
    // Set them offline automatically
    // Notify their contacts
}
```

### Manual Cleanup
```typescript
// For admin/testing purposes
await presenceCleanupService.runCleanupNow();
```

## 📈 Performance Optimizations

### 1. Efficient Broadcasting
- **Room-based**: Chỉ broadcast cho users trong `presence:${userId}` room
- **Contact filtering**: Chỉ notify actual contacts, không spam tất cả users
- **Batch operations**: Group multiple presence updates together

### 2. Redis Optimizations
- **Pipeline operations**: Batch Redis commands
- **TTL management**: Auto-expire stale data
- **Efficient queries**: Use Redis Sets và Hashes cho optimal performance

### 3. Memory Management
- **Cleanup jobs**: Regular cleanup của stale connections
- **Efficient data structures**: Sử dụng Maps và Sets thay vì arrays
- **Connection tracking**: Track connections efficiently

## 🛡️ Security & Privacy

### 1. Permission Control
- **Contact visibility**: Chỉ contacts mới thấy presence
- **Privacy settings**: User có thể hide online status
- **Access validation**: Check permissions trước khi show presence

### 2. Data Protection
- **Minimal storage**: Chỉ store necessary presence data
- **Auto-expiry**: All presence data có TTL
- **No sensitive data**: Không store passwords hoặc tokens

## 🎉 Benefits Achieved

1. **Real-time Updates**: Instant online/offline notifications
2. **Scalable**: Redis-based architecture support horizontal scaling
3. **Multi-device**: Proper handling của users với multiple devices
4. **Reliable**: Heartbeat mechanism detect stale connections
5. **Performance**: Optimized broadcasting và efficient queries
6. **Privacy**: Contact-based visibility và permission control

## 🚀 Usage Examples

### Chat Application
```typescript
// Show online indicator next to contacts
const ContactList = ({ contacts }) => {
    const [presences, setPresences] = useState({});

    useEffect(() => {
        // Load presence for all contacts
        socket.emit('get_bulk_presence', {
            userIds: contacts.map(c => c.id)
        });

        socket.on('bulk_presence_response', (data) => {
            const presenceMap = {};
            data.presences.forEach(p => {
                presenceMap[p.userId] = p.status;
            });
            setPresences(presenceMap);
        });

        // Listen for real-time updates
        socket.on('contact_presence_update', (data) => {
            setPresences(prev => ({
                ...prev,
                [data.userId]: data.status
            }));
        });
    }, [contacts]);

    return (
        <div>
            {contacts.map(contact => (
                <div key={contact.id}>
                    <span>{contact.name}</span>
                    <OnlineIndicator status={presences[contact.id] || 'offline'} />
                </div>
            ))}
        </div>
    );
};
```

### Status Selector
```typescript
const StatusSelector = () => {
    const [status, setStatus] = useState('online');
    const [message, setMessage] = useState('');

    const updateStatus = (newStatus, newMessage = '') => {
        setStatus(newStatus);
        setMessage(newMessage);
        
        socket.emit('update_presence', {
            status: newStatus,
            statusMessage: newMessage
        });
    };

    return (
        <div>
            <select value={status} onChange={(e) => updateStatus(e.target.value)}>
                <option value="online">Online</option>
                <option value="away">Away</option>
                <option value="busy">Busy</option>
                <option value="offline">Appear Offline</option>
            </select>
            
            <input
                type="text"
                placeholder="Status message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onBlur={() => updateStatus(status, message)}
            />
        </div>
    );
};
```

---

## ✅ Implementation Status

- [x] **PresenceService**: Core business logic hoàn thành
- [x] **Redis Integration**: Persistent storage với TTL
- [x] **Socket.IO Events**: All presence events implemented
- [x] **ChatGateway Integration**: Connection/disconnection handling
- [x] **Background Cleanup**: Scheduled stale connection cleanup
- [x] **Multi-device Support**: Handle multiple devices per user
- [x] **Contact Notifications**: Efficient broadcasting system

**Status:** 🎉 **READY FOR USE** - Presence system fully implemented và ready for frontend integration!
