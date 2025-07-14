/**
 * Device Type Enumeration
 * Defines the types of devices that can access the application
 */
export enum DeviceType {
  MOBILE = 'mobile',
  WEB = 'web',
  DESKTOP = 'desktop',
  TABLET = 'tablet',
}

/**
 * Platform Enumeration
 * Defines the operating system platforms
 */
export enum Platform {
  IOS = 'ios',
  ANDROID = 'android',
  WINDOWS = 'windows',
  MACOS = 'macos',
  LINUX = 'linux',
  WEB = 'web',
  UNKNOWN = 'unknown',
}

/**
 * Device Status Enumeration
 * Defines the status of a registered device
 */
export enum DeviceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BLOCKED = 'blocked',
  REVOKED = 'revoked',
}
