# Presence System API Documentation

## 📋 **Tổng quan**

Presence System quản lý trạng thái online/offline của users trong real-time, tương tự như Zalo, Messenger. Hệ thống hỗ trợ multi-device, custom status messages và heartbeat mechanism để đảm bảo tính chính xác.

### **Core Features**

#### **🟢 Presence Status Types**
- **online**: User đang active trên app
- **away**: User tạm rời khỏi app nhưng vẫn kết nối
- **busy**: User bận, không muốn bị làm phiền
- **offline**: User đã ngắt kết nối hoàn toàn

#### **📱 Multi-Device Support**
- Mỗi user có thể kết nối từ nhiều devices
- Track từng device riêng biệt (mobile, web, desktop)
- Auto-cleanup khi device ngắt kết nối

#### **💓 Heartbeat Mechanism**
- Client gửi heartbeat định kỳ để maintain connection
- Server tự động đặt user offline nếu không nhận heartbeat
- Configurable heartbeat interval

---

## 🚀 **Quick Start**

### **1. Setup Presence Service**

```typescript
// services/presenceService.ts
import { io, Socket } from 'socket.io-client';

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  lastSeen: number;
  statusMessage?: string;
}

export interface PresenceUpdate {
  userId: string;
  status: PresenceStatus;
  lastSeen: number;
  statusMessage?: string;
  timestamp: number;
}

class PresenceService {
  private socket: Socket | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private currentStatus: PresenceStatus = 'offline';
  private deviceId: string = '';

  // Initialize presence system
  async initialize(socket: Socket, deviceId: string) {
    this.socket = socket;
    this.deviceId = deviceId;
    
    this.setupEventListeners();
    this.startHeartbeat();
    
    // Set initial online status
    await this.updateStatus('online');
  }

  // Setup socket event listeners
  private setupEventListeners() {
    if (!this.socket) return;

    // Listen for presence updates from contacts
    this.socket.on('contact_presence_update', (data: PresenceUpdate) => {
      this.handleContactPresenceUpdate(data);
    });

    // Listen for bulk presence responses
    this.socket.on('bulk_presence_response', (data: {
      presences: UserPresence[];
      onlineCount: number;
      timestamp: number;
    }) => {
      this.handleBulkPresenceResponse(data);
    });

    // Listen for user presence responses
    this.socket.on('user_presence_response', (data: UserPresence) => {
      this.handleUserPresenceResponse(data);
    });

    // Listen for heartbeat acknowledgments
    this.socket.on('heartbeat_ack', (data: { timestamp: number; status: string }) => {
      console.log('Heartbeat acknowledged:', data);
    });
  }

  // Update user's presence status
  async updateStatus(status: PresenceStatus, statusMessage?: string) {
    if (!this.socket) return;

    this.currentStatus = status;

    this.socket.emit('update_presence', {
      status,
      statusMessage,
    });

    console.log(`Presence updated to: ${status}${statusMessage ? ` - ${statusMessage}` : ''}`);
  }

  // Get presence for multiple users (contacts list)
  async getBulkPresence(userIds: string[]) {
    if (!this.socket) return;

    this.socket.emit('get_bulk_presence', {
      userIds,
    });
  }

  // Get presence for specific user
  async getUserPresence(userId: string) {
    if (!this.socket) return;

    this.socket.emit('get_user_presence', {
      userId,
    });
  }

  // Start heartbeat mechanism
  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000); // 30 seconds
  }

  // Send heartbeat to server
  private sendHeartbeat() {
    if (!this.socket || this.currentStatus === 'offline') return;

    this.socket.emit('heartbeat', {
      deviceId: this.deviceId,
      timestamp: Date.now(),
    });
  }

  // Stop heartbeat when going offline
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Handle contact presence updates
  private handleContactPresenceUpdate(data: PresenceUpdate) {
    // Emit event for UI to update
    window.dispatchEvent(new CustomEvent('presence:contact_update', {
      detail: data
    }));
  }

  // Handle bulk presence response
  private handleBulkPresenceResponse(data: {
    presences: UserPresence[];
    onlineCount: number;
    timestamp: number;
  }) {
    // Emit event for UI to update
    window.dispatchEvent(new CustomEvent('presence:bulk_response', {
      detail: data
    }));
  }

  // Handle single user presence response
  private handleUserPresenceResponse(data: UserPresence) {
    // Emit event for UI to update
    window.dispatchEvent(new CustomEvent('presence:user_response', {
      detail: data
    }));
  }

  // Cleanup when disconnecting
  cleanup() {
    this.stopHeartbeat();
    this.currentStatus = 'offline';
    this.socket = null;
  }

  // Get current status
  getCurrentStatus(): PresenceStatus {
    return this.currentStatus;
  }
}

export const presenceService = new PresenceService();
```

### **2. React Context for Presence**

```typescript
// contexts/PresenceContext.tsx
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { presenceService, UserPresence, PresenceStatus, PresenceUpdate } from '../services/presenceService';

interface PresenceState {
  currentStatus: PresenceStatus;
  statusMessage?: string;
  contactsPresence: Map<string, UserPresence>;
  onlineCount: number;
  isInitialized: boolean;
}

const initialState: PresenceState = {
  currentStatus: 'offline',
  contactsPresence: new Map(),
  onlineCount: 0,
  isInitialized: false,
};

type PresenceAction =
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'UPDATE_STATUS'; payload: { status: PresenceStatus; statusMessage?: string } }
  | { type: 'UPDATE_CONTACT_PRESENCE'; payload: PresenceUpdate }
  | { type: 'SET_BULK_PRESENCE'; payload: { presences: UserPresence[]; onlineCount: number } }
  | { type: 'SET_USER_PRESENCE'; payload: UserPresence };

const presenceReducer = (state: PresenceState, action: PresenceAction): PresenceState => {
  switch (action.type) {
    case 'SET_INITIALIZED':
      return { ...state, isInitialized: action.payload };
    case 'UPDATE_STATUS':
      return {
        ...state,
        currentStatus: action.payload.status,
        statusMessage: action.payload.statusMessage,
      };
    case 'UPDATE_CONTACT_PRESENCE':
      const newContactsPresence = new Map(state.contactsPresence);
      newContactsPresence.set(action.payload.userId, {
        userId: action.payload.userId,
        status: action.payload.status,
        lastSeen: action.payload.lastSeen,
        statusMessage: action.payload.statusMessage,
      });
      return { ...state, contactsPresence: newContactsPresence };
    case 'SET_BULK_PRESENCE':
      const bulkPresence = new Map<string, UserPresence>();
      action.payload.presences.forEach(presence => {
        bulkPresence.set(presence.userId, presence);
      });
      return {
        ...state,
        contactsPresence: bulkPresence,
        onlineCount: action.payload.onlineCount,
      };
    case 'SET_USER_PRESENCE':
      const updatedPresence = new Map(state.contactsPresence);
      updatedPresence.set(action.payload.userId, action.payload);
      return { ...state, contactsPresence: updatedPresence };
    default:
      return state;
  }
};

const PresenceContext = createContext<{
  state: PresenceState;
  updateStatus: (status: PresenceStatus, statusMessage?: string) => Promise<void>;
  getBulkPresence: (userIds: string[]) => Promise<void>;
  getUserPresence: (userId: string) => Promise<void>;
  getContactPresence: (userId: string) => UserPresence | undefined;
  isUserOnline: (userId: string) => boolean;
}>({} as any);

export const PresenceProvider: React.FC<{ 
  children: React.ReactNode;
  socket: any;
  deviceId: string;
}> = ({ children, socket, deviceId }) => {
  const [state, dispatch] = useReducer(presenceReducer, initialState);

  // Initialize presence service
  useEffect(() => {
    const initialize = async () => {
      if (socket && deviceId && !state.isInitialized) {
        await presenceService.initialize(socket, deviceId);
        dispatch({ type: 'SET_INITIALIZED', payload: true });
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      presenceService.cleanup();
      dispatch({ type: 'SET_INITIALIZED', payload: false });
    };
  }, [socket, deviceId]);

  // Listen to custom events from presence service
  useEffect(() => {
    const handleContactUpdate = (event: CustomEvent<PresenceUpdate>) => {
      dispatch({ type: 'UPDATE_CONTACT_PRESENCE', payload: event.detail });
    };

    const handleBulkResponse = (event: CustomEvent<{
      presences: UserPresence[];
      onlineCount: number;
      timestamp: number;
    }>) => {
      dispatch({ 
        type: 'SET_BULK_PRESENCE', 
        payload: {
          presences: event.detail.presences,
          onlineCount: event.detail.onlineCount,
        }
      });
    };

    const handleUserResponse = (event: CustomEvent<UserPresence>) => {
      dispatch({ type: 'SET_USER_PRESENCE', payload: event.detail });
    };

    window.addEventListener('presence:contact_update', handleContactUpdate as EventListener);
    window.addEventListener('presence:bulk_response', handleBulkResponse as EventListener);
    window.addEventListener('presence:user_response', handleUserResponse as EventListener);

    return () => {
      window.removeEventListener('presence:contact_update', handleContactUpdate as EventListener);
      window.removeEventListener('presence:bulk_response', handleBulkResponse as EventListener);
      window.removeEventListener('presence:user_response', handleUserResponse as EventListener);
    };
  }, []);

  const updateStatus = async (status: PresenceStatus, statusMessage?: string) => {
    await presenceService.updateStatus(status, statusMessage);
    dispatch({ type: 'UPDATE_STATUS', payload: { status, statusMessage } });
  };

  const getBulkPresence = async (userIds: string[]) => {
    await presenceService.getBulkPresence(userIds);
  };

  const getUserPresence = async (userId: string) => {
    await presenceService.getUserPresence(userId);
  };

  const getContactPresence = (userId: string): UserPresence | undefined => {
    return state.contactsPresence.get(userId);
  };

  const isUserOnline = (userId: string): boolean => {
    const presence = state.contactsPresence.get(userId);
    return presence?.status === 'online' || presence?.status === 'away' || presence?.status === 'busy';
  };

  return (
    <PresenceContext.Provider
      value={{
        state,
        updateStatus,
        getBulkPresence,
        getUserPresence,
        getContactPresence,
        isUserOnline,
      }}
    >
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within PresenceProvider');
  }
  return context;
};
```

### **3. UI Components**

#### **Presence Status Indicator**
```typescript
// components/PresenceIndicator.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { usePresence } from '../contexts/PresenceContext';

interface PresenceIndicatorProps {
  userId: string;
  showText?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  userId,
  showText = false,
  size = 'medium'
}) => {
  const { getContactPresence, isUserOnline } = usePresence();
  const presence = getContactPresence(userId);

  const getStatusColor = () => {
    switch (presence?.status) {
      case 'online': return '#4CAF50';
      case 'away': return '#FF9800';
      case 'busy': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getStatusText = () => {
    if (!presence) return 'Unknown';
    
    if (presence.status === 'offline') {
      const lastSeenDate = new Date(presence.lastSeen);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - lastSeenDate.getTime()) / (1000 * 60));
      
      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
      return lastSeenDate.toLocaleDateString();
    }

    return presence.statusMessage || presence.status;
  };

  const getIndicatorSize = () => {
    switch (size) {
      case 'small': return 8;
      case 'medium': return 12;
      case 'large': return 16;
    }
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.indicator,
          {
            width: getIndicatorSize(),
            height: getIndicatorSize(),
            backgroundColor: getStatusColor(),
            borderRadius: getIndicatorSize() / 2,
          }
        ]}
      />
      {showText && (
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
      )}
    </View>
  );
};

const styles = {
  container: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  indicator: {
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
};
```

#### **Status Selector**
```typescript
// components/StatusSelector.tsx
import React, { useState } from 'react';
import { View, TouchableOpacity, Text, TextInput, Modal } from 'react-native';
import { usePresence } from '../contexts/PresenceContext';

const STATUS_OPTIONS = [
  { value: 'online', label: 'Online', color: '#4CAF50', emoji: '🟢' },
  { value: 'away', label: 'Away', color: '#FF9800', emoji: '🟡' },
  { value: 'busy', label: 'Busy', color: '#F44336', emoji: '🔴' },
  { value: 'offline', label: 'Appear Offline', color: '#9E9E9E', emoji: '⚫' },
];

export const StatusSelector: React.FC = () => {
  const { state, updateStatus } = usePresence();
  const [isVisible, setIsVisible] = useState(false);
  const [customMessage, setCustomMessage] = useState(state.statusMessage || '');

  const handleStatusChange = async (status: any) => {
    await updateStatus(status, customMessage || undefined);
    setIsVisible(false);
  };

  const currentStatusOption = STATUS_OPTIONS.find(opt => opt.value === state.currentStatus);

  return (
    <>
      <TouchableOpacity 
        style={styles.trigger}
        onPress={() => setIsVisible(true)}
      >
        <Text style={styles.emoji}>{currentStatusOption?.emoji}</Text>
        <View>
          <Text style={styles.statusLabel}>{currentStatusOption?.label}</Text>
          {state.statusMessage && (
            <Text style={styles.statusMessage}>{state.statusMessage}</Text>
          )}
        </View>
      </TouchableOpacity>

      <Modal visible={isVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set your status</Text>
            
            <TextInput
              style={styles.messageInput}
              placeholder="What's your status?"
              value={customMessage}
              onChangeText={setCustomMessage}
              maxLength={100}
            />

            {STATUS_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.statusOption,
                  state.currentStatus === option.value && styles.selectedOption
                ]}
                onPress={() => handleStatusChange(option.value)}
              >
                <Text style={styles.statusEmoji}>{option.emoji}</Text>
                <Text style={[styles.statusOptionText, { color: option.color }]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setIsVisible(false)}
            >
              <Text>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = {
  trigger: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  emoji: {
    fontSize: 18,
    marginRight: 12,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  statusMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginBottom: 16,
    textAlign: 'center' as const,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  statusOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedOption: {
    backgroundColor: '#e3f2fd',
  },
  statusEmoji: {
    fontSize: 16,
    marginRight: 12,
  },
  statusOptionText: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
  cancelButton: {
    padding: 12,
    alignItems: 'center' as const,
    marginTop: 8,
  },
};
```

#### **Contacts List with Presence**
```typescript
// components/ContactsList.tsx
import React, { useEffect } from 'react';
import { FlatList, View, Text, Image, TouchableOpacity } from 'react-native';
import { usePresence } from '../contexts/PresenceContext';
import { PresenceIndicator } from './PresenceIndicator';

interface Contact {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
}

interface ContactsListProps {
  contacts: Contact[];
  onContactPress: (contact: Contact) => void;
}

export const ContactsList: React.FC<ContactsListProps> = ({
  contacts,
  onContactPress
}) => {
  const { getBulkPresence, getContactPresence } = usePresence();

  // Load presence for all contacts when component mounts
  useEffect(() => {
    if (contacts.length > 0) {
      const userIds = contacts.map(contact => contact.id);
      getBulkPresence(userIds);
    }
  }, [contacts, getBulkPresence]);

  const renderContact = ({ item }: { item: Contact }) => {
    const presence = getContactPresence(item.id);
    
    return (
      <TouchableOpacity
        style={styles.contactItem}
        onPress={() => onContactPress(item)}
      >
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: item.avatarUrl || 'https://via.placeholder.com/50' }}
            style={styles.avatar}
          />
          <View style={styles.presenceIndicatorContainer}>
            <PresenceIndicator userId={item.id} size="small" />
          </View>
        </View>

        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.fullName || item.username}</Text>
          <PresenceIndicator userId={item.id} showText size="small" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={contacts}
      renderItem={renderContact}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = {
  contactItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarContainer: {
    position: 'relative' as const,
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  presenceIndicatorContainer: {
    position: 'absolute' as const,
    bottom: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 2,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
};
```

### **4. Usage in App**

```typescript
// App.tsx hoặc ChatScreen.tsx
import React, { useEffect } from 'react';
import { View } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { PresenceProvider } from './contexts/PresenceContext';
import { ContactsList } from './components/ContactsList';
import { StatusSelector } from './components/StatusSelector';

export const ChatApp: React.FC = () => {
  const [socket, setSocket] = useState<any>(null);
  const [deviceId, setDeviceId] = useState<string>('');

  useEffect(() => {
    // Get device ID
    const getDeviceId = async () => {
      const id = await DeviceInfo.getUniqueId();
      setDeviceId(id);
    };
    
    getDeviceId();
    
    // Initialize socket connection
    // Your socket initialization code here
    
  }, []);

  if (!socket || !deviceId) {
    return <View><Text>Loading...</Text></View>;
  }

  return (
    <PresenceProvider socket={socket} deviceId={deviceId}>
      <View style={styles.container}>
        {/* Status selector in header */}
        <StatusSelector />
        
        {/* Contacts list with presence indicators */}
        <ContactsList 
          contacts={contacts}
          onContactPress={handleContactPress}
        />
      </View>
    </PresenceProvider>
  );
};
```

---

## 📡 **WebSocket Events Chi tiết**

### **1. 🔄 Update Presence Status**

Client thay đổi status của mình.

**Event:** `update_presence`

**Payload:**
```typescript
{
  "status": "busy",
  "statusMessage": "In a meeting"
}
```

**Response:** Không có response trực tiếp, nhưng contacts sẽ nhận được `contact_presence_update` event.

### **2. 💓 Heartbeat**

Client gửi heartbeat để maintain connection.

**Event:** `heartbeat`

**Payload:**
```typescript
{
  "deviceId": "RNE123456789",
  "timestamp": 1693123456789
}
```

**Response:** `heartbeat_ack`
```typescript
{
  "timestamp": 1693123456789,
  "status": "alive"
}
```

### **3. 👥 Get Bulk Presence**

Client request presence cho nhiều users cùng lúc (contacts list).

**Event:** `get_bulk_presence`

**Payload:**
```typescript
{
  "userIds": ["user1", "user2", "user3"]
}
```

**Response:** `bulk_presence_response`
```typescript
{
  "presences": [
    {
      "userId": "user1",
      "status": "online",
      "lastSeen": 1693123456789,
      "statusMessage": "Available"
    },
    {
      "userId": "user2", 
      "status": "away",
      "lastSeen": 1693123456789
    }
  ],
  "onlineCount": 2,
  "timestamp": 1693123456789
}
```

### **4. 👤 Get User Presence**

Client request presence cho 1 user cụ thể.

**Event:** `get_user_presence`

**Payload:**
```typescript
{
  "userId": "user123"
}
```

**Response:** `user_presence_response`
```typescript
{
  "userId": "user123",
  "status": "online",
  "lastSeen": 1693123456789,
  "statusMessage": "Working from home"
}
```

### **5. 📢 Contact Presence Update**

Server broadcast khi contact thay đổi presence.

**Event:** `contact_presence_update` (Received)

**Payload:**
```typescript
{
  "userId": "user123",
  "status": "away",
  "lastSeen": 1693123456789,
  "statusMessage": "Be right back",
  "timestamp": 1693123456789
}
```

---

## 🎯 **Implementation Best Practices**

### **1. Efficient Presence Loading**

```typescript
// Load presence cho contacts khi vào màn hình
useEffect(() => {
  const loadContactsPresence = async () => {
    if (contacts.length > 0) {
      // Batch load instead of individual requests
      const userIds = contacts.map(c => c.id);
      await getBulkPresence(userIds);
    }
  };

  loadContactsPresence();
}, [contacts]);
```

### **2. Smart Status Management**

```typescript
// Auto set away khi app goes to background
import { AppState } from 'react-native';

useEffect(() => {
  const handleAppStateChange = async (nextAppState: string) => {
    if (nextAppState === 'background') {
      await updateStatus('away', 'Away');
    } else if (nextAppState === 'active') {
      await updateStatus('online');
    }
  };

  const subscription = AppState.addEventListener('change', handleAppStateChange);
  return () => subscription?.remove();
}, []);
```

### **3. Optimized Re-renders**

```typescript
// Memoize presence component để tránh re-render không cần thiết
const PresenceIndicator = React.memo<PresenceIndicatorProps>(({ userId, showText, size }) => {
  const { getContactPresence } = usePresence();
  const presence = getContactPresence(userId);

  return (
    <View style={styles.container}>
      {/* UI render */}
    </View>
  );
}, (prevProps, nextProps) => {
  // Only re-render if userId changes
  return prevProps.userId === nextProps.userId;
});
```

### **4. Heartbeat Optimization**

```typescript
// Adaptive heartbeat based on app state
class PresenceService {
  private heartbeatInterval: number = 30000; // Default 30s

  private adaptHeartbeatToAppState() {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background') {
        // Longer interval when in background
        this.heartbeatInterval = 60000; // 1 minute
      } else {
        // Normal interval when active
        this.heartbeatInterval = 30000; // 30 seconds
      }
      
      this.restartHeartbeat();
    });

    return subscription;
  }
}
```

### **5. Offline Handling**

```typescript
// Handle network connectivity changes
import NetInfo from '@react-native-community/netinfo';

useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
    if (state.isConnected) {
      // Reconnected - reload presence
      if (contacts.length > 0) {
        getBulkPresence(contacts.map(c => c.id));
      }
    } else {
      // Disconnected - show cached presence with offline indicators
      dispatch({ type: 'SET_OFFLINE_MODE', payload: true });
    }
  });

  return unsubscribe;
}, []);
```

---

## 🔧 **Configuration & Testing**

### **Environment Variables**
```env
# Presence System
PRESENCE_HEARTBEAT_INTERVAL=30000
PRESENCE_STALE_TIMEOUT=120000
PRESENCE_CLEANUP_INTERVAL=300000
```

### **Testing với Postman/Socket.IO Client**

```javascript
// Test presence updates
const socket = io('http://localhost:3000/chat');

// Authenticate first
socket.emit('authenticate', { 
  token: 'your-jwt-token',
  deviceInfo: {
    deviceId: 'test-device-123',
    deviceType: 'web',
    platform: 'web'
  }
});

// Update presence
socket.emit('update_presence', {
  status: 'busy',
  statusMessage: 'In a meeting'
});

// Get bulk presence
socket.emit('get_bulk_presence', {
  userIds: ['user1', 'user2', 'user3']
});

// Listen for updates
socket.on('contact_presence_update', (data) => {
  console.log('Contact presence updated:', data);
});
```

### **Debug Logging**

```typescript
// Enable debug logging for presence
const presenceService = {
  debugMode: __DEV__,
  
  log(message: string, data?: any) {
    if (this.debugMode) {
      console.log(`[Presence] ${message}`, data);
    }
  }
};
```

---

## ⚠️ **Error Handling**

### **Common Scenarios**

```typescript
const handlePresenceError = (error: any) => {
  switch (error.type) {
    case 'SOCKET_DISCONNECTED':
      // Show offline indicator
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'disconnected' });
      break;
      
    case 'HEARTBEAT_FAILED':
      // Attempt reconnection
      setTimeout(() => {
        presenceService.reconnect();
      }, 5000);
      break;
      
    case 'PRESENCE_UPDATE_FAILED':
      // Retry status update
      console.warn('Failed to update presence, retrying...');
      break;
      
    default:
      console.error('Unknown presence error:', error);
  }
};
```

---

**🎉 Presence System ready for production!** Frontend team có thể implement complete online/offline status system với real-time updates như Zalo/Messenger! 🚀

Bạn có muốn tôi tạo thêm documentation cho modules khác như **Messages**, **Files**, hay **Voice/Video Calls** không?
