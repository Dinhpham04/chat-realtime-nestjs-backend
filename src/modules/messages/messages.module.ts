import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Message, MessageSchema, MessageStatus, MessageStatusSchema } from "./schemas";
import { UsersModule } from "../users";
import { MessageRepository } from "./repositories";
import { MessageService } from "./services";

@Module({
    imports: [
        // MongoDB Schemas Registration
        MongooseModule.forFeature([
            { name: Message.name, schema: MessageSchema },
            { name: MessageStatus.name, schema: MessageStatusSchema },

        ]),

        // External Module Dependencies
        UsersModule
    ],

    controllers: [
    ],

    providers: [
        // Repository Implementations
        MessageRepository,

        // Service Implementations
        MessageService,

        // Interface Bindings for Dependency Injection
        {
            provide: 'IMessageRepository',
            useClass: MessageRepository,
        },

        {
            provide: 'IMessageService',
            useClass: MessageService,
        }
    ],

    exports: [
        // Export schemas for other modules
        MongooseModule,

        // Export repositories for other services
        MessageRepository,
        'IMessageRepository',

        MessageService,
        'IMessageService',
    ],
})
export class MessagesModule { }