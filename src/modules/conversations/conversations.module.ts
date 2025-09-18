/**
 * Conversations Module
 * 
 * 🎯 Purpose: Configure conversation module with all dependencies
 * 📱 Mobile-First: Optimized for real-time messaging
 * 🚀 Clean Architecture: Complete dependency injection setup
 */

import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Schemas
import {
  Conversation,
  ConversationSchema,
  ConversationParticipant,
  ConversationParticipantSchema,
  ConversationSettings,
  ConversationSettingsSchema
} from './schemas';

// Repositories
import { ConversationRepository } from './repositories';

// Services
import { ConversationsService } from './services';

// Controllers
import { ConversationsController } from './controllers';

// External Dependencies
import { UsersModule } from '../users/users.module';
import { MessagesModule } from '../messages/messages.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    // MongoDB Schemas Registration
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: ConversationParticipant.name, schema: ConversationParticipantSchema },
      { name: ConversationSettings.name, schema: ConversationSettingsSchema },
    ]),

    // External Module Dependencies
    UsersModule, // For user validation and user info
    forwardRef(() => MessagesModule), // For message and attachment access
    forwardRef(() => FilesModule), // For file operations and URLs
  ],

  controllers: [
    ConversationsController,
  ],

  providers: [
    // Repository Implementations
    ConversationRepository,

    // Service Implementations
    ConversationsService,

    // Interface Bindings for Dependency Injection
    {
      provide: 'IConversationRepository',
      useClass: ConversationRepository,
    },
    {
      provide: 'IConversationsService',
      useClass: ConversationsService,
    },
  ],

  exports: [
    // Export schemas for other modules
    MongooseModule,

    // Export repositories for other services
    ConversationRepository,
    'IConversationRepository',

    // Export services for other modules
    ConversationsService,
    'IConversationsService',
  ],
})
export class ConversationsModule { }