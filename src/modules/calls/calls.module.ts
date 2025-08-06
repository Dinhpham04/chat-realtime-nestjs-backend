import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Call, CallSchema } from './schemas/call.schema';
import { CallStateService } from './services/call-state.service';
import { WebRTCSignalingService } from './services/webrtc-signaling.service';
import { CallLifecycleService } from './services/call-lifecycle.service';
import { CallErrorHandlerService } from './services/call-error-handler.service';
import { CallsController } from './controllers/calls.controller';
import { RedisModule } from '../../redis/redis.module';

/**
 * Calls Module - Senior Level Implementation
 * Following Senior Guidelines:
 * - Clean Architecture: Separation of concerns across services
 * - Dependency Injection: Proper service registration and exports
 * - Event-Driven: EventEmitter for call lifecycle events
 * - Error Handling: Comprehensive error management
 * 
 * Voice/Video Call functionality for the messaging application:
 * - Call lifecycle management (ringing → active → ended)
 * - Call state management via Redis
 * - Call history storage in MongoDB
 * - WebRTC signaling support
 * - Error handling and timeout management
 */
@Module({
  imports: [
    // MongoDB schemas
    MongooseModule.forFeature([
      { name: Call.name, schema: CallSchema }
    ]),

    // Redis for real-time call state
    RedisModule,

    // Event emitter for call lifecycle events
    EventEmitterModule,
  ],
  controllers: [
    CallsController,
  ],
  providers: [
    CallStateService,
    WebRTCSignalingService,
    CallLifecycleService,
    CallErrorHandlerService,
  ],
  exports: [
    CallStateService,
    WebRTCSignalingService,
    CallLifecycleService,
    CallErrorHandlerService,
  ],
})
export class CallsModule { }
