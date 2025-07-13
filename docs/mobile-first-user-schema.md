# 📱 Mobile-First User Schema Guide

## 🎯 **Mobile-First Design Decisions**

### **1. Phone Number as Primary Identifier**
- `phoneNumber` là **required** field thay vì email
- Giống WhatsApp/Telegram model
- Hỗ trợ OTP verification process

### **2. Optional Email & Username**
- Email không bắt buộc (có thể null)
- Username có thể được tạo sau
- Passwordless authentication qua SMS/OTP

### **3. Mobile-Optimized Features**

#### **Contact Discovery**
```typescript
phoneContacts: Array<{
  phoneNumber: string;
  name: string;
  isRegistered: boolean; // User đã có account chưa
  userId?: ObjectId;     // Link tới user nếu đã đăng ký
  addedAt: Date;
}>
```

#### **Mobile Device Management**
```typescript
mobileDevices: Array<{
  platform: 'ios' | 'android';
  osVersion: string;        // iOS 15.0, Android 12
  deviceModel: string;      // iPhone 13, Samsung Galaxy S21
  pushToken: string;        // FCM/APNS token
  pushProvider: 'fcm' | 'apns';
  appState: 'foreground' | 'background' | 'killed';
  networkType: 'wifi' | '4g' | '5g' | '3g' | 'offline';
  batteryLevel: number;     // 0-100
  permissions: {
    camera: boolean;
    microphone: boolean;
    location: boolean;
    contacts: boolean;
    notifications: boolean;
  };
}>
```

#### **Mobile App Preferences**
```typescript
appPreferences: {
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  enterToSend: boolean;
  saveToGallery: boolean;
  autoDownloadPhotos: boolean;
  lowDataMode: boolean;
}
```

#### **Mobile Notifications**
```typescript
mobileNotificationSettings: {
  quietHoursEnabled: boolean;
  quietHoursStart: string;    // "22:00"
  quietHoursEnd: string;      // "08:00"
  inAppSounds: boolean;
  inAppVibration: boolean;
  notificationLED: boolean;
  lowPowerMode: boolean;
}
```

---

## 🚀 **Mobile Authentication Flow**

### **1. Phone Registration (WhatsApp Style)**
```typescript
// Step 1: User enters phone number
POST /auth/register/phone
{
  "phoneNumber": "+1234567890"
}

// Step 2: Server sends OTP via SMS
// Step 3: User enters OTP
POST /auth/verify/phone
{
  "phoneNumber": "+1234567890",
  "code": "123456"
}

// Step 4: User profile setup (optional)
POST /auth/setup/profile
{
  "fullName": "John Doe",
  "username": "johndoe" // optional
}
```

### **2. Contact Sync**
```typescript
POST /users/sync-contacts
{
  "contacts": [
    {
      "phoneNumber": "+1234567891",
      "name": "Alice Smith"
    },
    {
      "phoneNumber": "+1234567892", 
      "name": "Bob Johnson"
    }
  ]
}
```

### **3. Device Registration**
```typescript
POST /users/register-device
{
  "deviceId": "unique-device-id",
  "platform": "ios",
  "osVersion": "15.0",
  "deviceModel": "iPhone 13",
  "appVersion": "1.0.0",
  "pushToken": "fcm-or-apns-token"
}
```

---

## 📊 **Database Indexes for Mobile Performance**

```typescript
// Primary mobile indexes
{ phoneNumber: 1 }                           // Fastest user lookup
{ 'phoneContacts.phoneNumber': 1 }          // Contact discovery
{ 'mobileDevices.pushToken': 1 }            // Push notifications
{ 'lastKnownLocation.latitude': 1, 'lastKnownLocation.longitude': 1 } // Location features

// Optional indexes (sparse for performance)
{ email: 1 }     // Sparse index (since email is optional)
{ username: 1 }  // Sparse index (since username is optional)
```

---

## 🎮 **Mobile-Specific Use Cases**

### **1. Contact Discovery (WhatsApp Style)**
- Import phone contacts
- Check which contacts have accounts
- Auto-friend registered contacts
- Invite non-registered contacts

### **2. Multi-Device Support**
- Sync messages across devices
- Device management
- Push token management
- Session management

### **3. Mobile Notifications**
- Smart notification batching
- Quiet hours
- Battery optimization
- Network-aware notifications

### **4. Offline Support**
- Cache user data
- Queue messages when offline
- Sync when online
- Background app refresh

### **5. Location Features** (Optional)
- "People Nearby"
- Location sharing in chats
- Privacy controls

---

## 📱 **Mobile Development Priorities**

### **Phase 1: Core Mobile Features**
1. ✅ Phone-based registration
2. ✅ Contact sync & discovery
3. ✅ Push notifications
4. ✅ Device management
5. ✅ Mobile app preferences

### **Phase 2: Advanced Mobile Features**
1. 🔄 Location sharing
2. 🔄 Multi-device sync
3. 🔄 Smart notifications
4. 🔄 Offline support
5. 🔄 Data usage optimization

### **Phase 3: Mobile Platform Integration**
1. 🔄 iOS/Android specific features
2. 🔄 Platform permissions
3. 🔄 Deep linking
4. 🔄 App shortcuts
5. 🔄 Widget support

---

## 🔧 **Implementation Tips**

### **1. Phone Number Validation**
```typescript
// Use libphonenumber for robust validation
import { parsePhoneNumber } from 'libphonenumber-js';

const validatePhone = (phone: string) => {
  try {
    const phoneNumber = parsePhoneNumber(phone);
    return phoneNumber.isValid();
  } catch {
    return false;
  }
};
```

### **2. Contact Sync Optimization**
```typescript
// Batch process contacts
const BATCH_SIZE = 100;
const syncContacts = async (contacts: Contact[]) => {
  const batches = chunk(contacts, BATCH_SIZE);
  for (const batch of batches) {
    await processContactBatch(batch);
  }
};
```

### **3. Push Token Management**
```typescript
// Handle push token updates
const updatePushToken = async (userId: string, deviceId: string, newToken: string) => {
  await UserModel.updateOne(
    { _id: userId, 'mobileDevices.deviceId': deviceId },
    { 
      $set: { 
        'mobileDevices.$.pushToken': newToken,
        'mobileDevices.$.lastActiveAt': new Date()
      }
    }
  );
};
```

---

## ✅ **Key Benefits of Mobile-First Schema**

1. **Fast Contact Discovery**: Phone-based lookup
2. **WhatsApp-like UX**: Familiar registration flow
3. **Optimized Notifications**: Mobile-specific settings
4. **Multi-Device Ready**: Device management built-in
5. **Battery Friendly**: Low power mode support
6. **Network Aware**: Data usage optimization
7. **Platform Native**: iOS/Android specific features

**Kết luận**: Schema này được tối ưu hoàn toàn cho mobile messaging app như WhatsApp/Telegram, với phone number làm primary identifier và đầy đủ mobile-specific features!
