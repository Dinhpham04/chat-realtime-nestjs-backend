import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
    RealTimeStateService,
    RedisCacheService,
    RedisCleanupService
} from './services';
import { RedisHealthController } from './controllers/redis-health.controller';
import { RedisChunkSessionService } from './services/redis-chunk-session.service';
import { RedisDownloadTokenService } from './services/redis-download-token.service';

const IOREDIS_CLIENT = 'IOREDIS_CLIENT';

@Module({
    controllers: [RedisHealthController],
    providers: [
        {
            provide: IOREDIS_CLIENT,
            useFactory: (configService: ConfigService) => {
                return new Redis({
                    host: configService.get('redis.host') || 'localhost',
                    port: Number(configService.get('redis.port')) || 6379,
                    password: configService.get('redis.password') || undefined,
                    connectTimeout: 10000,
                    lazyConnect: true,
                    maxRetriesPerRequest: 3,
                });
            },
            inject: [ConfigService],
        },
        RealTimeStateService,
        RedisCacheService,
        RedisCleanupService,
        RedisChunkSessionService,
        RedisDownloadTokenService,
    ],
    exports: [
        IOREDIS_CLIENT,
        RealTimeStateService,
        RedisCacheService,
        RedisCleanupService,
        RedisChunkSessionService,
        RedisDownloadTokenService,
    ],
})
export class RedisModule { }
