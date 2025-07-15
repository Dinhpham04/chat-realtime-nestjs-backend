/**
 * Authentication-related interfaces for Phase 1 MVP
 */

export interface JwtPayload {
  userId: string;
  phoneNumber: string;
  deviceId: string;
  roles: string[];
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface AccessTokenPayload extends JwtPayload {
  type: 'access';
}

export interface RefreshTokenPayload {
  userId: string;
  deviceId: string;
  tokenVersion: number;
  type: 'refresh';
  iat?: number;
  exp?: number;
}

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: 'mobile' | 'web' | 'desktop';
  platform: string;
  appVersion: string;
  userAgent?: string;
  ipAddress?: string;
  lastLoginAt: Date;
  isActive: boolean;
  pushToken?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    phoneNumber: string;
    isActive: boolean;
    createdAt: Date;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    refreshExpiresIn: number;
  };
  device: DeviceInfo;
}

export interface LoginCredentials {
  phoneNumber: string;
  password: string;
  deviceInfo: DeviceInfo;
}

export interface RegisterCredentials extends LoginCredentials {
  fullName?: string;
  confirmPassword: string;
}

export interface SocialAuthData {
  provider: 'google';
  accessToken: string;
  idToken?: string;
  deviceInfo: DeviceInfo;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export interface PasswordResetRequest {
  phoneNumber: string;
}

export interface PasswordResetConfirm {
  phoneNumber: string;
  resetCode: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
