# Auth Module Phase 1 (MVP) - Architecture & Implementation Plan

## 📋 **Scope Overview**
- Phone + Password authentication (primary)
- JWT with configurable TTL (access + refresh tokens)
- Device registration with 5 device limit
- Auto-login with stored refresh token
- Basic Google social login integration

## 🏗️ **Module Structure**
```
src/modules/auth/
├── controllers/
│   ├── auth.controller.ts           # Main auth endpoints
│   └── social-auth.controller.ts    # Social login endpoints
├── services/
│   ├── auth.service.ts              # Core authentication logic
│   ├── device.service.ts            # Device management
│   ├── token.service.ts             # JWT token management
│   └── social-auth.service.ts       # Google OAuth integration
├── guards/
│   ├── jwt-auth.guard.ts            # JWT authentication guard
│   ├── refresh-token.guard.ts       # Refresh token validation
│   └── device-limit.guard.ts        # Device limit enforcement
├── strategies/
│   ├── jwt.strategy.ts              # JWT validation strategy
│   ├── refresh-jwt.strategy.ts      # Refresh token strategy
│   └── google.strategy.ts           # Google OAuth strategy
├── dto/
│   ├── login.dto.ts                 # Login request validation
│   ├── register.dto.ts              # Registration validation
│   ├── refresh-token.dto.ts         # Token refresh validation
│   └── social-login.dto.ts          # Social auth validation
├── interfaces/
│   ├── auth.interfaces.ts           # Auth-related interfaces
│   └── jwt-payload.interface.ts     # JWT payload structure
├── decorators/
│   ├── current-user.decorator.ts    # Extract current user
│   └── device-info.decorator.ts     # Extract device info
└── auth.module.ts                   # Module configuration
```

## 🔐 **Authentication Flow Design**

### **A. Phone + Password Authentication**

#### **Registration Flow:**
1. **Input Validation** → Phone format, password strength
2. **Phone Uniqueness Check** → Prevent duplicate accounts
3. **Password Hashing** → bcrypt with salt rounds
4. **User Creation** → Store in user-security collection
5. **Device Registration** → Register first device
6. **Token Generation** → Access + Refresh tokens
7. **Response** → User info + tokens + device info

#### **Login Flow:**
1. **Input Validation** → Phone + password format
2. **User Lookup** → Find by phone number
3. **Password Verification** → Compare hashed password
4. **Device Check** → Verify device limit (5 max)
5. **Device Registration/Update** → Register or update device
6. **Token Generation** → New access + refresh tokens
7. **Response** → User info + tokens + device info

### **B. JWT Token Management**

#### **Token Structure:**
```typescript
// Access Token Payload (15 minutes)
interface AccessTokenPayload {
  userId: string;
  phoneNumber: string;
  deviceId: string;
  roles: string[];
  type: 'access';
  iat: number;
  exp: number;
}

// Refresh Token Payload (7 days)
interface RefreshTokenPayload {
  userId: string;
  deviceId: string;
  tokenVersion: number;
  type: 'refresh';
  iat: number;
  exp: number;
}
```

#### **Token Security:**
- **Access Token**: Short-lived (15min), no storage needed
- **Refresh Token**: Long-lived (7d), stored in Redis with device mapping
- **Token Rotation**: New refresh token on each refresh request
- **Version Control**: Token version for invalidation
- **Device Binding**: Tokens bound to specific device

### **C. Device Management**

#### **Device Registration Logic:**
```typescript
interface DeviceInfo {
  deviceId: string;           // Unique device identifier
  deviceName: string;         // User-friendly name
  deviceType: 'mobile' | 'web' | 'desktop';
  platform: string;          // iOS, Android, Windows, etc.
  appVersion: string;         // App version
  lastLoginAt: Date;
  isActive: boolean;
  pushToken?: string;         // For notifications
}
```

#### **Device Limit Enforcement:**
1. **Check Current Devices** → Count active devices
2. **Limit Validation** → Max 5 devices per user
3. **LRU Eviction** → Remove oldest inactive device if limit exceeded
4. **New Device Registration** → Add new device
5. **Token Invalidation** → Invalidate tokens for removed devices

### **D. Auto-Login Implementation**

#### **Client-Side Flow:**
1. **App Startup** → Check for stored refresh token
2. **Token Validation** → Verify token format and expiry
3. **Auto-Refresh Request** → Send refresh token to server
4. **New Tokens** → Receive new access + refresh tokens
5. **Auto-Login Success** → Navigate to main app

#### **Server-Side Validation:**
1. **Token Extraction** → Get refresh token from request
2. **Token Verification** → Validate signature and expiry
3. **Device Validation** → Check device still registered
4. **User Status Check** → Ensure user not banned/deleted
5. **New Token Generation** → Issue new token pair
6. **Response** → New tokens + user info

### **E. Google Social Login**

#### **OAuth Flow:**
1. **Client Initiates** → Google OAuth sign-in
2. **Authorization Code** → Client receives auth code
3. **Server Verification** → Verify code with Google
4. **User Info Retrieval** → Get user profile from Google
5. **Account Linking** → Link/create account with phone
6. **Device Registration** → Register OAuth device
7. **Token Generation** → Standard JWT tokens
8. **Response** → User info + tokens

#### **Account Linking Strategy:**
- **First-time OAuth**: Require phone number verification
- **Existing User**: Link Google account to existing phone-based account
- **Security**: Store Google ID for future logins
- **Fallback**: Always allow phone+password login

## 🛡️ **Security Considerations**

### **Password Security:**
- **Hashing**: bcrypt with 12+ salt rounds
- **Strength**: Minimum 8 chars, mixed case, numbers
- **Attempts**: Rate limiting on failed login attempts
- **Compromise**: Password reset via phone verification

### **Token Security:**
- **Signing**: RS256 algorithm with key rotation
- **Storage**: Refresh tokens in Redis with TTL
- **Transport**: HTTPS only, secure headers
- **Invalidation**: Logout invalidates all device tokens

### **Device Security:**
- **Fingerprinting**: Combine multiple device attributes
- **Validation**: Cross-reference device info on each request
- **Suspicious Activity**: Flag unusual device patterns
- **Management**: User can view/revoke devices

### **Rate Limiting:**
- **Login Attempts**: 5 attempts per phone per 15 minutes
- **Token Refresh**: 10 requests per device per minute
- **Registration**: 3 attempts per IP per hour
- **Password Reset**: 1 attempt per phone per hour

## 📱 **Client Integration Points**

### **Mobile App (React Expo):**
```typescript
// Secure token storage
import * as SecureStore from 'expo-secure-store';

// Auto-login implementation
const autoLogin = async () => {
  const refreshToken = await SecureStore.getItemAsync('refresh_token');
  if (refreshToken) {
    const response = await api.post('/auth/refresh', { refreshToken });
    // Handle success/failure
  }
};

// Device info collection
const getDeviceInfo = () => ({
  deviceId: Constants.deviceId,
  deviceName: Device.deviceName,
  deviceType: 'mobile',
  platform: Platform.OS,
  appVersion: Constants.manifest.version,
});
```

### **API Endpoints:**
```typescript
// Core Authentication
POST /auth/register           # Phone + password registration
POST /auth/login             # Phone + password login
POST /auth/refresh           # Refresh access token
POST /auth/logout            # Logout current device
POST /auth/logout-all        # Logout all devices

// Device Management
GET  /auth/devices           # List user devices
DELETE /auth/devices/:id     # Remove specific device
PUT  /auth/devices/:id       # Update device info

// Social Authentication
GET  /auth/google            # Google OAuth initiation
GET  /auth/google/callback   # Google OAuth callback
POST /auth/google/mobile     # Mobile Google auth

// Security
POST /auth/forgot-password   # Password reset request
POST /auth/reset-password    # Password reset confirmation
POST /auth/change-password   # Change password (authenticated)
```

## 🧪 **Testing Strategy**

### **Unit Tests:**
- Service methods validation
- Token generation/verification
- Password hashing/verification
- Device management logic
- Input validation (DTOs)

### **Integration Tests:**
- Full authentication flows
- Device limit enforcement
- Token refresh scenarios
- Social login integration
- Error handling cases

### **E2E Tests:**
- Complete user journeys
- Multi-device scenarios
- Security violation handling
- Rate limiting validation
- Cross-platform compatibility

## 📊 **Performance Considerations**

### **Caching Strategy:**
- **User Sessions**: Cache active users in Redis
- **Device Info**: Cache device list per user
- **Rate Limits**: Use Redis for rate limit counters
- **Social Tokens**: Cache OAuth tokens temporarily

### **Database Optimization:**
- **Indexes**: Phone number, device ID, user ID
- **Queries**: Optimized lookups and joins
- **Partitioning**: Consider user data partitioning
- **Connection Pooling**: Efficient DB connections

### **Monitoring:**
- **Login Success/Failure Rates**
- **Token Refresh Patterns**
- **Device Registration Trends**
- **Social Login Adoption**
- **Security Incident Detection**

## 🚀 **Implementation Timeline**

### **Week 1: Core Infrastructure**
- [ ] Basic auth module setup
- [ ] JWT token service
- [ ] Password hashing utilities
- [ ] Database schema design

### **Week 2: Phone Authentication**
- [ ] Registration endpoint
- [ ] Login endpoint
- [ ] Basic device management
- [ ] Token refresh flow

### **Week 3: Device Management**
- [ ] Device limit enforcement
- [ ] Device management endpoints
- [ ] Auto-login implementation
- [ ] Security enhancements

### **Week 4: Social Login & Polish**
- [ ] Google OAuth integration
- [ ] Account linking logic
- [ ] Rate limiting implementation
- [ ] Testing & documentation

## 🔄 **Future Phases (Post-MVP)**

### **Phase 2: Advanced Security**
- SMS OTP verification
- Two-factor authentication
- Biometric authentication
- Advanced fraud detection

### **Phase 3: Enterprise Features**
- Role-based access control
- Organization management
- SSO integration
- Advanced audit logging

### **Phase 4: Scale & Performance**
- Multi-region support
- Advanced caching
- Microservice migration
- Real-time security monitoring
