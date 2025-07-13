/**
 * User-related enums and constants for mobile messaging application
 */

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BANNED = 'banned'
}

export enum ActivityStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AWAY = 'away',
  BUSY = 'busy',
  INVISIBLE = 'invisible'
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say'
}

export enum SocialProvider {
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  APPLE = 'apple',
  PHONE = 'phone'
}

// Mobile-specific enums
export enum MobilePlatform {
  IOS = 'ios',
  ANDROID = 'android'
}

export enum PushProvider {
  FCM = 'fcm',    // Firebase Cloud Messaging (Android)
  APNS = 'apns'   // Apple Push Notification Service (iOS)
}

export enum AppState {
  FOREGROUND = 'foreground',
  BACKGROUND = 'background',
  KILLED = 'killed'
}

export enum NetworkType {
  WIFI = 'wifi',
  FOUR_G = '4g',
  FIVE_G = '5g',
  THREE_G = '3g',
  OFFLINE = 'offline'
}

export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
  AUTO = 'auto'
}

export enum FontSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large'
}

export enum PrivacySetting {
  EVERYONE = 'everyone',
  CONTACTS = 'contacts',
  NOBODY = 'nobody'
}

export const MOBILE_CONSTANTS = {
  PHONE: {
    REGEX: /^\+?[1-9]\d{1,14}$/, // E.164 format
    MAX_LENGTH: 20
  },
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 30,
    REGEX: /^[a-zA-Z0-9_]+$/
  },
  PASSWORD: {
    MIN_LENGTH: 6,
    MAX_LENGTH: 128
  },
  FULL_NAME: {
    MAX_LENGTH: 100
  },
  BIO: {
    MAX_LENGTH: 500
  },
  AVATAR_URL: {
    REGEX: /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i
  },
  EMAIL: {
    REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  OTP: {
    LENGTH: 6,
    EXPIRES_IN_MINUTES: 5
  },
  DEVICE: {
    MAX_DEVICES_PER_USER: 5
  },
  CONTACT_SYNC: {
    MAX_CONTACTS_PER_BATCH: 100
  },
  LOCATION: {
    ACCURACY_THRESHOLD: 100, // meters
    MAX_AGE_HOURS: 24
  }
} as const;

// Mobile-specific validation patterns
export const MOBILE_VALIDATION = {
  DEVICE_ID: /^[a-zA-Z0-9-_]{10,}$/,
  APP_VERSION: /^\d+\.\d+\.\d+$/,
  OS_VERSION: /^[\d\.]+$/,
  PUSH_TOKEN: /^[a-zA-Z0-9:_-]+$/
} as const;
