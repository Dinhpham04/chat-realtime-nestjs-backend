# Friends Module - MVP Architecture

## 🎯 **Overview**

**Purpose:** Friend management system cho mobile messaging app  
**Architecture:** Clean Architecture với mobile-first approach  
**Phase:** MVP - Essential features only  
**Timeline:** Week 1 foundation setup

---

## 🏗️ **Module Structure**

```
src/modules/friends/
├── schemas/
│   ├── user-friend.schema.ts    # Core friendship relationships
│   ├── user-contact.schema.ts   # Contact sync & discovery
│   └── index.ts                 # Schema exports
├── repositories/
│   ├── user-friend.repository.ts # ✅ Friend data access layer
│   ├── user-contact.repository.ts # ✅ Contact data access layer
│   └── index.ts                 # Repository exports
├── types/
│   └── index.ts                 # TypeScript interfaces & enums
├── friends.module.ts            # Module configuration
└── README.md                    # This file
```

### **Next Steps (Week 1):**
```
TODO:
├── services/
│   ├── friends.service.ts       # 🔄 NEXT: Business logic layer
│   └── contact-sync.service.ts  # 🔄 NEXT: Contact sync logic
├── controllers/
│   ├── friends.controller.ts
│   └── contact-sync.controller.ts
└── dto/
    ├── send-friend-request.dto.ts
    └── contact-sync.dto.ts
```

---

## 📋 **MVP Features Implemented**

### ✅ **Completed:**
- [x] **UserFriend Schema** - Core friendship model
- [x] **UserContact Schema** - Contact sync model  
- [x] **TypeScript Interfaces** - Type safety
- [x] **Module Setup** - Basic structure
- [x] **UserFriendRepository** - Friend data access layer
- [x] **UserContactRepository** - Contact data access layer

### 🔄 **Next Phase:**
- [ ] **Service Layer** - Business logic (🎯 CURRENT FOCUS)
- [ ] **Controller Layer** - REST API endpoints
- [ ] **DTO Validation** - Input validation
- [ ] **Unit Tests** - Test coverage

---

## 🗄️ **Database Schema Design**

### **UserFriend Schema**
```typescript
{
  userId: ObjectId,           // Friend relationship owner
  friendId: ObjectId,         // The friend
  status: enum,              // pending, accepted, declined, blocked
  requestedBy: ObjectId,     // Who initiated
  requestMessage?: string,   // Optional message
  acceptedAt?: Date,         // Timeline tracking
  addMethod: enum,           // manual, contact_sync, etc.
  mutualFriendsCount?: number, // Performance cache
  lastInteractionAt?: Date,  // For sorting
  isDeleted: boolean        // Soft delete
}
```

### **UserContact Schema**
```typescript
{
  userId: ObjectId,              // Who imported contact
  phoneNumber: string,           // E.164 format
  contactName: string,           // Name from phone
  registeredUserId?: ObjectId,   // If contact has account
  isRegistered: boolean,         // Registration status
  autoFriendWhenRegisters: boolean, // Auto-friend setting
  autoFriended: boolean,         // Already auto-friended
  contactSource: enum,           // phonebook, gmail, etc.
  lastSyncAt: Date,             // Last import time
  isDeleted: boolean            // Soft delete
}
```

---

## 🎯 **Design Principles**

### **Mobile-First Approach:**
- ✅ **Fast Queries** - Optimized indexes cho mobile performance
- ✅ **Offline Support** - Data structure supports caching
- ✅ **Bandwidth Optimization** - Minimal payload sizes
- ✅ **Battery Efficiency** - Reduced server roundtrips

### **Clean Architecture:**
- ✅ **Separation of Concerns** - Each layer has single responsibility
- ✅ **Interface-First** - Abstract dependencies
- ✅ **Testable** - Mockable dependencies
- ✅ **Scalable** - Can split into microservices later

### **MVP Philosophy:**
- ✅ **Simple & Fast** - Essential features only
- ✅ **Iterative** - Build -> Test -> Improve
- ✅ **User-Focused** - Solve real mobile pain points
- ✅ **Production-Ready** - Scalable foundation

---

## 📊 **Performance Considerations**

### **MongoDB Indexes:**
```typescript
// Essential indexes for MVP
{ userId: 1, status: 1 }           // Friend list queries
{ friendId: 1, status: 1 }         // Reverse friend lookups  
{ userId: 1, friendId: 1 }         // Unique constraint
{ phoneNumber: 1 }                 // Contact discovery
{ registeredUserId: 1 }            // Contact-to-user mapping
```

### **Query Patterns:**
- **Friend List:** Fast pagination với proper sorting
- **Contact Sync:** Bulk operations cho 1000+ contacts
- **Friend Status:** Real-time updates via Redis cache
- **Search:** Efficient text search across names/usernames

---

## 🔗 **Integration Points**

### **Dependencies:**
- **UserCore Schema** - References user profiles
- **Redis Module** - Caching friend status
- **Database Module** - MongoDB connection

### **Exports:**
- **Schemas** - For other modules to reference
- **Services** - Business logic for other features
- **Types** - TypeScript interfaces for consistency

---

## 🚀 **Next Implementation Steps**

### **Day 1-2: Repository Layer**
```bash
# Create data access repositories
touch repositories/user-friend.repository.ts
touch repositories/user-contact.repository.ts
touch repositories/index.ts
```

### **Day 3-4: Service Layer**
```bash
# Create business logic services  
touch services/friends.service.ts
touch services/contact-sync.service.ts
touch services/index.ts
```

### **Day 5: Controller Layer**
```bash
# Create REST API controllers
touch controllers/friends.controller.ts
touch controllers/contact-sync.controller.ts
touch controllers/index.ts
```

---

## 📝 **API Design Preview**

### **Core Endpoints:**
```typescript
POST   /friends/requests        # Send friend request
GET    /friends/requests        # Get pending requests
PUT    /friends/requests/:id    # Accept/decline request
GET    /friends                 # Get friends list
DELETE /friends/:id             # Remove friend
POST   /friends/block           # Block user
POST   /friends/contacts/sync   # Import contacts
GET    /friends/search          # Search users
```

### **Mobile Response Example:**
```json
{
  "friends": [
    {
      "id": "friend123",
      "user": {
        "id": "user456",
        "fullName": "John Doe",
        "username": "johndoe",
        "avatarUrl": "https://...",
        "isOnline": true
      },
      "addMethod": "contact_sync",
      "friendedAt": "2025-07-16T10:00:00Z",
      "lastInteraction": "2025-07-16T09:30:00Z",
      "mutualFriendsCount": 5
    }
  ],
  "onlineCount": 12,
  "pagination": { "page": 1, "total": 50 }
}
```

---

**Status:** 🟢 Foundation Complete - Ready for Repository Implementation  
**Next:** Create UserFriendRepository với basic CRUD operations
