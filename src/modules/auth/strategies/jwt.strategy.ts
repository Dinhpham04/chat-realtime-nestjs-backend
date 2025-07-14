import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';
import { JwtUser } from '../interfaces/jwt-payload.interface';

/**
 * JWT Strategy for Passport authentication
 * Validates JWT access tokens and extracts user information
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt.secret') || 'default-secret-key',
    });
  }

  /**
   * Validate JWT payload and return user information
   */
  async validate(payload: any): Promise<JwtUser> {
    this.logger.debug(`Validating JWT payload for user: ${payload.sub}`);

    try {
      // Use AuthService to validate user is still active
      const user = await this.authService.validateUser(payload);

      if (!user) {
        this.logger.warn(`JWT validation failed: User not found or inactive: ${payload.sub}`);
        throw new UnauthorizedException('User not found or inactive');
      }

      this.logger.debug(`JWT validation successful for user: ${user.userId}`);
      return user;
    } catch (error) {
      this.logger.error(`JWT validation error: ${error.message}`);
      throw new UnauthorizedException('Token validation failed');
    }
  }
}
