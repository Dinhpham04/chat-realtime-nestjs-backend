import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
// import { UsersController } from './users.controller';
// import { UsersService } from './users.service';
import { UserCore, UserCoreSchema } from './schemas';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: UserCore.name, schema: UserCoreSchema }
        ])
    ],
    // controllers: [UsersController],
    // providers: [UsersService],
    // exports: [UsersService] // Export để có thể sử dụng ở các module khác
})
export class UsersModule { }