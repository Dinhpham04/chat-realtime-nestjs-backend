# User Module Architecture - Mobile-First Chat Application

## 🏗️ **Modular Schema Design**

Theo nguyên tắc **Senior Developer** và **Clean Architecture**, User module được tách thành 4 schemas độc lập:

### **1. UserCore Schema** 📱
**Purpose**: Essential user data, identity, relationships
```typescript
// Core identity & profile
phoneNumber, email, username, fullName, bio, avatarUrl
// Account status
status, activityStatus, lastSeen  
// Relationships
friends[], blocked[]
// Basic verification
isPhoneVerified, isEmailVerified
```

### **2. UserDevice Schema** 🔌
**Purpose**: Minimal device info for push notifications
```typescript
// Device identification
deviceId, platform, appVersion
// Push notifications
pushToken, pushProvider
// Status
isActive, lastActiveAt
```

### **3. UserSettings Schema** ⚙️
**Purpose**: Backup of client settings for cross-device sync
```typescript
// Privacy (needed for server logic)
privacySettings: { profilePhoto, lastSeen, readReceipts, ... }
// Notifications (needed for push)
notificationSettings: { messageNotifications, quietHours, ... }
// App preferences (for sync)
appPreferences: { theme, fontSize, language }
```

### **4. UserSecurity Schema** 🔐
**Purpose**: Authentication, audit logs, security compliance
```typescript
// Authentication
refreshToken, twoFactorEnabled, twoFactorSecret
// Security monitoring
securityLogs[], failedLoginAttempts, lockedUntil
```

---

## 🎯 **Design Philosophy**

### **Server-Side (Minimal)**
- ✅ Essential user identity & relationships
- ✅ Privacy settings (needed for API logic)
- ✅ Push notification settings
- ✅ Security & audit logs
- ✅ Cross-device sync backup

### **Client-Side (Primary)**
- 📱 Real-time status (online/offline/typing)
- 📱 Device-specific settings (permissions, battery)
- 📱 UI preferences (detailed theme, sounds)
- 📱 Chat preferences (auto-download, gallery)
- 📱 Temporary state (current conversation, draft)

### **Redis Layer (Real-time)**
- ⚡ Online/offline status
- ⚡ Typing indicators
- ⚡ Active conversations
- ⚡ Presence information

---

## 📊 **Data Flow Strategy**

```
Client App     ←→     Redis      ←→     MongoDB
(Primary)           (Real-time)      (Persistence)
    ↓                   ↓               ↓
UI Settings         Online Status    User Identity
Device State        Typing           Relationships
Temp Data          Presence         Settings Backup
Local Cache        Sessions         Security Logs
```

### **Performance Benefits**
1. **Reduced DB Load**: 80% data managed locally
2. **Faster Response**: Real-time via Redis, not DB queries
3. **Better UX**: Instant settings changes, offline-first
4. **Scalability**: Each schema can become microservice

### **Mobile-First Benefits**
1. **Offline Support**: Settings cached locally
2. **Battery Efficient**: Minimal server sync
3. **Network Optimized**: Only essential data transferred
4. **Multi-Device**: Settings sync when needed

---

## 🔄 **Migration Strategy**

### **Phase 1**: Create new schemas (✅ Done)
### **Phase 2**: Dual-write (old + new schemas)
### **Phase 3**: Update services to use new schemas
### **Phase 4**: Migrate existing data
### **Phase 5**: Remove old monolithic schema

---

## 🚀 **Next Steps**

1. **Create Services** for each schema
2. **Setup Redis** for real-time state
3. **Update Controllers** to use modular approach
4. **Add Migration Scripts** for existing data
5. **Implement Client SDK** for local settings management

---

## 📝 **Schema Relationships**

```
UserCore (1) ←→ (N) UserDevice
UserCore (1) ←→ (1) UserSettings  
UserCore (1) ←→ (1) UserSecurity
```

**Benefits of this design:**
- ✅ **SOLID Principles**: Single responsibility per schema
- ✅ **Performance**: Minimal data per query
- ✅ **Scalability**: Each schema can scale independently  
- ✅ **Maintainability**: Clear separation of concerns
- ✅ **Mobile-Optimized**: Client-first approach
- ✅ **Cost-Effective**: Reduced server resources
