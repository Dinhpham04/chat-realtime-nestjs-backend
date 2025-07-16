# 🤝 User Friends Module - MongoDB + Redis Architecture Plan

## 📋 **Project Overview**

**Module:** User Friends Management System  
**Tech Stack:** NestJS + MongoDB + Redis  
**Architecture:** Clean Architecture với mobile-first approach  
**Timeline:** 3 tuần (MVP)  
**Team Size:** 1-2 developers  

---

## 🎯 **1. Requirements Analysis (Mobile-First Approach)**

### **Core User Stories (WhatsApp Style):**
```typescript
interface MobileFriendFeatures {
  contactSync: "Import phone contacts và auto-friend registered users";
  friendRequest: "Send/receive friend requests via phone number";
  quickAdd: "Add friends by QR code hoặc username";
  mutualFriends: "Show mutual friends count";
  nearbyUsers: "People nearby feature (optional)";
  blockSystem: "Block/unblock users with privacy";
  friendsList: "Fast, cached friends list với online status";
}
```

### **Mobile-Specific Edge Cases:**
```typescript
interface MobileEdgeCases {
  contactPermission: "User từ chối permission contact access";
  networkInterruption: "Friend request gửi lúc offline";
  multiDevice: "Sync friend status across devices";
  phoneNumberChange: "User đổi số điện thoại";
  accountMerging: "Merge accounts khi link social";
  bulkContactImport: "Import 5000+ contacts cùng lúc";
  spamPrevention: "Prevent mass friend request spam";
}
```

---

## 🗄️ **2. MongoDB Schema Design**

### **Friends Collection Structure:**
```typescript
// collections/user-friends.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserFriendDocument = UserFriend & Document;

@Schema({
  timestamps: true,
  collection: 'user_friends',
})
export class UserFriend {
  @Prop({
    type: Types.ObjectId,
    ref: 'UserCore',
    required: true,
    index: true
  })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'UserCore', 
    required: true,
    index: true
  })
  friendId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['pending', 'accepted', 'declined', 'blocked'],
    default: 'pending',
    index: true
  })
  status: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'UserCore',
    required: true
  })
  requestedBy: Types.ObjectId; // Who initiated the relationship

  @Prop({
    maxlength: 500,
    default: null
  })
  requestMessage?: string;

  @Prop({
    maxlength: 1000,
    default: null  
  })
  declineReason?: string;

  @Prop({
    default: Date.now
  })
  acceptedAt?: Date;

  @Prop({
    default: Date.now
  })
  blockedAt?: Date;

  // Mobile-specific fields
  @Prop({
    default: 'manual' // 'manual', 'contact_sync', 'suggestion', 'qr_code'
  })
  addMethod: string;

  @Prop({
    default: null
  })
  mutualFriendsCount?: number; // Cache for performance

  // Soft delete
  @Prop({
    default: false
  })
  isDeleted: boolean;
}

export const UserFriendSchema = SchemaFactory.createForClass(UserFriend);

// Compound indexes for performance
UserFriendSchema.index({ userId: 1, status: 1 });
UserFriendSchema.index({ friendId: 1, status: 1 });
UserFriendSchema.index({ userId: 1, friendId: 1 }, { unique: true });
UserFriendSchema.index({ requestedBy: 1, createdAt: -1 });
UserFriendSchema.index({ status: 1, createdAt: -1 });
```

### **Contact Sync Collection:**
```typescript
// collections/user-contacts.schema.ts
@Schema({
  timestamps: true,
  collection: 'user_contacts',
})
export class UserContact {
  @Prop({
    type: Types.ObjectId,
    ref: 'UserCore',
    required: true,
    index: true
  })
  userId: Types.ObjectId;

  @Prop({
    required: true,
    match: /^\+?[1-9]\d{1,14}$/ // E.164 format
  })
  phoneNumber: string;

  @Prop({
    required: true,
    maxlength: 100
  })
  contactName: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'UserCore',
    default: null
  })
  registeredUserId?: Types.ObjectId; // Nếu contact đã có account

  @Prop({
    default: false
  })
  isInvited: boolean;

  @Prop({
    default: null
  })
  invitedAt?: Date;

  @Prop({
    default: false
  })
  autoFriended: boolean; // Auto-friend when contact registers
}

export const UserContactSchema = SchemaFactory.createForClass(UserContact);

// Indexes
UserContactSchema.index({ userId: 1 });
UserContactSchema.index({ phoneNumber: 1 });
UserContactSchema.index({ userId: 1, phoneNumber: 1 }, { unique: true });
UserContactSchema.index({ registeredUserId: 1 }, { sparse: true });
```

---

## ⚡ **3. Redis Caching Strategy**

### **Friend Status Cache:**
```typescript
interface RedisCacheKeys {
  userFriendsList: `friends:${userId}:list`; // 2h TTL
  friendRequestsIncoming: `friends:${userId}:requests:in`; // 1h TTL  
  friendRequestsOutgoing: `friends:${userId}:requests:out`; // 1h TTL
  blockedUsers: `friends:${userId}:blocked`; // 4h TTL
  onlineFriends: `friends:${userId}:online`; // 15min TTL
  mutualFriends: `friends:${userId1}:${userId2}:mutual`; // 24h TTL
  friendSuggestions: `friends:${userId}:suggestions`; // 6h TTL
}

interface RedisDataStructures {
  friendsList: 'ZSET'; // Score = last interaction timestamp
  onlineStatus: 'SET'; // Fast O(1) lookup
  requestCounts: 'HASH'; // incoming, outgoing, blocked counts
  recentActivity: 'LIST'; // Last 100 friend activities
}
```

### **Real-time Friend Status:**
```typescript
// Redis Service for Friend Status
export class FriendStatusService {
  async setUserOnline(userId: string): Promise<void> {
    // Update user's online status
    await this.redis.set(`user:${userId}:online`, 'true', 'EX', 900); // 15min
    
    // Notify all friends that user is online
    const friends = await this.getFriendsList(userId);
    for (const friendId of friends) {
      await this.redis.sadd(`friends:${friendId}:online`, userId);
    }
  }

  async getUserOnlineFriends(userId: string): Promise<string[]> {
    return this.redis.smembers(`friends:${userId}:online`);
  }

  async updateFriendActivity(userId: string, friendId: string): Promise<void> {
    // Update last interaction time
    const timestamp = Date.now();
    await this.redis.zadd(`friends:${userId}:list`, timestamp, friendId);
  }
}
```

---

## 🏛️ **4. Clean Architecture Implementation**

### **Module Structure:**
```typescript
// src/modules/friends/
interface FriendsModuleStructure {
  controllers: {
    'friends.controller.ts': 'Main friends CRUD operations';
    'friend-requests.controller.ts': 'Friend request lifecycle';
    'contact-sync.controller.ts': 'Contact import and sync';
    'friend-suggestions.controller.ts': 'Friend discovery features';
  };
  
  services: {
    'friends.service.ts': 'Core friendship business logic';
    'friend-requests.service.ts': 'Request management';
    'contact-sync.service.ts': 'Phone contact integration';
    'friend-suggestions.service.ts': 'ML-based suggestions';
    'friend-status.service.ts': 'Real-time status management';
  };
  
  repositories: {
    'user-friends.repository.ts': 'MongoDB friendship data access';
    'user-contacts.repository.ts': 'Contact sync data access';
    'friend-cache.repository.ts': 'Redis cache operations';
  };
  
  schemas: {
    'user-friends.schema.ts': 'MongoDB friendship model';
    'user-contacts.schema.ts': 'Contact sync model';
  };
  
  dto: {
    'send-friend-request.dto.ts': 'Friend request validation';
    'contact-sync.dto.ts': 'Contact import validation';
    'friend-search.dto.ts': 'Search parameters';
  };
}
```

### **Service Layer Design (Interface-First):**
```typescript
// interfaces/friends.interfaces.ts
export interface IFriendsService {
  getFriendsList(userId: string, options: FriendListOptions): Promise<FriendListResult>;
  sendFriendRequest(senderId: string, receiverId: string, message?: string): Promise<FriendRequest>;
  acceptFriendRequest(requestId: string, userId: string): Promise<void>;
  removeFriend(userId: string, friendId: string): Promise<void>;
  blockUser(blockerId: string, targetId: string, reason?: string): Promise<void>;
}

export interface IContactSyncService {
  importContacts(userId: string, contacts: ContactImport[]): Promise<ContactSyncResult>;
  findRegisteredContacts(phoneNumbers: string[]): Promise<RegisteredContact[]>;
  sendInviteToContact(userId: string, phoneNumber: string): Promise<void>;
}

export interface IFriendSuggestionsService {
  getMutualFriendsSuggestions(userId: string): Promise<UserSuggestion[]>;
  getContactBasedSuggestions(userId: string): Promise<UserSuggestion[]>;
  getNearbyUsersSuggestions(userId: string, location: Location): Promise<UserSuggestion[]>;
}
```

---

## 📊 **5. API Design (Mobile-Optimized)**

### **RESTful Endpoints:**
```typescript
interface FriendsAPIEndpoints {
  // Contact Sync (Mobile Priority)
  'POST /friends/contacts/sync': {
    body: { contacts: ContactImport[]; includeInvites: boolean };
    response: { registered: RegisteredContact[]; invited: InvitedContact[] };
  };
  
  'GET /friends/contacts/registered': {
    query: { phoneNumbers: string[] };
    response: { users: PublicUserProfile[] };
  };
  
  // Friend Requests
  'POST /friends/requests': {
    body: { targetId?: string; phoneNumber?: string; message?: string };
    response: { requestId: string; status: 'sent' | 'auto_accepted' };
  };
  
  'GET /friends/requests': {
    query: { type: 'incoming' | 'outgoing'; page: number; limit: number };
    response: { requests: FriendRequestSummary[]; pagination: PaginationMeta };
  };
  
  'PUT /friends/requests/:id/accept': {
    response: { friendship: FriendshipDetails; mutualFriends: UserSummary[] };
  };
  
  'PUT /friends/requests/:id/decline': {
    body: { reason?: string };
    response: { status: 'declined' };
  };
  
  // Friends Management
  'GET /friends': {
    query: { 
      status?: 'online' | 'all'; 
      search?: string; 
      sortBy?: 'recent' | 'name' | 'mutual';
      page: number; 
      limit: number;
    };
    response: { 
      friends: FriendWithStatus[]; 
      onlineCount: number;
      pagination: PaginationMeta;
    };
  };
  
  'DELETE /friends/:id': {
    response: { status: 'removed' };
  };
  
  // Blocking System
  'POST /friends/block': {
    body: { targetId: string; reason?: string };
    response: { status: 'blocked' };
  };
  
  'GET /friends/blocked': {
    response: { blockedUsers: BlockedUserSummary[] };
  };
  
  // Discovery & Suggestions
  'GET /friends/suggestions': {
    query: { type?: 'mutual' | 'contacts' | 'nearby'; limit: number };
    response: { suggestions: UserSuggestion[] };
  };
  
  'GET /friends/search': {
    query: { q: string; type: 'username' | 'phone' | 'name' };
    response: { users: UserSearchResult[] };
  };
  
  // QR Code Feature (Mobile)
  'GET /friends/qr-code': {
    response: { qrCode: string; expiresAt: string };
  };
  
  'POST /friends/qr-scan': {
    body: { qrCode: string };
    response: { user: UserProfile; requestSent: boolean };
  };
}
```

### **Mobile-Specific Response Models:**
```typescript
interface MobileResponseModels {
  FriendWithStatus: {
    id: string;
    user: UserSummary;
    isOnline: boolean;
    lastSeen?: string;
    lastInteraction?: string;
    mutualFriendsCount: number;
    addMethod: 'manual' | 'contact_sync' | 'suggestion';
    friendedAt: string;
  };
  
  ContactSyncResult: {
    imported: number;
    registered: RegisteredContact[];
    invited: InvitedContact[];
    alreadyFriends: UserSummary[];
    duplicates: number;
  };
  
  UserSuggestion: {
    id: string;
    user: UserSummary;
    reason: 'mutual_friends' | 'contact_sync' | 'nearby' | 'similar_interests';
    mutualFriendsCount: number;
    mutualFriends: UserSummary[]; // Top 3 for display
    score: number; // Suggestion relevance score
  };
}
```

---

## 🔒 **6. Security & Performance (Mobile-First)**

### **Security Measures:**
```typescript
interface MobileFriendsSecurity {
  rateLimiting: {
    friendRequests: '20 per user per hour';
    contactSync: '3 syncs per user per day';
    phoneNumberLookup: '100 per user per hour';
    blockActions: '10 per user per day';
  };
  
  privacyControls: {
    phoneDiscovery: 'Allow/prevent discovery by phone number';
    mutualFriendsVisibility: 'Show/hide mutual friends count';
    onlineStatusVisibility: 'Friends only / Friends of friends / Everyone';
    contactSyncOptOut: 'Users can opt-out of being found via contacts';
  };
  
  spamPrevention: {
    bulkRequestDetection: 'Flag users sending >50 requests/day';
    suspiciousPatternDetection: 'High decline rate patterns';
    phoneNumberValidation: 'Real phone number verification';
    deviceFingerprinting: 'Detect fake/bot accounts';
  };
  
  dataProtection: {
    contactDataEncryption: 'Encrypt imported contact data';
    phoneNumberHashing: 'Hash phone numbers for lookup';
    dataRetention: 'Auto-delete declined requests after 90 days';
    gdprCompliance: 'Right to be forgotten implementation';
  };
}
```

### **Performance Optimizations:**
```typescript
interface PerformanceStrategy {
  mongoOptimizations: {
    indexes: [
      '{ userId: 1, status: 1, createdAt: -1 }', // Friend list queries
      '{ friendId: 1, status: 1 }', // Reverse lookups
      '{ phoneNumber: 1 }', // Contact discovery
      '{ registeredUserId: 1 }' // Contact-to-user mapping
    ];
    aggregationPipelines: 'Optimized for mutual friends calculation';
    readPreference: 'secondary for analytics queries';
  };
  
  redisOptimizations: {
    pipelining: 'Batch Redis operations for friend status updates';
    luaScripts: 'Atomic operations for complex friend state changes';
    keyExpiration: 'Smart TTL based on user activity patterns';
    compression: 'Compress large friend lists in cache';
  };
  
  mobileOptimizations: {
    deltaSync: 'Only sync changed friend data to mobile';
    backgroundSync: 'Update friend status when app backgrounded';
    connectionPooling: 'Optimize for mobile network patterns';
    responseCompression: 'Gzip responses for mobile data savings';
  };
}
```

---

## 🧪 **7. Testing Strategy**

### **Mobile-Focused Testing:**
```typescript
interface MobileTestingApproach {
  unitTests: {
    contactSyncLogic: 'Test contact import/mapping logic';
    friendSuggestionAlgorithm: 'Test mutual friend calculations';
    privacyControls: 'Test visibility settings enforcement';
    cacheInvalidation: 'Test Redis cache consistency';
  };
  
  integrationTests: {
    mongoRedisConsistency: 'Test data sync between MongoDB and Redis';
    phoneNumberLookup: 'Test contact discovery pipeline';
    realTimeUpdates: 'Test friend status real-time updates';
    bulkOperations: 'Test contact sync performance';
  };
  
  mobileE2ETests: {
    contactPermissionFlow: 'Test contact access permission handling';
    offlineToOnlineSync: 'Test friend data sync after network restoration';
    multiDeviceConsistency: 'Test friend status across devices';
    backgroundAppRefresh: 'Test background friend status updates';
  };
  
  performanceTests: {
    largeFriendsList: 'Test with 5000+ friends';
    bulkContactImport: 'Test importing 10,000+ contacts';
    concurrentRequests: 'Test 1000+ concurrent friend requests';
    cacheHitRate: 'Measure Redis cache effectiveness';
  };
}
```

---

## 📋 **8. Implementation Phases**

### **Phase 1: MVP Core (2 tuần)**
```typescript
interface MVPPhase {
  week1: {
    database: [
      'Create UserFriend và UserContact schemas',
      'Setup MongoDB indexes và constraints',
      'Create basic repository layer',
      'Setup Redis connection và basic caching'
    ];
    
    services: [
      'Implement basic FriendsService với CRUD operations',
      'Create FriendRequestsService cho request lifecycle',
      'Basic ContactSyncService cho phone number lookup',
      'Redis caching cho friend lists'
    ];
  };
  
  week2: {
    api: [
      'Friends CRUD REST endpoints',
      'Friend requests endpoints',
      'Basic contact sync endpoint',
      'Friend search functionality'
    ];
    
    features: [
      'Send/accept/decline friend requests',
      'View friends list với online status',
      'Basic contact import (phone numbers)',
      'Block/unblock users'
    ];
  };
  
  deliverable: 'Working friend system với basic mobile features';
}
```

### **Phase 2: Mobile Enhancement (1 tuần)**
```typescript
interface MobilePhase {
  week3: {
    advanced: [
      'QR code friend adding',
      'Friend suggestions algorithm',
      'Real-time friend status updates',
      'Contact sync optimization'
    ];
    
    performance: [
      'Redis pipeline optimizations',
      'MongoDB aggregation for mutual friends',
      'Delta sync for mobile clients',
      'Background friend status updates'
    ];
  };
  
  deliverable: 'Production-ready friends module với mobile optimizations';
}
```

---

## 🎯 **9. Success Metrics & KPIs**

### **Performance Targets:**
```typescript
interface PerformanceTargets {
  responseTime: {
    friendsList: '< 150ms for 1000 friends';
    friendRequest: '< 100ms for send/accept';
    contactSync: '< 2s for 1000 contacts';
    friendSearch: '< 300ms for username search';
  };
  
  throughput: {
    concurrentUsers: '10,000 concurrent friend operations';
    friendRequests: '1000 requests/second sustained';
    contactSyncs: '100 bulk syncs/second';
  };
  
  cacheEfficiency: {
    friendListCacheHit: '> 85%';
    onlineStatusCacheHit: '> 95%';
    mutualFriendsCacheHit: '> 70%';
  };
  
  mobileMetrics: {
    backgroundSyncSuccess: '> 99%';
    offlineDataAvailability: '> 95%';
    batteryImpact: '< 2% per day';
  };
}
```

---

## 🚀 **MVP Phase Recommendation**

### **Đề Xuất Phase MVP (3 tuần):**

#### **Tuần 1: Foundation Setup**
- ✅ Setup MongoDB schemas (UserFriend, UserContact)
- ✅ Basic Redis caching infrastructure
- ✅ Core repository pattern implementation
- ✅ Unit tests cho business logic

#### **Tuần 2: Core Friend Features**
- ✅ Friend request lifecycle (send/accept/decline)
- ✅ Friends list với basic search
- ✅ Block/unblock functionality  
- ✅ Basic contact phone number lookup
- ✅ REST API endpoints

#### **Tuần 3: Mobile Optimization**
- ✅ Contact sync implementation
- ✅ Friend suggestions (mutual friends)
- ✅ Real-time friend status với Redis
- ✅ Performance optimization và caching
- ✅ Mobile-optimized responses

### **MVP Success Criteria:**
```typescript
interface MVPSuccessCriteria {
  functionality: [
    'Users có thể send/receive friend requests',
    'Users có thể import contacts và auto-friend',
    'Real-time friend online status',
    'Fast friends list với search',
    'Block system hoạt động đúng'
  ];
  
  performance: [
    'Friend list load < 200ms',
    'Contact sync < 3s for 1000 contacts',
    'Support 1000+ concurrent users',
    'Redis cache hit rate > 80%'
  ];
  
  mobile: [
    'Contact permission handling',
    'Offline-friendly friend data',
    'Background status updates',
    'Optimized for mobile data usage'
  ];
}
```

### **Post-MVP Enhancements:**
- QR code friend adding
- Location-based friend suggestions  
- Advanced privacy controls
- Friend activity timeline
- Group invitation via friends

---

## 📚 **Documentation Requirements**

### **API Documentation:**
- Complete Swagger specification với decorators
- Postman collection cho testing
- Mobile SDK integration guide
- Error codes và handling guide

### **Technical Documentation:**
- Architecture decision records (ADRs)
- Database schema và relationship diagrams
- Redis caching strategy documentation
- Performance optimization guide

### **Operational Documentation:**
- Deployment và configuration guide
- Monitoring và alerting setup
- Troubleshooting common issues
- Data migration scripts

---

**Timeline:** 3 tuần MVP + 2 tuần enhancements  
**Team:** 1-2 developers  
**Priority:** Speed to market với scalable foundation  
**Success:** Production-ready friends system cho mobile messaging app

Kế hoạch này tuân thủ Senior Developer principles với focus on Clean Architecture, Security First, và Mobile-First approach.
