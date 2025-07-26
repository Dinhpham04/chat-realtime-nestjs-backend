import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Schemas
import { UserFriend, UserFriendSchema } from './schemas/user-friend.schema';
import { UserContact, UserContactSchema } from './schemas/user-contact.schema';

// Repositories
import { UserFriendRepository, UserContactRepository } from './repositories';

// Services
import { FriendsService, ContactSyncService } from './services';

// Types
import { IUserFriendRepository, IUserContactRepository, IFriendsService, IContactSyncService } from './types';

// Controllers
import { FriendsController, ContactController } from './controllers';

// External Dependencies
import { UsersModule } from '../users/users.module';
import { RedisModule } from '../../redis/redis.module';
@Module({
    imports: [
        // MongoDB Schemas
        MongooseModule.forFeature([
            { name: UserFriend.name, schema: UserFriendSchema },
            { name: UserContact.name, schema: UserContactSchema },
        ]),

        // External Dependencies for senior-level implementation
        UsersModule,
        RedisModule,
    ],

    controllers: [
        FriendsController,
        ContactController,
    ],

    providers: [
        // Repository Implementations
        UserFriendRepository,
        UserContactRepository,

        // Repository Interface Bindings (SOLID DIP compliance)
        {
            provide: 'IUserFriendRepository',
            useClass: UserFriendRepository,
        },
        {
            provide: 'IUserContactRepository',
            useClass: UserContactRepository,
        },

        // Service Implementations
        FriendsService,
        ContactSyncService,

        // Service Interface Bindings
        {
            provide: 'IFriendsService',
            useClass: FriendsService,
        },
        {
            provide: 'IContactSyncService',
            useClass: ContactSyncService,
        },
    ],

    exports: [
        // Export schemas để other modules có thể use
        MongooseModule,

        // Export repositories để services có thể inject
        UserFriendRepository,
        UserContactRepository,

        // Export services cho other modules
        FriendsService,
        ContactSyncService,
    ],
})
export class FriendsModule { }
