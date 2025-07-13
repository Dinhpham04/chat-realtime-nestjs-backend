import { JwtModuleOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export const jwtConfig = (configService: ConfigService): JwtModuleOptions => ({
  secret: configService.get<string>('JWT_SECRET'),
  signOptions: {
    expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1d'), // 1 day
    issuer: configService.get<string>('JWT_ISSUER', 'chat-app'),
    audience: configService.get<string>('JWT_AUDIENCE', 'chat-users'),
  },
  verifyOptions: {
    ignoreExpiration: false,
    ignoreNotBefore: false,
  },
});