import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserCore, UserCoreSchema, UserSecurity, UserSecuritySchema, UserDevice, UserDeviceSchema } from './schemas';
import { UsersRepository } from './repositories/users.repository';
import { UsersService } from './services/users.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: UserCore.name, schema: UserCoreSchema },
            { name: UserSecurity.name, schema: UserSecuritySchema },
            { name: UserDevice.name, schema: UserDeviceSchema },
        ])
    ],
    providers: [
        UsersRepository,
        {
            provide: 'IUsersRepository',
            useClass: UsersRepository,
        },
        UsersService,
        {
            provide: 'IUsersService',
            useClass: UsersService,
        }
    ],
    exports: [
        UsersRepository,
        'IUsersRepository', // Export interface token
        UsersService,
        'IUsersService', // Export service interface token
    ]
})
export class UsersModule { }