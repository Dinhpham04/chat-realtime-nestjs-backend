import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
    RealTimeStateService,
    RedisCacheService,
    WebSocketStateService,
    RedisCleanupService
} from './services';
import { RedisHealthController } from './controllers/redis-health.controller';

export const REDIS_CLIENT = 'REDIS_CLIENT';
export const IOREDIS_CLIENT = 'IOREDIS_CLIENT';

@Module({
    imports: [ConfigModule],
    controllers: [RedisHealthController],
    providers: [
        {
            provide: IOREDIS_CLIENT,
            useFactory: (configService: ConfigService) => {
                return new Redis({
                    host: configService.get('redis.host'),
                    port: Number(configService.get('redis.port')) || 6379,
                    password: configService.get('redis.password'),
                    connectTimeout: 10000,
                    lazyConnect: true,
                    maxRetriesPerRequest: 3,
                });
            },
            inject: [ConfigService],
        },
        RealTimeStateService,
        RedisCacheService,
        WebSocketStateService,
        RedisCleanupService,
    ],
    exports: [
        IOREDIS_CLIENT,
        RealTimeStateService,
        RedisCacheService,
        WebSocketStateService,
        RedisCleanupService,
    ],
})
export class RedisModule { }
