import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SocketAuthService } from './socket-auth.service';

/**
 * Socket Cleanup Service
 * 
 * 🎯 Purpose: Scheduled cleanup of expired device connections
 * 📱 Mobile-First: Handle device cleanup for offline/expired devices
 * 🚀 Performance: Prevent Redis memory bloat from inactive devices
 */
@Injectable()
export class SocketCleanupService {
    private readonly logger = new Logger(SocketCleanupService.name);

    constructor(
        private readonly socketAuthService: SocketAuthService,
    ) { }

    /**
     * Clean up expired device connections every hour
     */
    @Cron(CronExpression.EVERY_HOUR)
    async cleanupExpiredConnections(): Promise<void> {
        this.logger.log('Starting scheduled cleanup of expired device connections...');

        try {
            await this.socketAuthService.cleanupExpiredConnections();

            this.logger.log('Completed scheduled cleanup successfully');

        } catch (error) {
            this.logger.error('Failed to complete scheduled cleanup:', error);
        }
    }

    /**
     * Health check - log current online statistics every 30 minutes
     */
    @Cron(CronExpression.EVERY_30_MINUTES)
    async logOnlineStatistics(): Promise<void> {
        try {
            const onlineUsers = await this.socketAuthService.getAllOnlineUsers();

            this.logger.log(`Online Statistics: ${onlineUsers.length} users currently online`);

            // Log top 5 most active users (optional - for monitoring)
            const topUsers = onlineUsers.slice(0, 5);
            if (topUsers.length > 0) {
                this.logger.debug(`Top active users: ${topUsers.join(', ')}`);
            }

        } catch (error) {
            this.logger.error('Failed to generate online statistics:', error);
        }
    }

    /**
     * Manual cleanup trigger (for admin use)
     */
    async manualCleanup(): Promise<{ success: boolean; message: string }> {
        try {
            await this.socketAuthService.cleanupExpiredConnections();

            const onlineUsers = await this.socketAuthService.getAllOnlineUsers();

            return {
                success: true,
                message: `Cleanup completed successfully. ${onlineUsers.length} users currently online.`
            };

        } catch (error) {
            this.logger.error('Manual cleanup failed:', error);

            return {
                success: false,
                message: `Cleanup failed: ${error.message}`
            };
        }
    }
}
