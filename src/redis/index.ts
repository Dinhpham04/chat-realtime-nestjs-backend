/**
 * Redis Module for Real-time Chat Application
 * 
 * Features:
 * - User presence management (online/offline/typing)
 * - Message caching for performance
 * - Session management across devices
 * - Push notification queuing
 * - Rate limiting
 * - WebSocket state management
 * - Background cleanup tasks
 * 
 * Usage:
 * 1. Import RedisModule in your app module
 * 2. Inject services where needed:
 *    - RealTimeStateService for presence/typing
 *    - RedisCacheService for caching/sessions
 *    - WebSocketStateService for WS management
 *    - RedisCleanupService for maintenance
 */

export * from './redis.module';
export * from './services';
export * from './controllers/redis-health.controller';
