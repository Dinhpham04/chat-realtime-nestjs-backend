import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../modules/auth/auth.module';
import { UsersModule } from '../modules/users/users.module';
import { ConversationsModule } from '../modules/conversations/conversations.module';
import { MessagesModule } from '../modules/messages/messages.module';
import { ChatGateway } from './gateways/chat.gateway';
import { SocketController } from './controllers/socket.controller';
import {
    SocketAuthService,
    MessageQueueService,
    MessageOptimizationService,
    DeviceSyncService,
    SocketCleanupService,
} from './services';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        EventEmitterModule.forRoot(),
        RedisModule,
        AuthModule,
        UsersModule,
        ConversationsModule,
        MessagesModule,
    ],
    controllers: [SocketController],
    providers: [
        ChatGateway,
        SocketAuthService,
        MessageQueueService,
        MessageOptimizationService,
        DeviceSyncService,
        SocketCleanupService,
    ],
    exports: [
        ChatGateway,
        MessageQueueService,
    ],
})
export class SocketModule { }
