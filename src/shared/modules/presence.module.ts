/**
 * Presimport { PresenceService } from '../services/presence.service';
import { PresenceCleanupService } from '../services/presence-cleanup.service';
import { LastMessageService } from '../services/last-message.service';
import { RedisModule } from '../../redis/redis.module';

@Module({
    imports: [
        RedisModule,
        EventEmitterModule.forRoot(), // For presence event broadcasting
        ScheduleModule.forRoot(), // For cleanup jobs
    ],
    providers: [
        PresenceService,
        PresenceCleanupService,
        LastMessageService,
    ],
    exports: [
        PresenceService,
        PresenceCleanupService,
        LastMessageService,
    ],
})
export class PresenceModule {} Status System
 * 
 * 🎯 Purpose: Module for real-time user presence tracking
 * 🔴 Redis Integration: Scalable presence storage
 * 📱 Multi-device: Support multiple devices per user
 * 🚀 Real-time: Socket.IO broadcasting integration
 */

import { Module, forwardRef } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { PresenceService } from '../services/presence.service';
import { PresenceCleanupService } from '../services/presence-cleanup.service';
import { RedisModule } from '../../redis/redis.module';

@Module({
    imports: [
        RedisModule,
        EventEmitterModule.forRoot(), // For presence event broadcasting
        ScheduleModule.forRoot(), // For cleanup jobs
    ],
    providers: [
        PresenceService,
        PresenceCleanupService,
    ],
    exports: [
        PresenceService,
        PresenceCleanupService,
    ],
})
export class PresenceModule { }
