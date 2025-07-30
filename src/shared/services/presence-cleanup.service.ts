/**
 * Presence Cleanup Service - Background Jobs
 * 
 * 🎯 Purpose: Handle cleanup of stale presence data
 * ⏰ Scheduled: Runs cleanup jobs at regular intervals
 * 🔄 Maintenance: Keeps presence data accurate and up-to-date
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PresenceService } from './presence.service';

@Injectable()
export class PresenceCleanupService {
    private readonly logger = new Logger(PresenceCleanupService.name);

    constructor(
        private readonly presenceService: PresenceService,
    ) { }

    /**
     * Cleanup stale connections every 2 minutes
     * Detects users who haven't sent heartbeat and marks them offline
     */
    @Cron('0 */2 * * * *') // Every 2 minutes
    async cleanupStaleConnections() {
        try {
            this.logger.debug('Starting presence cleanup job');
            await this.presenceService.cleanupStaleConnections();
            this.logger.debug('Presence cleanup job completed');
        } catch (error) {
            this.logger.error('Presence cleanup job failed:', error);
        }
    }

    /**
     * Run cleanup job manually (for testing or administrative purposes)
     */
    async runCleanupNow(): Promise<void> {
        this.logger.log('Running manual presence cleanup');
        await this.cleanupStaleConnections();
    }
}
