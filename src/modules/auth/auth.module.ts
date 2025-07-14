import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Controllers
import { AuthController } from './controllers/auth.controller';
import { DeviceController } from './controllers/device.controller';

// Services
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { DeviceService } from './services/device.service';

// Strategies
import { JwtStrategy } from './strategies/jwt.strategy';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// External Modules
import { RedisModule } from '../../redis/redis.module';
import { UsersModule } from '../users/users.module';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSecurity, UserSecuritySchema, UserDevice, UserDeviceSchema } from '../users/schemas';

// Repository
import { AuthRepository } from './repositories/auth.repository';
import { DeviceRepository } from './repositories/device.repository';
import { IDeviceRepository } from './interfaces/device-repository.interface';

@Module({
  imports: [
    // Configuration
    ConfigModule,

    // Passport for authentication strategies
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // JWT configuration
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn'),
        },
      }),
    }),

    // Mongoose schemas for auth-specific collections
    MongooseModule.forFeature([
      { name: UserSecurity.name, schema: UserSecuritySchema },
      { name: UserDevice.name, schema: UserDeviceSchema },
    ]),

    // External modules
    RedisModule,
    UsersModule,
  ],

  controllers: [
    AuthController,
    DeviceController,
  ],

  providers: [
    // Services
    AuthService,
    TokenService,
    DeviceService,

    // Repositories with Interface Injection
    AuthRepository,
    {
      provide: 'IAuthRepository',
      useClass: AuthRepository,
    },
    DeviceRepository,
    {
      provide: 'IDeviceRepository',
      useClass: DeviceRepository,
    },

    // Strategies
    JwtStrategy,

    // Guards
    JwtAuthGuard,
  ],

  exports: [
    // Export services for use in other modules
    AuthService,
    TokenService,
    DeviceService,
    JwtAuthGuard,
  ],
})
export class AuthModule { }
