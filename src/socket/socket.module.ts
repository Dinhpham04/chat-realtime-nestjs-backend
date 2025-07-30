import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../modules/auth/auth.module';
import { UsersModule } from '../modules/users/users.module';
import { ConversationsModule } from '../modules/conversations/conversations.module';
import { MessagesModule } from '../modules/messages/messages.module';
import { FilesModule } from '../modules/files/files.module';
import { PresenceModule } from '../shared/modules/presence.module';
import { ChatGateway } from './gateways/chat.gateway';
// import { FileUploadGateway } from './gateways/file-upload.gateway';
import { SocketController } from './controllers/socket.controller';
import {
    SocketAuthService,
    MessageQueueService,
    MessageOptimizationService,
    DeviceSyncService,
    SocketCleanupService,
} from './services';
import { LastMessageService } from 'src/shared/services/last-message.service';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        EventEmitterModule.forRoot(),
        RedisModule,
        AuthModule,
        UsersModule,
        ConversationsModule,
        MessagesModule,
        FilesModule,
        PresenceModule,
    ],
    controllers: [SocketController],
    providers: [
        ChatGateway,
        // FileUploadGateway,
        SocketAuthService,
        MessageQueueService,
        MessageOptimizationService,
        DeviceSyncService,
        SocketCleanupService,
        LastMessageService
    ],
    exports: [
        ChatGateway,
        // FileUploadGateway,
        MessageQueueService,
    ],
})
export class SocketModule { }
