import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserCore, UserCoreSchema, UserSecurity, UserSecuritySchema, UserDevice, UserDeviceSchema } from './schemas';
import { UsersRepository } from './repositories/users.repository';

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
        }
    ],
    exports: [
        UsersRepository,
        'IUsersRepository', // Export interface token
    ]
})
export class UsersModule { }