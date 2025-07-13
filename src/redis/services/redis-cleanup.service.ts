import { Injectable, Logger } from '@nestjs/common';
import { RealTimeStateService, RedisCacheService } from '../services';

@Injectable()
export class RedisCleanupService {
  private readonly logger = new Logger(RedisCleanupService.name);
  private cleanupInterval: NodeJS.Timeout | null = null;
  private notificationInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly realTimeState: RealTimeStateService,
    private readonly cacheService: RedisCacheService,
  ) {
    this.startPeriodicCleanup();
  }

  /**
   * Start periodic cleanup tasks
   */
  private startPeriodicCleanup() {
    // Cleanup expired sessions every 5 minutes
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);

    // Process notifications every 30 seconds
    this.notificationInterval = setInterval(async () => {
      await this.processNotifications();
    }, 30 * 1000);

    this.logger.log('Redis cleanup tasks started');
  }

  /**
   * Stop periodic cleanup tasks
   */
  stopPeriodicCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.notificationInterval) {
      clearInterval(this.notificationInterval);
      this.notificationInterval = null;
    }

    this.logger.log('Redis cleanup tasks stopped');
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      this.logger.log('Starting cleanup of expired sessions...');

      await this.realTimeState.cleanupExpiredSessions();

      this.logger.log('Cleanup of expired sessions completed');
    } catch (error) {
      this.logger.error('Failed to cleanup expired sessions', error);
    }
  }

  /**
   * Process notification queues
   */
  async processNotifications() {
    try {
      // Process high priority notifications
      const highPriorityNotifications = await this.cacheService.processNotificationQueue('high');

      if (highPriorityNotifications.length > 0) {
        this.logger.log(`Processing ${highPriorityNotifications.length} high priority notifications`);

        for (const notification of highPriorityNotifications) {
          this.logger.debug('High priority notification:', {
            userId: notification.userId,
            title: notification.title,
            body: notification.body,
          });
        }
      }

      // Process normal priority notifications
      const normalPriorityNotifications = await this.cacheService.processNotificationQueue('normal');

      if (normalPriorityNotifications.length > 0) {
        this.logger.log(`Processing ${normalPriorityNotifications.length} normal priority notifications`);

        for (const notification of normalPriorityNotifications) {
          this.logger.debug('Normal priority notification:', {
            userId: notification.userId,
            title: notification.title,
            body: notification.body,
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to process notifications', error);
    }
  }

  /**
   * Log Redis statistics
   */
  async logRedisStats() {
    try {
      const stats = await this.realTimeState.getStats();
      const health = await this.cacheService.healthCheck();

      this.logger.log('Redis Statistics:', {
        health: health.status,
        latency: `${health.latency}ms`,
        onlineUsers: stats.onlineUsers,
        totalPresenceKeys: stats.totalPresenceKeys,
        activeConversations: stats.activeConversations,
      });

      return {
        health: health.status,
        latency: health.latency,
        stats,
      };
    } catch (error) {
      this.logger.error('Failed to log Redis statistics', error);
      throw error;
    }
  }

  /**
   * Manual cleanup method for testing
   */
  async manualCleanup(): Promise<{
    sessionsCleanedUp: boolean;
    notificationsProcessed: number;
  }> {
    try {
      // Cleanup sessions
      await this.realTimeState.cleanupExpiredSessions();

      // Process notifications
      const highPriorityNotifications = await this.cacheService.processNotificationQueue('high');
      const normalPriorityNotifications = await this.cacheService.processNotificationQueue('normal');

      return {
        sessionsCleanedUp: true,
        notificationsProcessed: highPriorityNotifications.length + normalPriorityNotifications.length,
      };
    } catch (error) {
      this.logger.error('Manual cleanup failed', error);
      throw error;
    }
  }

  /**
   * Clean up resources on module destroy
   */
  onModuleDestroy() {
    this.stopPeriodicCleanup();
  }
}
