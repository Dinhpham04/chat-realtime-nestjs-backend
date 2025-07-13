/**
 * Modular User Schemas - Optimized for mobile-first chat application
 * 
 * Architecture:
 * - UserCore: Essential user data, relationships, basic profile
 * - UserDevice: Minimal device info for push notifications
 * - UserSettings: Backup of client settings for sync
 * - UserSecurity: Authentication, audit logs, security
 * 
 * Real-time data (online status, typing) managed by Redis
 * Client-heavy approach for better performance
 */

export * from './user-core.schema';
export * from './user-device.schema';
export * from './user-settings.schema';
export * from './user-security.schema';

