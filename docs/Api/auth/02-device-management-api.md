# Device Management API Documentation

## 📋 **Tổng quan**

Device Management API cho phép quản lý các thiết bị đã đăng ký của người dùng. Mỗi user có thể đăng ký tối đa 5 thiết bị, và có thể quản lý, cập nhật, vô hiệu hóa các thiết bị.

### **Base URL**
```
http://localhost:3000/devices
```

### **Authentication Required**
Tất cả endpoints đều yêu cầu JWT authentication:
```http
Authorization: Bearer {access_token}
```

---

## 📱 **Device Object Structure**

```typescript
interface Device {
  deviceId: string;           // Unique device identifier
  deviceName: string;         // User-friendly name
  deviceType: "mobile" | "web" | "desktop" | "tablet";
  platform: string;          // "ios", "android", "web", etc.
  appVersion: string;         // App version
  pushToken?: string;         // Push notification token
  lastLoginAt: Date;          // Last login time
  isActive: boolean;          // Device status
  createdAt: Date;           // Registration time
  updatedAt: Date;           // Last update time
}
```

---

## 📱 **API Endpoints**

### **1. Lấy danh sách thiết bị của user**

**Endpoint:** `GET /devices`

**Mô tả:** Lấy tất cả thiết bị đã đăng ký của user hiện tại.

**Query Parameters:**
```typescript
{
  page?: number;        // Trang hiện tại (default: 1)
  limit?: number;       // Số lượng/trang (default: 10)
  status?: string;      // Filter theo trạng thái: "active" | "inactive"
}
```

**Request Example:**
```http
GET /devices?page=1&limit=10&status=active
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200 OK):**
```json
{
  "devices": [
    {
      "deviceId": "device-uuid-12345",
      "deviceName": "iPhone 14 Pro",
      "deviceType": "mobile",
      "platform": "ios",
      "appVersion": "1.0.0",
      "pushToken": "firebase-token-xyz",
      "lastLoginAt": "2025-08-15T10:30:00.000Z",
      "isActive": true,
      "createdAt": "2025-08-01T08:00:00.000Z",
      "updatedAt": "2025-08-15T10:30:00.000Z"
    },
    {
      "deviceId": "device-uuid-67890",
      "deviceName": "MacBook Pro",
      "deviceType": "desktop",
      "platform": "macos",
      "appVersion": "1.0.0",
      "lastLoginAt": "2025-08-14T15:20:00.000Z",
      "isActive": true,
      "createdAt": "2025-08-10T12:00:00.000Z",
      "updatedAt": "2025-08-14T15:20:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 2,
    "totalPages": 1
  }
}
```

---

### **2. Lấy thông tin thiết bị hiện tại**

**Endpoint:** `GET /devices/current`

**Mô tả:** Lấy thông tin thiết bị đang được sử dụng (thiết bị gửi request).

**Response (200 OK):**
```json
{
  "deviceId": "device-uuid-12345",
  "deviceName": "iPhone 14 Pro",
  "deviceType": "mobile",
  "platform": "ios",
  "appVersion": "1.0.0",
  "pushToken": "firebase-token-xyz",
  "lastLoginAt": "2025-08-15T10:30:00.000Z",
  "isActive": true,
  "isCurrent": true,
  "createdAt": "2025-08-01T08:00:00.000Z",
  "updatedAt": "2025-08-15T10:30:00.000Z"
}
```

---

### **3. Lấy thông tin thiết bị theo ID**

**Endpoint:** `GET /devices/{deviceId}`

**Mô tả:** Lấy thông tin chi tiết của một thiết bị cụ thể.

**Path Parameters:**
- `deviceId` (string): ID của thiết bị

**Request Example:**
```http
GET /devices/device-uuid-12345
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200 OK):**
```json
{
  "deviceId": "device-uuid-12345",
  "deviceName": "iPhone 14 Pro",
  "deviceType": "mobile",
  "platform": "ios",
  "appVersion": "1.0.0",
  "pushToken": "firebase-token-xyz",
  "lastLoginAt": "2025-08-15T10:30:00.000Z",
  "isActive": true,
  "createdAt": "2025-08-01T08:00:00.000Z",
  "updatedAt": "2025-08-15T10:30:00.000Z"
}
```

**Error Responses:**
```json
// 404 Not Found - Thiết bị không tồn tại
{
  "statusCode": 404,
  "message": "Device not found",
  "error": "Not Found"
}

// 403 Forbidden - Thiết bị không thuộc về user
{
  "statusCode": 403,
  "message": "Access denied to this device",
  "error": "Forbidden"
}
```

---

### **4. Đăng ký thiết bị mới**

**Endpoint:** `POST /devices`

**Mô tả:** Đăng ký thiết bị mới cho user. Tự động remove thiết bị cũ nhất nếu vượt quá 5 thiết bị.

**Request Body:**
```typescript
{
  deviceId: string;           // Unique identifier
  deviceName: string;         // User-friendly name
  deviceType: "mobile" | "web" | "desktop" | "tablet";
  platform: string;          // Operating system
  appVersion: string;         // App version
  pushToken?: string;         // Push notification token (optional)
}
```

**Request Example:**
```json
{
  "deviceId": "new-device-uuid-999",
  "deviceName": "iPad Pro",
  "deviceType": "tablet",
  "platform": "ios",
  "appVersion": "1.1.0",
  "pushToken": "new-firebase-token-abc"
}
```

**Response (201 Created):**
```json
{
  "message": "Device registered successfully",
  "device": {
    "deviceId": "new-device-uuid-999",
    "deviceName": "iPad Pro",
    "deviceType": "tablet",
    "platform": "ios",
    "appVersion": "1.1.0",
    "pushToken": "new-firebase-token-abc",
    "lastLoginAt": "2025-08-15T11:00:00.000Z",
    "isActive": true,
    "createdAt": "2025-08-15T11:00:00.000Z",
    "updatedAt": "2025-08-15T11:00:00.000Z"
  },
  "removedDevice": {
    "deviceId": "old-device-uuid-111",
    "deviceName": "Old iPhone",
    "reason": "Device limit exceeded (max 5 devices)"
  }
}
```

**Error Responses:**
```json
// 409 Conflict - Device ID đã tồn tại
{
  "statusCode": 409,
  "message": "Device with this ID already exists",
  "error": "Conflict"
}

// 400 Bad Request - Validation errors
{
  "statusCode": 400,
  "message": [
    "Device ID is required",
    "Device type must be mobile, web, desktop, or tablet"
  ],
  "error": "Bad Request"
}
```

---

### **5. Cập nhật thông tin thiết bị**

**Endpoint:** `POST /devices/{deviceId}`

**Mô tả:** Cập nhật thông tin thiết bị (tên, push token, app version, etc.).

**Path Parameters:**
- `deviceId` (string): ID của thiết bị cần cập nhật

**Request Body (Partial Update):**
```typescript
{
  deviceName?: string;        // Tên thiết bị mới
  appVersion?: string;        // Version app mới
  pushToken?: string;         // Push token mới
}
```

**Request Example:**
```json
{
  "deviceName": "iPhone 14 Pro Max",
  "appVersion": "1.2.0",
  "pushToken": "updated-firebase-token-xyz"
}
```

**Response (200 OK):**
```json
{
  "message": "Device updated successfully",
  "device": {
    "deviceId": "device-uuid-12345",
    "deviceName": "iPhone 14 Pro Max",
    "deviceType": "mobile",
    "platform": "ios",
    "appVersion": "1.2.0",
    "pushToken": "updated-firebase-token-xyz",
    "lastLoginAt": "2025-08-15T10:30:00.000Z",
    "isActive": true,
    "createdAt": "2025-08-01T08:00:00.000Z",
    "updatedAt": "2025-08-15T11:15:00.000Z"
  }
}
```

---

### **6. Vô hiệu hóa thiết bị (Soft Delete)**

**Endpoint:** `POST /devices/{deviceId}/deactivate`

**Mô tả:** Vô hiệu hóa thiết bị (không xóa hoàn toàn). Thiết bị sẽ không thể đăng nhập được nữa.

**Path Parameters:**
- `deviceId` (string): ID của thiết bị cần vô hiệu hóa

**Response (200 OK):**
```json
{
  "message": "Device deactivated successfully",
  "deviceId": "device-uuid-12345",
  "status": "inactive"
}
```

**Note:** 
- Thiết bị bị vô hiệu hóa sẽ có `isActive = false`
- Các tokens liên quan đến thiết bị này sẽ bị vô hiệu hóa
- User sẽ bị logout khỏi thiết bị này

---

### **7. Xóa thiết bị vĩnh viễn**

**Endpoint:** `DELETE /devices/{deviceId}`

**Mô tả:** Xóa thiết bị hoàn toàn khỏi hệ thống.

**Path Parameters:**
- `deviceId` (string): ID của thiết bị cần xóa

**Response (200 OK):**
```json
{
  "message": "Device deleted successfully",
  "deviceId": "device-uuid-12345"
}
```

**Error Responses:**
```json
// 403 Forbidden - Không thể xóa thiết bị hiện tại
{
  "statusCode": 403,
  "message": "Cannot delete current device. Please logout first.",
  "error": "Forbidden"
}

// 404 Not Found - Thiết bị không tồn tại
{
  "statusCode": 404,
  "message": "Device not found",
  "error": "Not Found"
}
```

---

## 🔐 **Security Features**

### **Device Limit Enforcement**
- **Tối đa 5 thiết bị/user**
- **LRU Policy**: Thiết bị cũ nhất (theo lastLoginAt) sẽ bị remove khi vượt limit
- **Automatic Cleanup**: Thiết bị inactive > 30 ngày sẽ bị tự động xóa

### **Device Validation**
- **Unique Device ID**: Mỗi thiết bị phải có ID duy nhất
- **Platform Verification**: Kiểm tra platform và device type consistency
- **Push Token Validation**: Validate format của push notification tokens

### **Security Audit**
- **Device Activity Logging**: Ghi log tất cả activities của thiết bị
- **Suspicious Activity Detection**: Phát hiện login từ thiết bị lạ
- **Token Binding**: Tokens được bind với specific device

---

## 📱 **Frontend Integration Examples**

### **React Native Device Management**

#### **1. Device Registration Service**
```typescript
// services/deviceService.ts
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';
import httpClient from '../utils/httpClient';

class DeviceService {
  // Generate device info cho registration
  async generateDeviceInfo() {
    const deviceId = await AsyncStorage.getItem('deviceId') || 
                     await DeviceInfo.getUniqueId();
    
    // Lưu device ID để consistent
    await AsyncStorage.setItem('deviceId', deviceId);

    return {
      deviceId,
      deviceName: await DeviceInfo.getDeviceName(),
      deviceType: DeviceInfo.isTablet() ? 'tablet' : 'mobile',
      platform: Platform.OS,
      appVersion: DeviceInfo.getVersion(),
    };
  }

  // Lấy danh sách thiết bị
  async getUserDevices() {
    const response = await httpClient.get('/devices');
    return response.data;
  }

  // Lấy thiết bị hiện tại
  async getCurrentDevice() {
    const response = await httpClient.get('/devices/current');
    return response.data;
  }

  // Đăng ký thiết bị mới
  async registerDevice(pushToken?: string) {
    const deviceInfo = await this.generateDeviceInfo();
    
    const response = await httpClient.post('/devices', {
      ...deviceInfo,
      pushToken
    });
    
    return response.data;
  }

  // Cập nhật push token
  async updatePushToken(pushToken: string) {
    const deviceId = await AsyncStorage.getItem('deviceId');
    
    const response = await httpClient.post(`/devices/${deviceId}`, {
      pushToken
    });
    
    return response.data;
  }

  // Cập nhật app version
  async updateAppVersion() {
    const deviceId = await AsyncStorage.getItem('deviceId');
    const appVersion = DeviceInfo.getVersion();
    
    const response = await httpClient.post(`/devices/${deviceId}`, {
      appVersion
    });
    
    return response.data;
  }

  // Vô hiệu hóa thiết bị khác
  async deactivateDevice(deviceId: string) {
    const response = await httpClient.post(`/devices/${deviceId}/deactivate`);
    return response.data;
  }

  // Xóa thiết bị
  async deleteDevice(deviceId: string) {
    const response = await httpClient.delete(`/devices/${deviceId}`);
    return response.data;
  }
}

export const deviceService = new DeviceService();
```

#### **2. Device Management Screen**
```typescript
// screens/DeviceManagementScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Alert, TouchableOpacity } from 'react-native';
import { deviceService } from '../services/deviceService';

interface Device {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  platform: string;
  lastLoginAt: string;
  isActive: boolean;
  isCurrent?: boolean;
}

export const DeviceManagementScreen: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const response = await deviceService.getUserDevices();
      setDevices(response.devices);
    } catch (error) {
      Alert.alert('Error', 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateDevice = async (deviceId: string, deviceName: string) => {
    Alert.alert(
      'Deactivate Device',
      `Are you sure you want to deactivate "${deviceName}"? This device will be logged out.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await deviceService.deactivateDevice(deviceId);
              Alert.alert('Success', 'Device deactivated successfully');
              loadDevices(); // Refresh list
            } catch (error) {
              Alert.alert('Error', 'Failed to deactivate device');
            }
          },
        },
      ]
    );
  };

  const renderDevice = ({ item }: { item: Device }) => (
    <View style={styles.deviceItem}>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>
          {item.deviceName}
          {item.isCurrent && <Text style={styles.currentBadge}> (Current)</Text>}
        </Text>
        <Text style={styles.deviceDetails}>
          {item.platform} • {item.deviceType}
        </Text>
        <Text style={styles.lastLogin}>
          Last login: {new Date(item.lastLoginAt).toLocaleDateString()}
        </Text>
      </View>
      
      {!item.isCurrent && (
        <TouchableOpacity
          style={[styles.actionButton, !item.isActive && styles.inactiveButton]}
          onPress={() => handleDeactivateDevice(item.deviceId, item.deviceName)}
          disabled={!item.isActive}
        >
          <Text style={styles.actionButtonText}>
            {item.isActive ? 'Deactivate' : 'Inactive'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text>Loading devices...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manage Devices</Text>
      <Text style={styles.subtitle}>
        You can have up to 5 devices. Oldest devices will be automatically removed.
      </Text>
      
      <FlatList
        data={devices}
        renderItem={renderDevice}
        keyExtractor={(item) => item.deviceId}
        style={styles.deviceList}
      />
    </View>
  );
};

const styles = {
  // Styles here...
};
```

#### **3. Auto Device Registration Hook**
```typescript
// hooks/useDeviceRegistration.ts
import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { deviceService } from '../services/deviceService';
import messaging from '@react-native-firebase/messaging';

export const useDeviceRegistration = () => {
  const { state } = useAuth();

  useEffect(() => {
    if (state.isAuthenticated) {
      registerDeviceWithPushToken();
    }
  }, [state.isAuthenticated]);

  const registerDeviceWithPushToken = async () => {
    try {
      // Request push notification permission
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        // Get FCM token
        const pushToken = await messaging().getToken();
        
        // Register device with push token
        await deviceService.registerDevice(pushToken);
        console.log('Device registered with push token');
      } else {
        // Register device without push token
        await deviceService.registerDevice();
        console.log('Device registered without push token');
      }
    } catch (error) {
      console.error('Device registration failed:', error);
    }
  };

  const updatePushToken = async () => {
    try {
      const pushToken = await messaging().getToken();
      await deviceService.updatePushToken(pushToken);
      console.log('Push token updated');
    } catch (error) {
      console.error('Push token update failed:', error);
    }
  };

  return {
    updatePushToken,
  };
};
```

---

## ⚠️ **Common Scenarios & Handling**

### **1. Device Limit Exceeded**
```typescript
// Handle device limit exceeded response
const handleDeviceLimitExceeded = (response: any) => {
  if (response.removedDevice) {
    Alert.alert(
      'Device Limit Reached',
      `Your oldest device "${response.removedDevice.deviceName}" was automatically removed to register this new device.`,
      [{ text: 'OK' }]
    );
  }
};
```

### **2. Push Token Updates**
```typescript
// Auto-update push token when it changes
useEffect(() => {
  const unsubscribe = messaging().onTokenRefresh(async (token) => {
    try {
      await deviceService.updatePushToken(token);
    } catch (error) {
      console.error('Failed to update push token:', error);
    }
  });

  return unsubscribe;
}, []);
```

### **3. App Version Updates**
```typescript
// Update app version on app start
useEffect(() => {
  const updateAppVersionIfNeeded = async () => {
    try {
      await deviceService.updateAppVersion();
    } catch (error) {
      console.error('Failed to update app version:', error);
    }
  };

  updateAppVersionIfNeeded();
}, []);
```

---

## 🔧 **Error Handling Best Practices**

### **Common Error Scenarios**
```typescript
const handleDeviceApiError = (error: any) => {
  const { status, data } = error.response || {};
  
  switch (status) {
    case 403:
      if (data.message.includes('current device')) {
        return 'Cannot perform this action on current device';
      }
      return 'Access denied to this device';
      
    case 404:
      return 'Device not found';
      
    case 409:
      return 'Device already exists';
      
    case 422:
      return 'Device limit exceeded (max 5 devices)';
      
    default:
      return 'Device operation failed';
  }
};
```

### **Retry Logic for Device Registration**
```typescript
const registerDeviceWithRetry = async (maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await deviceService.registerDevice();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};
```

---

**📞 Support:** Liên hệ team backend để được hỗ trợ về Device Management API.
