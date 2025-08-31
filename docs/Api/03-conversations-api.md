# Conversations API Documentation

## 📋 **Tổng quan**

Module Conversations quản lý toàn bộ cuộc trò chuyện trong ứng dụng chat, bao gồm chat 1-1 và nhóm. API được thiết kế theo Mobile-First approach, tối ưu cho React Native với kiến trúc "prepare-then-activate".

### **Core Concepts**

#### **🔄 Conversation Lifecycle**
```
1. 📱 Prepare Conversation → Tạo conversation khi user click contact
2. 💬 Send First Message → Activate conversation với tin nhắn đầu tiên  
3. 🔄 Active Conversation → Chat bình thường với real-time messaging
4. 🏠 Archive/Leave → User rời khỏi hoặc archive conversation
```

#### **👥 Conversation Types**
- **Direct**: Chat 1-1 giữa 2 users
- **Group**: Chat nhóm với nhiều participants (tối đa 1000 members)

---

## 🚀 **Quick Start**

### **1. Setup Conversations Service**

```typescript
// services/conversationsService.ts
import httpClient from '../utils/httpClient';

export interface ConversationListItem {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  avatarUrl?: string;
  lastMessage?: {
    id: string;
    content: string;
    messageType: string;
    senderId: string;
    createdAt: string;
  };
  unreadCount: number;
  status: {
    isActive: boolean;
    isArchived: boolean;
    isPinned: boolean;
  };
}

export interface ConversationDetail {
  id: string;
  type: 'direct' | 'group';
  name?: string;
  description?: string;
  avatarUrl?: string;
  participants: Array<{
    userId: string;
    role: 'admin' | 'member';
    joinedAt: string;
    user: {
      id: string;
      username: string;
      fullName: string;
      avatarUrl?: string;
      isOnline: boolean;
    };
  }>;
  settings: {
    allowMemberInvite: boolean;
    allowMemberLeave: boolean;
    requireAdminApproval: boolean;
    maxParticipants: number;
    isPublic: boolean;
  };
  permissions: {
    canSendMessages: boolean;
    canAddMembers: boolean;
    canRemoveMembers: boolean;
    canEditGroup: boolean;
    canDeleteGroup: boolean;
    isAdmin: boolean;
  };
  isActive: boolean;
  unreadCount: number;
}

class ConversationsService {
  // 1. Prepare conversation (click contact)
  async prepareDirectConversation(participantId: string) {
    const response = await httpClient.post('/conversations/create-direct', {
      participantId,
    });
    return response.data;
  }

  // 2. Get conversation list
  async getConversations(params?: {
    type?: 'direct' | 'group';
    status?: 'active' | 'archived';
    limit?: number;
    offset?: number;
    search?: string;
    sortBy?: 'lastActivity' | 'name';
    pinnedOnly?: boolean;
    unreadOnly?: boolean;
  }) {
    const response = await httpClient.get('/conversations', { params });
    return response.data;
  }

  // 3. Get conversation details
  async getConversation(conversationId: string) {
    const response = await httpClient.get(`/conversations/${conversationId}`);
    return response.data;
  }

  // 4. Create group conversation
  async createGroup(data: {
    name: string;
    description?: string;
    participantIds: string[];
    avatarUrl?: string;
    settings?: {
      allowMembersToAdd?: boolean;
      allowAllToSend?: boolean;
      muteNotifications?: boolean;
      disappearingMessages?: number;
    };
    initialMessage?: string;
  }) {
    const response = await httpClient.post('/conversations/group', data);
    return response.data;
  }

  // 5. Update group info
  async updateGroup(conversationId: string, data: {
    name?: string;
    description?: string;
    avatarUrl?: string;
    settings?: {
      allowMembersToAdd?: boolean;
      allowAllToSend?: boolean;
      muteNotifications?: boolean;
      disappearingMessages?: number;
    };
  }) {
    const response = await httpClient.put(`/conversations/${conversationId}`, data);
    return response.data;
  }

  // 6. Delete group (admin only)
  async deleteGroup(conversationId: string) {
    const response = await httpClient.delete(`/conversations/${conversationId}`);
    return response.data;
  }

  // Participant Management
  async addParticipants(conversationId: string, userIds: string[], role: 'admin' | 'member' = 'member') {
    const response = await httpClient.post(`/conversations/${conversationId}/participants`, {
      userIds,
      role,
    });
    return response.data;
  }

  async updateParticipantRole(conversationId: string, userId: string, role: 'admin' | 'member') {
    const response = await httpClient.put(`/conversations/${conversationId}/participants/${userId}`, {
      role,
    });
    return response.data;
  }

  async removeParticipant(conversationId: string, userId: string) {
    const response = await httpClient.delete(`/conversations/${conversationId}/participants/${userId}`);
    return response.data;
  }

  async leaveConversation(conversationId: string) {
    const response = await httpClient.post(`/conversations/${conversationId}/leave`);
    return response.data;
  }
}

export const conversationsService = new ConversationsService();
```

### **2. React Context for Conversations**

```typescript
// contexts/ConversationsContext.tsx
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { conversationsService, ConversationListItem, ConversationDetail } from '../services/conversationsService';

interface ConversationsState {
  conversations: ConversationListItem[];
  currentConversation: ConversationDetail | null;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  nextOffset: number;
}

const initialState: ConversationsState = {
  conversations: [],
  currentConversation: null,
  isLoading: false,
  error: null,
  hasMore: true,
  nextOffset: 0,
};

type ConversationsAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CONVERSATIONS'; payload: { conversations: ConversationListItem[]; hasMore: boolean; nextOffset: number } }
  | { type: 'ADD_CONVERSATIONS'; payload: { conversations: ConversationListItem[]; hasMore: boolean; nextOffset: number } }
  | { type: 'SET_CURRENT_CONVERSATION'; payload: ConversationDetail | null }
  | { type: 'UPDATE_CONVERSATION'; payload: ConversationListItem }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' };

const conversationsReducer = (state: ConversationsState, action: ConversationsAction): ConversationsState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_CONVERSATIONS':
      return {
        ...state,
        conversations: action.payload.conversations,
        hasMore: action.payload.hasMore,
        nextOffset: action.payload.nextOffset,
      };
    case 'ADD_CONVERSATIONS':
      return {
        ...state,
        conversations: [...state.conversations, ...action.payload.conversations],
        hasMore: action.payload.hasMore,
        nextOffset: action.payload.nextOffset,
      };
    case 'SET_CURRENT_CONVERSATION':
      return { ...state, currentConversation: action.payload };
    case 'UPDATE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.map(conv =>
          conv.id === action.payload.id ? action.payload : conv
        ),
      };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
};

const ConversationsContext = createContext<{
  state: ConversationsState;
  loadConversations: (refresh?: boolean) => Promise<void>;
  loadMoreConversations: () => Promise<void>;
  prepareDirectConversation: (participantId: string) => Promise<string>;
  loadConversation: (conversationId: string) => Promise<void>;
  createGroup: (data: any) => Promise<string>;
  updateGroup: (conversationId: string, data: any) => Promise<void>;
  deleteGroup: (conversationId: string) => Promise<void>;
  addParticipants: (conversationId: string, userIds: string[]) => Promise<void>;
  removeParticipant: (conversationId: string, userId: string) => Promise<void>;
  leaveConversation: (conversationId: string) => Promise<void>;
  clearError: () => void;
}>({} as any);

export const ConversationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(conversationsReducer, initialState);

  const loadConversations = async (refresh = false) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      const response = await conversationsService.getConversations({
        offset: refresh ? 0 : state.nextOffset,
        limit: 20,
      });

      if (refresh) {
        dispatch({ type: 'SET_CONVERSATIONS', payload: response });
      } else {
        dispatch({ type: 'ADD_CONVERSATIONS', payload: response });
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const loadMoreConversations = async () => {
    if (!state.hasMore || state.isLoading) return;
    await loadConversations(false);
  };

  const prepareDirectConversation = async (participantId: string): Promise<string> => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      const response = await conversationsService.prepareDirectConversation(participantId);
      return response.conversationId;
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  };

  const loadConversation = async (conversationId: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      const conversation = await conversationsService.getConversation(conversationId);
      dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: conversation });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const createGroup = async (data: any): Promise<string> => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      const response = await conversationsService.createGroup(data);
      
      // Refresh conversations list
      await loadConversations(true);
      
      return response.conversation.id;
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  };

  const updateGroup = async (conversationId: string, data: any) => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      await conversationsService.updateGroup(conversationId, data);
      
      // Reload current conversation if it's the one being updated
      if (state.currentConversation?.id === conversationId) {
        await loadConversation(conversationId);
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  };

  const deleteGroup = async (conversationId: string) => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      await conversationsService.deleteGroup(conversationId);
      
      // Remove from conversations list
      await loadConversations(true);
      
      // Clear current conversation if it's the deleted one
      if (state.currentConversation?.id === conversationId) {
        dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: null });
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  };

  const addParticipants = async (conversationId: string, userIds: string[]) => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      await conversationsService.addParticipants(conversationId, userIds);
      
      // Reload conversation details
      if (state.currentConversation?.id === conversationId) {
        await loadConversation(conversationId);
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  };

  const removeParticipant = async (conversationId: string, userId: string) => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      await conversationsService.removeParticipant(conversationId, userId);
      
      // Reload conversation details
      if (state.currentConversation?.id === conversationId) {
        await loadConversation(conversationId);
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  };

  const leaveConversation = async (conversationId: string) => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      await conversationsService.leaveConversation(conversationId);
      
      // Remove from conversations list and clear current
      await loadConversations(true);
      if (state.currentConversation?.id === conversationId) {
        dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: null });
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Load conversations on mount
  useEffect(() => {
    loadConversations(true);
  }, []);

  return (
    <ConversationsContext.Provider
      value={{
        state,
        loadConversations,
        loadMoreConversations,
        prepareDirectConversation,
        loadConversation,
        createGroup,
        updateGroup,
        deleteGroup,
        addParticipants,
        removeParticipant,
        leaveConversation,
        clearError,
      }}
    >
      {children}
    </ConversationsContext.Provider>
  );
};

export const useConversations = () => {
  const context = useContext(ConversationsContext);
  if (!context) {
    throw new Error('useConversations must be used within ConversationsProvider');
  }
  return context;
};
```

### **3. Usage Examples**

#### **Conversations List Screen**
```typescript
// screens/ConversationsListScreen.tsx
import React, { useCallback } from 'react';
import { View, FlatList, TouchableOpacity, Text, Image, RefreshControl } from 'react-native';
import { useConversations } from '../contexts/ConversationsContext';
import { useNavigation } from '@react-navigation/native';

export const ConversationsListScreen: React.FC = () => {
  const { state, loadConversations, loadMoreConversations, prepareDirectConversation } = useConversations();
  const navigation = useNavigation();

  const handleConversationPress = (conversation: any) => {
    navigation.navigate('Chat', { conversationId: conversation.id });
  };

  const handleContactPress = async (contactId: string) => {
    try {
      const conversationId = await prepareDirectConversation(contactId);
      navigation.navigate('Chat', { conversationId });
    } catch (error) {
      console.error('Failed to prepare conversation:', error);
    }
  };

  const renderConversation = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => handleConversationPress(item)}
    >
      <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
      
      <View style={styles.conversationInfo}>
        <View style={styles.header}>
          <Text style={styles.name}>{item.name || 'Direct Chat'}</Text>
          {item.lastMessage && (
            <Text style={styles.timestamp}>
              {new Date(item.lastMessage.createdAt).toLocaleTimeString()}
            </Text>
          )}
        </View>
        
        {item.lastMessage && (
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage.content}
          </Text>
        )}
        
        {item.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadCount}>{item.unreadCount}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={state.conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={state.isLoading}
            onRefresh={() => loadConversations(true)}
          />
        }
        onEndReached={loadMoreConversations}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};
```

#### **Chat Screen**
```typescript
// screens/ChatScreen.tsx
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useConversations } from '../contexts/ConversationsContext';
import { useRoute, useNavigation } from '@react-navigation/native';

export const ChatScreen: React.FC = () => {
  const { state, loadConversation } = useConversations();
  const route = useRoute();
  const navigation = useNavigation();
  const { conversationId } = route.params as { conversationId: string };

  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId);
    }
  }, [conversationId]);

  useEffect(() => {
    if (state.currentConversation) {
      // Set navigation title
      navigation.setOptions({
        title: state.currentConversation.name || 'Chat',
        headerRight: () => (
          <TouchableOpacity onPress={() => {
            if (state.currentConversation?.type === 'group') {
              navigation.navigate('GroupInfo', { conversationId });
            } else {
              navigation.navigate('UserProfile', { 
                userId: state.currentConversation?.participants[0]?.userId 
              });
            }
          }}>
            <Text>Info</Text>
          </TouchableOpacity>
        ),
      });
    }
  }, [state.currentConversation]);

  if (state.isLoading) {
    return (
      <View style={styles.loading}>
        <Text>Loading conversation...</Text>
      </View>
    );
  }

  if (!state.currentConversation) {
    return (
      <View style={styles.error}>
        <Text>Conversation not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Chat messages component */}
      <Text>Chat with {state.currentConversation.name}</Text>
      
      {/* Message input component */}
    </View>
  );
};
```

#### **Create Group Screen**
```typescript 
// screens/CreateGroupScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, Alert } from 'react-native';
import { useConversations } from '../contexts/ConversationsContext';
import { useNavigation } from '@react-navigation/native';

export const CreateGroupScreen: React.FC = () => {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const { createGroup } = useConversations();
  const navigation = useNavigation();

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedContacts.length < 2) {
      Alert.alert('Error', 'Group name and at least 2 participants are required');
      return;
    }

    try {
      const conversationId = await createGroup({
        name: groupName,
        description: description || undefined,
        participantIds: selectedContacts,
        initialMessage: `Welcome to ${groupName}!`,
      });

      navigation.replace('Chat', { conversationId });
    } catch (error) {
      Alert.alert('Error', 'Failed to create group');
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Group Name"
        value={groupName}
        onChangeText={setGroupName}
        style={styles.input}
        maxLength={100}
      />
      
      <TextInput
        placeholder="Description (optional)"
        value={description}
        onChangeText={setDescription}
        style={styles.input}
        maxLength={500}
        multiline
      />
      
      {/* Contact selection component */}
      
      <TouchableOpacity 
        onPress={handleCreateGroup}
        style={styles.createButton}
        disabled={!groupName.trim() || selectedContacts.length < 2}
      >
        <Text style={styles.createButtonText}>Create Group</Text>
      </TouchableOpacity>
    </View>
  );
};
```

---

## 📡 **API Endpoints Chi tiết**

### **1. 🔄 Prepare Direct Conversation**

Tạo hoặc tìm conversation giữa 2 users khi click vào contact.

**Endpoint:** `POST /conversations/create-direct`

**Request:**
```typescript
{
  "participantId": "64f1a2b3c4d5e6f7a8b9c0d1"
}
```

**Response:**
```typescript
{
  "conversationId": "64f2b3c4d5e6f7a8b9c0d1e2",
  "exists": false,
  "isActive": false,
  "participant": {
    "id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "username": "johndoe",
    "fullName": "John Doe",
    "avatarUrl": "https://example.com/avatar.jpg",
    "isOnline": true
  },
  "conversation": {
    "id": "64f2b3c4d5e6f7a8b9c0d1e2",
    "type": "direct",
    "createdAt": "2025-08-16T10:00:00.000Z",
    "lastActivity": "2025-08-16T10:00:00.000Z"
  }
}
```

### **2. 📋 Get Conversations List**

Lấy danh sách conversations của user với pagination và filtering.

**Endpoint:** `GET /conversations`

**Query Parameters:**
```typescript
{
  type?: 'direct' | 'group';
  status?: 'active' | 'archived';
  limit?: number;    // Default: 20, Max: 100
  offset?: number;   // Default: 0
  search?: string;   // Search trong tên conversation
  sortBy?: 'lastActivity' | 'name';  // Default: lastActivity
  pinnedOnly?: boolean;  // Chỉ lấy conversations đã pin
  unreadOnly?: boolean;  // Chỉ lấy conversations có tin nhắn chưa đọc
}
```

**Response:**
```typescript
{
  "conversations": [
    {
      "id": "64f2b3c4d5e6f7a8b9c0d1e2",
      "type": "group",
      "name": "Project Team Alpha",
      "avatarUrl": "https://example.com/group-avatar.jpg",
      "lastMessage": {
        "id": "64f3c4d5e6f7a8b9c0d1e2f3",
        "content": "Let's schedule the meeting for tomorrow",
        "messageType": "text",
        "senderId": "64f1a2b3c4d5e6f7a8b9c0d1",
        "createdAt": "2025-08-16T14:30:00.000Z"
      },
      "unreadCount": 3,
      "status": {
        "isActive": true,
        "isArchived": false,
        "isPinned": true
      }
    }
  ],
  "total": 25,
  "hasMore": true,
  "nextOffset": 20,
  "meta": {
    "requestedAt": "2025-08-16T15:00:00.000Z",
    "responseTime": 45
  }
}
```

### **3. 📖 Get Conversation Details**

Lấy thông tin chi tiết của conversation bao gồm participants và permissions.

**Endpoint:** `GET /conversations/:conversationId`

**Response:**
```typescript
{
  "id": "64f2b3c4d5e6f7a8b9c0d1e2",
  "type": "group",
  "name": "Project Team Alpha",
  "description": "Discussion for Project Alpha development",
  "avatarUrl": "https://example.com/group-avatar.jpg",
  "participants": [
    {
      "userId": "64f1a2b3c4d5e6f7a8b9c0d1",
      "role": "admin",
      "joinedAt": "2025-08-16T10:00:00.000Z",
      "user": {
        "id": "64f1a2b3c4d5e6f7a8b9c0d1",
        "username": "johndoe",
        "fullName": "John Doe",
        "avatarUrl": "https://example.com/john-avatar.jpg",
        "isOnline": true
      }
    }
  ],
  "settings": {
    "allowMemberInvite": true,
    "allowMemberLeave": true,
    "requireAdminApproval": false,
    "maxParticipants": 1000,
    "isPublic": false
  },
  "permissions": {
    "canSendMessages": true,
    "canAddMembers": true,
    "canRemoveMembers": true,
    "canEditGroup": true,
    "canDeleteGroup": true,
    "isAdmin": true
  },
  "isActive": true,
  "unreadCount": 0
}
```

### **4. 👥 Create Group Conversation**

Tạo group conversation mới với multiple participants.

**Endpoint:** `POST /conversations/group`

**Request:**
```typescript
{
  "name": "Project Team Alpha",
  "description": "Discussion for Project Alpha development",
  "participantIds": ["user1", "user2", "user3"],
  "avatarUrl": "https://example.com/group-avatar.jpg",
  "settings": {
    "allowMembersToAdd": true,
    "allowAllToSend": true,
    "muteNotifications": false,
    "disappearingMessages": 0
  },
  "initialMessage": "Welcome to our project team!"
}
```

**Response:**
```typescript
{
  "conversation": {
    "id": "64f2b3c4d5e6f7a8b9c0d1e2",
    "type": "group",
    "name": "Project Team Alpha",
    "description": "Discussion for Project Alpha development",
    "avatarUrl": "https://example.com/group-avatar.jpg",
    "participants": [...],
    "createdBy": "64f1a2b3c4d5e6f7a8b9c0d1",
    "createdAt": "2025-08-16T10:00:00.000Z",
    "isActive": true
  },
  "invitesSent": 3,
  "initialMessage": {
    "id": "64f3c4d5e6f7a8b9c0d1e2f3",
    "content": "Welcome to our project team!",
    "messageType": "text"
  }
}
```

### **5. ✏️ Update Group Conversation**

Cập nhật thông tin group (chỉ admin).

**Endpoint:** `PUT /conversations/:conversationId`

**Request:**
```typescript
{
  "name": "Updated Group Name",
  "description": "Updated description",
  "avatarUrl": "https://example.com/new-avatar.jpg",
  "settings": {
    "allowMembersToAdd": false,
    "allowAllToSend": true,
    "muteNotifications": false,
    "disappearingMessages": 24
  }
}
```

### **6. 🗑️ Delete Group Conversation**

Xóa group conversation (chỉ admin).

**Endpoint:** `DELETE /conversations/:conversationId`

**Response:**
```typescript
{
  "success": true,
  "deletedAt": "2025-08-16T15:00:00.000Z",
  "participantsNotified": 5
}
```

---

## 👥 **Participant Management**

### **1. ➕ Add Participants**

Thêm members vào group (chỉ admin hoặc members nếu setting cho phép).

**Endpoint:** `POST /conversations/:conversationId/participants`

**Request:**
```typescript
{
  "userIds": ["user4", "user5"],
  "role": "member"
}
```

**Response:**
```typescript
{
  "added": [
    {
      "userId": "user4",
      "role": "member",
      "joinedAt": "2025-08-16T15:00:00.000Z"
    }
  ],
  "failed": [
    {
      "userId": "user5",
      "reason": "User not found"
    }
  ],
  "totalParticipants": 6
}
```

### **2. 🔄 Update Participant Role**

Thay đổi role của participant (admin ↔ member).

**Endpoint:** `PUT /conversations/:conversationId/participants/:userId`

**Request:**
```typescript
{
  "role": "admin"
}
```

**Response:**
```typescript
{
  "participant": {
    "userId": "user2",
    "role": "admin",
    "joinedAt": "2025-08-16T10:05:00.000Z"
  },
  "previousRole": "member",
  "updatedAt": "2025-08-16T15:30:00.000Z"
}
```

### **3. ❌ Remove Participant**

Kick member khỏi group (chỉ admin).

**Endpoint:** `DELETE /conversations/:conversationId/participants/:userId`

**Response:**
```typescript
{
  "success": true,
  "removedUserId": "user3",
  "removedAt": "2025-08-16T15:45:00.000Z",
  "remainingParticipants": 4
}
```

### **4. 🚪 Leave Conversation**

User tự rời khỏi group.

**Endpoint:** `POST /conversations/:conversationId/leave`

**Response:**
```typescript
{
  "success": true,
  "leftAt": "2025-08-16T16:00:00.000Z",
  "remainingParticipants": 3
}
```

---

## ⚠️ **Error Handling**

### **Common Error Responses**

```typescript
// 400 - Validation Error
{
  "statusCode": 400,
  "message": [
    "Group name cannot be empty",
    "Group must have at least 2 other participants"
  ],
  "error": "Bad Request"
}

// 403 - Insufficient Permissions
{
  "statusCode": 403,
  "message": "Only group admins can add participants",
  "error": "Forbidden"
}

// 404 - Not Found
{
  "statusCode": 404,
  "message": "Conversation not found",
  "error": "Not Found"
}

// 409 - Conflict
{
  "statusCode": 409,
  "message": "User is already a participant in this conversation",
  "error": "Conflict"
}
```

### **Error Handling trong Frontend**

```typescript
const handleApiError = (error: any) => {
  if (error.response) {
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        return `Validation error: ${Array.isArray(data.message) ? data.message.join(', ') : data.message}`;
      case 403:
        return 'You do not have permission to perform this action';
      case 404:
        return 'Conversation not found. It may have been deleted.';
      case 409:
        return 'This action conflicts with current state';
      default:
        return 'An unexpected error occurred';
    }
  }
  
  return 'Network error. Please check your connection.';
};
```

---

## 🎯 **Best Practices**

### **1. Mobile UX Optimization**

```typescript
// Prepare conversation ngay khi user click contact
const handleContactPress = async (contactId: string) => {
  // Show loading indicator
  setIsNavigating(true);
  
  try {
    // Prepare conversation first
    const conversationId = await prepareDirectConversation(contactId);
    
    // Navigate to chat screen
    navigation.navigate('Chat', { conversationId });
  } catch (error) {
    Alert.alert('Error', 'Cannot start conversation');
  } finally {
    setIsNavigating(false);
  }
};
```

### **2. Efficient List Loading**

```typescript
// Implement infinite scrolling
const loadMoreConversations = useCallback(async () => {
  if (!hasMore || isLoading) return;
  
  await conversationsService.getConversations({
    offset: nextOffset,
    limit: 20,
  });
}, [hasMore, isLoading, nextOffset]);
```

### **3. Real-time Updates**

```typescript
// Listen to WebSocket events for real-time updates
useEffect(() => {
  const handleNewMessage = (event: any) => {
    // Update conversation list with new last message
    dispatch({ 
      type: 'UPDATE_CONVERSATION', 
      payload: {
        id: event.conversationId,
        lastMessage: event.message,
        unreadCount: state.conversations.find(c => c.id === event.conversationId)?.unreadCount + 1
      }
    });
  };

  socket.on('message:new', handleNewMessage);
  return () => socket.off('message:new', handleNewMessage);
}, []);
```

### **4. Offline Support**

```typescript
// Cache conversations for offline access
const cacheConversations = async (conversations: ConversationListItem[]) => {
  try {
    await AsyncStorage.setItem(
      'cached_conversations',
      JSON.stringify(conversations)
    );
  } catch (error) {
    console.error('Failed to cache conversations:', error);
  }
};

// Load cached conversations when offline
const loadCachedConversations = async () => {
  try {
    const cached = await AsyncStorage.getItem('cached_conversations');
    if (cached) {
      dispatch({ 
        type: 'SET_CONVERSATIONS', 
        payload: { 
          conversations: JSON.parse(cached),
          hasMore: false,
          nextOffset: 0 
        }
      });
    }
  } catch (error) {
    console.error('Failed to load cached conversations:', error);
  }
};
```

---

## 🔧 **Testing**

### **Unit Tests Example**

```typescript
// __tests__/conversationsService.test.ts
import { conversationsService } from '../services/conversationsService';

describe('ConversationsService', () => {
  test('should prepare direct conversation', async () => {
    const response = await conversationsService.prepareDirectConversation('user123');
    
    expect(response.conversationId).toBeDefined();
    expect(response.participant).toHaveProperty('id', 'user123');
  });

  test('should create group conversation', async () => {
    const groupData = {
      name: 'Test Group',
      participantIds: ['user1', 'user2'],
    };
    
    const response = await conversationsService.createGroup(groupData);
    
    expect(response.conversation.name).toBe('Test Group');
    expect(response.conversation.participants).toHaveLength(3); // +creator
  });
});
```

### **Integration Tests**

```bash
# Test with Postman or curl
curl -X POST http://localhost:3000/conversations/create-direct \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"participantId": "64f1a2b3c4d5e6f7a8b9c0d1"}'
```

---

**🎉 Conversations API đã ready for production!** Frontend team có thể implement complete chat list và conversation management với documentation này.

Tiếp theo bạn muốn tôi tạo documentation cho module nào? **Messages**, **Files**, hay **Users**? 🚀
