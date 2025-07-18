import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri'),
        user: configService.get<string>('database.user'),
        pass: configService.get<string>('database.password'),
        authSource: configService.get<string>('database.authSource'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10, // Số connection tối đa
        serverSelectionTimeoutMS: 5000, // Timeout khi connect
        socketTimeoutMS: 45000, // Timeout cho socket
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule { }
