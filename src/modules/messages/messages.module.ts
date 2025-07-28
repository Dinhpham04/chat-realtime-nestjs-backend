import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MessagesService } from './services/messages.service';
import { MessagesController } from './controllers/messages.controller';
import { MessageRepository } from './repositories/message.repository';
import { Message, MessageSchema } from './schemas/message.schema';
import { AuthModule } from '../auth/auth.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { UsersModule } from '../users';

/**
 * Messages Module
 *
 * 🎯 Purpose: Messages functionality with Socket.IO integration
 * 📱 Mobile-First: Real-time messaging with REST API support
 * 🚀 Clean Architecture: Service-Repository pattern with dependency injection
 *
 * Features:
 * - Send/receive messages in real-time
 * - Message editing and deletion
 * - Read receipts and delivery status
 * - Message search and pagination
 * - Bulk operations
 * - Message forwarding
 * - Analytics and insights
 */

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Message.name, schema: MessageSchema }
        ]),
        EventEmitterModule.forRoot(), // Fix EventEmitter injection
        AuthModule, // Import Auth module for authentication
        UsersModule,
        forwardRef(() => ConversationsModule) // Import Conversations module for membership validation
    ],
    controllers: [MessagesController],
    providers: [
        MessagesService,
        MessageRepository,
        {
            provide: 'IMessageRepository',
            useClass: MessageRepository
        }
    ],
    exports: [MessagesService, MessageRepository] // Export for Socket.IO Gateway use
})
export class MessagesModule { }
