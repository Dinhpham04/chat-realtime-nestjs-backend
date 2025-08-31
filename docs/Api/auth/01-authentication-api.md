# Authentication API Documentation

## 📋 **Tổng quan**

Authentication API cung cấp các endpoint để quản lý xác thực người dùng trong ứng dụng chat realtime. API hỗ trợ đăng ký, đăng nhập, quản lý thiết bị và refresh token.

### **Base URL**
```
http://localhost:3000/auth
```

### **Authentication Flow**
1. **Đăng ký** → Tạo tài khoản mới với số điện thoại + mật khẩu
2. **Đăng nhập** → Xác thực và nhận tokens (access + refresh)
3. **Sử dụng Access Token** → Gọi các API có bảo mật
4. **Refresh Token** → Gia hạn access token khi hết hạn
5. **Đăng xuất** → Vô hiệu hóa tokens

---

## 🔐 **Security Headers**

### **Required Headers cho Protected Endpoints**
```http
Authorization: Bearer {access_token}
Content-Type: application/json
```

### **Device Info (Required cho Login/Register)**
```typescript
interface DeviceInfo {
  deviceId: string;        // UUID hoặc unique identifier
  deviceName: string;      // Tên thiết bị (ví dụ: "iPhone 14 Pro")
  deviceType: "mobile" | "web" | "desktop" | "tablet";
  platform: string;       // "ios", "android", "web", etc.
  appVersion: string;      // Version của app (ví dụ: "1.0.0")
  pushToken?: string;      // Token cho push notification (optional)
}
```

---

## 📱 **API Endpoints**

### **1. Đăng ký người dùng**

**Endpoint:** `POST /auth/register`

**Mô tả:** Tạo tài khoản mới với số điện thoại và mật khẩu.

**Request Body:**
```typescript
{
  phoneNumber: string;     // Số điện thoại (format: +84xxxxxxxxx)
  password: string;        // Mật khẩu (tối thiểu 8 ký tự, có chữ hoa, chữ thường, số)
  confirmPassword: string; // Xác nhận mật khẩu
  fullName?: string;       // Họ tên (optional)
  deviceInfo: DeviceInfo;  // Thông tin thiết bị
}
```

**Request Example:**
```json
{
  "phoneNumber": "+84901234567",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!",
  "fullName": "Nguyễn Văn A",
  "deviceInfo": {
    "deviceId": "device-uuid-12345",
    "deviceName": "iPhone 14 Pro",
    "deviceType": "mobile",
    "platform": "ios",
    "appVersion": "1.0.0",
    "pushToken": "firebase-push-token-xyz"
  }
}
```

**Response (201 Created):**
```typescript
{
  user: {
    id: string;           // User ID
    phoneNumber: string;  // Số điện thoại
    fullName?: string;    // Họ tên
    isActive: boolean;    // Trạng thái tài khoản
    createdAt: Date;      // Thời gian tạo
  };
  tokens: {
    accessToken: string;      // JWT access token (15 phút)
    refreshToken: string;     // Refresh token (7 ngày)
    expiresIn: number;        // Thời gian hết hạn access token (giây)
    refreshExpiresIn: number; // Thời gian hết hạn refresh token (giây)
  };
  device: {
    deviceId: string;
    deviceName: string;
    deviceType: string;
    platform: string;
    appVersion: string;
    lastLoginAt: Date;
    isActive: boolean;
  };
}
```

**Error Responses:**
```typescript
// 400 Bad Request - Validation errors
{
  "statusCode": 400,
  "message": [
    "Phone number must be a valid Vietnamese phone number",
    "Password must contain at least one lowercase letter, one uppercase letter, and one number"
  ],
  "error": "Bad Request"
}

// 409 Conflict - Số điện thoại đã tồn tại
{
  "statusCode": 409,
  "message": "Phone number already exists",
  "error": "Conflict"
}

// 429 Too Many Requests - Rate limit exceeded
{
  "statusCode": 429,
  "message": "Too many registration attempts. Please try again later.",
  "error": "Too Many Requests"
}
```

---

### **2. Đăng nhập**

**Endpoint:** `POST /auth/login`

**Mô tả:** Xác thực người dùng và trả về tokens.

**Request Body:**
```typescript
{
  phoneNumber: string;    // Số điện thoại
  password: string;       // Mật khẩu
  deviceInfo: DeviceInfo; // Thông tin thiết bị
}
```

**Request Example:**
```json
{
  "phoneNumber": "+84901234567",
  "password": "SecurePass123!",
  "deviceInfo": {
    "deviceId": "device-uuid-12345",
    "deviceName": "iPhone 14 Pro",
    "deviceType": "mobile",
    "platform": "ios",
    "appVersion": "1.0.0"
  }
}
```

**Response (200 OK):**
```typescript
// Same structure as register response
{
  user: { ... },
  tokens: { ... },
  device: { ... }
}
```

**Error Responses:**
```typescript
// 401 Unauthorized - Sai thông tin đăng nhập
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}

// 423 Locked - Tài khoản bị khóa do nhập sai nhiều lần
{
  "statusCode": 423,
  "message": "Account locked due to too many failed login attempts. Try again after 15 minutes.",
  "error": "Locked"
}

// 429 Too Many Requests
{
  "statusCode": 429,
  "message": "Too many login attempts. Please try again later.",
  "error": "Too Many Requests"
}
```

---

### **3. Refresh Access Token**

**Endpoint:** `POST /auth/refresh-token`

**Mô tả:** Gia hạn access token bằng refresh token.

**Request Body:**
```typescript
{
  refreshToken: string; // Refresh token từ login response
}
```

**Request Example:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```typescript
{
  tokens: {
    accessToken: string;      // Access token mới
    refreshToken: string;     // Refresh token mới
    expiresIn: number;        // Thời gian hết hạn access token
    refreshExpiresIn: number; // Thời gian hết hạn refresh token
  };
}
```

**Error Responses:**
```typescript
// 401 Unauthorized - Refresh token không hợp lệ hoặc hết hạn
{
  "statusCode": 401,
  "message": "Invalid or expired refresh token",
  "error": "Unauthorized"
}

// 403 Forbidden - Thiết bị không được phép
{
  "statusCode": 403,
  "message": "Device not registered or inactive",
  "error": "Forbidden"
}
```

---

### **4. Đăng xuất (thiết bị hiện tại)**

**Endpoint:** `POST /auth/logout`

**Mô tả:** Đăng xuất khỏi thiết bị hiện tại và vô hiệu hóa tokens.

**Headers Required:**
```http
Authorization: Bearer {access_token}
```

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

---

### **5. Đăng xuất khỏi tất cả thiết bị**

**Endpoint:** `POST /auth/logout-all`

**Mô tả:** Đăng xuất khỏi tất cả thiết bị và vô hiệu hóa tất cả tokens.

**Headers Required:**
```http
Authorization: Bearer {access_token}
```

**Response (200 OK):**
```json
{
  "message": "Logged out from all devices successfully"
}
```

---

### **6. Lấy thông tin profile**

**Endpoint:** `GET /auth/profile`

**Mô tả:** Lấy thông tin người dùng hiện tại.

**Headers Required:**
```http
Authorization: Bearer {access_token}
```

**Response (200 OK):**
```typescript
{
  id: string;           // User ID
  phoneNumber: string;  // Số điện thoại
  isActive: boolean;    // Trạng thái tài khoản
  deviceId: string;     // Device ID hiện tại
  roles: string[];      // Quyền của user
}
```

---

### **7. Health Check**

**Endpoint:** `GET /auth/health`

**Mô tả:** Kiểm tra trạng thái service authentication.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "service": "auth",
  "timestamp": "2025-08-15T10:30:00.000Z"
}
```

---

## 🛡️ **Security & Rate Limiting**

### **Rate Limits**
- **Đăng ký**: 3 lần/IP/giờ
- **Đăng nhập**: 5 lần/số điện thoại/15 phút
- **Refresh token**: 10 lần/device/phút
- **Logout**: 20 lần/user/phút

### **Failed Login Protection**
- Sau 5 lần đăng nhập sai → Khóa tài khoản 15 phút
- Ghi log tất cả các hoạt động đăng nhập

### **Device Management**
- Tối đa 5 thiết bị/user
- Thiết bị cũ nhất sẽ bị remove khi vượt giới hạn
- Device tracking qua deviceId và platform info

---

## 📱 **Frontend Integration Examples**

### **React/React Native Implementation**

#### **1. Auth Context Setup**
```typescript
// types/auth.ts
interface User {
  id: string;
  phoneNumber: string;
  isActive: boolean;
  deviceId: string;
  roles: string[];
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
```

#### **2. Auth Service**
```typescript
// services/authService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

class AuthService {
  private baseURL = 'http://localhost:3000/auth';

  // Lấy device info
  private getDeviceInfo() {
    return {
      deviceId: 'generated-uuid', // Generate UUID
      deviceName: 'User Device',  // Get device name
      deviceType: 'mobile',       // mobile/web/desktop
      platform: 'ios',           // ios/android/web
      appVersion: '1.0.0'         // App version
    };
  }

  // Đăng ký
  async register(phoneNumber: string, password: string, confirmPassword: string, fullName?: string) {
    const response = await fetch(`${this.baseURL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber,
        password,
        confirmPassword,
        fullName,
        deviceInfo: this.getDeviceInfo()
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    const data = await response.json();
    
    // Lưu tokens vào storage
    await this.saveTokens(data.tokens);
    
    return data;
  }

  // Đăng nhập
  async login(phoneNumber: string, password: string) {
    const response = await fetch(`${this.baseURL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber,
        password,
        deviceInfo: this.getDeviceInfo()
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    const data = await response.json();
    
    // Lưu tokens
    await this.saveTokens(data.tokens);
    
    return data;
  }

  // Refresh token
  async refreshToken() {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${this.baseURL}/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      // Refresh token hết hạn → redirect to login
      await this.logout();
      throw new Error('Session expired');
    }

    const data = await response.json();
    await this.saveTokens(data.tokens);
    
    return data.tokens;
  }

  // Lấy profile
  async getProfile() {
    const accessToken = await AsyncStorage.getItem('accessToken');
    
    const response = await fetch(`${this.baseURL}/profile`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get profile');
    }

    return response.json();
  }

  // Đăng xuất
  async logout() {
    const accessToken = await AsyncStorage.getItem('accessToken');
    
    try {
      await fetch(`${this.baseURL}/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Xóa tokens khỏi storage
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
    }
  }

  // Lưu tokens
  private async saveTokens(tokens: AuthTokens) {
    await AsyncStorage.multiSet([
      ['accessToken', tokens.accessToken],
      ['refreshToken', tokens.refreshToken],
    ]);
  }

  // Lấy access token
  async getAccessToken() {
    return AsyncStorage.getItem('accessToken');
  }
}

export const authService = new AuthService();
```

#### **3. HTTP Interceptor cho Auto Refresh**
```typescript
// utils/httpClient.ts
import axios from 'axios';
import { authService } from '../services/authService';

const httpClient = axios.create({
  baseURL: 'http://localhost:3000',
});

// Request interceptor - thêm access token
httpClient.interceptors.request.use(async (config) => {
  const accessToken = await authService.getAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor - handle token refresh
httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Refresh token
        await authService.refreshToken();
        
        // Retry original request
        const accessToken = await authService.getAccessToken();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        
        return httpClient(originalRequest);
      } catch (refreshError) {
        // Refresh thất bại → redirect to login
        await authService.logout();
        // Redirect to login screen
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default httpClient;
```

#### **4. React Context Implementation**
```typescript
// contexts/AuthContext.tsx
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext<{
  state: AuthState;
  login: (phoneNumber: string, password: string) => Promise<void>;
  register: (phoneNumber: string, password: string, confirmPassword: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}>({} as any);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Auto-login on app start
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const profile = await authService.getProfile();
      dispatch({ type: 'LOGIN_SUCCESS', payload: { user: profile } });
    } catch (error) {
      dispatch({ type: 'LOGOUT' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const login = async (phoneNumber: string, password: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const response = await authService.login(phoneNumber, password);
      dispatch({ type: 'LOGIN_SUCCESS', payload: response });
    } catch (error) {
      dispatch({ type: 'LOGIN_ERROR', payload: error.message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const register = async (phoneNumber: string, password: string, confirmPassword: string, fullName?: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const response = await authService.register(phoneNumber, password, confirmPassword, fullName);
      dispatch({ type: 'LOGIN_SUCCESS', payload: response });
    } catch (error) {
      dispatch({ type: 'REGISTER_ERROR', payload: error.message });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const logout = async () => {
    await authService.logout();
    dispatch({ type: 'LOGOUT' });
  };

  const refreshProfile = async () => {
    try {
      const profile = await authService.getProfile();
      dispatch({ type: 'UPDATE_USER', payload: profile });
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ state, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

---

## ⚠️ **Common Error Handling**

### **Error Response Format**
```typescript
{
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp?: string;
  path?: string;
}
```

### **Error Codes Summary**
- **400**: Validation errors, invalid input
- **401**: Authentication failed, invalid/expired tokens
- **403**: Permission denied, device not allowed
- **409**: Conflict (phone number exists)
- **423**: Account locked due to failed attempts
- **429**: Rate limit exceeded
- **500**: Internal server error

### **Frontend Error Handling Best Practices**
```typescript
// Error handling wrapper
const handleApiError = (error: any) => {
  if (error.response) {
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        return `Validation error: ${Array.isArray(data.message) ? data.message.join(', ') : data.message}`;
      case 401:
        return 'Authentication failed. Please login again.';
      case 409:
        return 'Phone number already exists.';
      case 423:
        return 'Account is locked. Please try again later.';
      case 429:
        return 'Too many attempts. Please wait before trying again.';
      default:
        return 'An unexpected error occurred.';
    }
  }
  
  return 'Network error. Please check your connection.';
};
```

---

## 🔧 **Testing Tips**

### **Test Accounts**
```
Phone: +84901234567
Password: TestPass123!
```

### **Development URLs**
```
Base URL: http://localhost:3000
Swagger UI: http://localhost:3000/api-docs
Health Check: http://localhost:3000/auth/health
```

### **Postman Collection**
Import the provided Postman collection for comprehensive API testing.

---

**📞 Support:** Liên hệ team backend nếu có thắc mắc về API integration.
