/**
 * Presence Types - Online Status System
 * 
 * 🎯 Purpose: Type definitions for real-time user presence tracking
 * 📱 Multi-device: Support multiple devices per user
 * 🔴 Status Types: Online, away, busy, offline with custom messages
 */

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

export type DeviceType = 'mobile' | 'web' | 'desktop';

/**
 * Device information for presence tracking
 */
export interface DeviceInfo {
    deviceId: string;
    deviceType: DeviceType;
    platform: string;
    socketId: string;
    lastActive?: number;
}

/**
 * User presence information
 */
export interface UserPresence {
    userId: string;
    status: PresenceStatus;
    lastSeen: number;
    connectedAt: number;
    deviceId: string;
    deviceType: DeviceType;
    platform: string;
    socketId: string;
    statusMessage?: string;
}

/**
 * Bulk presence query response
 */
export interface BulkPresenceResponse {
    presences: Map<string, UserPresence>;
    onlineCount: number;
}

/**
 * Presence update event for Socket.IO broadcasting
 */
export interface PresenceUpdateEvent {
    userId: string;
    status: PresenceStatus;
    timestamp: number;
    deviceInfo?: DeviceInfo;
    statusMessage?: string;
    reason?: string; // For offline events (disconnect, stale_connection, etc.)
}

/**
 * Socket.IO DTOs for presence events
 */

/**
 * Client sends to update their status
 */
export interface UpdatePresenceDto {
    status: PresenceStatus;
    statusMessage?: string;
}

/**
 * Client sends periodic heartbeat
 */
export interface HeartbeatDto {
    deviceId: string;
    timestamp: number;
}

/**
 * Server broadcasts presence changes
 */
export interface PresenceNotificationDto {
    userId: string;
    status: PresenceStatus;
    lastSeen: number;
    statusMessage?: string;
}

/**
 * Bulk presence response for contact lists
 */
export interface ContactPresenceDto {
    userId: string;
    status: PresenceStatus;
    lastSeen: number;
    statusMessage?: string;
}

/**
 * Request presence for multiple users
 */
export interface BulkPresenceRequestDto {
    userIds: string[];
}

/**
 * Response with multiple user presences
 */
export interface BulkPresenceResponseDto {
    presences: ContactPresenceDto[];
    onlineCount: number;
}
