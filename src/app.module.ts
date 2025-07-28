import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConversationsModule } from './modules/conversations/conversations.module';

// Import shared components
import {
  GlobalExceptionFilter,
  LoggingInterceptor,
  RequestIdMiddleware,
} from './shared';
import { FriendsModule } from './modules/friends/friends.module';
import { SocketModule } from './socket/socket.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      envFilePath: '.env',
    }),
    // JWT Module configuration
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'default-secret',
      // signOptions: {
      //   expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m'
      // },
    }),
    DatabaseModule,
    RedisModule,
    SocketModule,
    UsersModule,
    AuthModule,
    ConversationsModule,
    FriendsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global Exception Filters
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // {
    //   provide: APP_FILTER,
    //   useClass: JwtAuthExceptionFilter,
    // },
    // Global Interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply request ID middleware globally
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
