import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
  TokenPair
} from '../interfaces/auth.interfaces';
import { JwtPayloadData, RefreshTokenData, JwtUser } from '../interfaces/jwt-payload.interface';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  /**
   * Generate access and refresh token pair
   */
  async generateTokenPair(user: JwtUser): Promise<TokenPair> {
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    const accessExpiresIn = this.configService.get<string>('jwt.expiresIn', '15m');
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn', '7d');

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseTimeToSeconds(accessExpiresIn),
      refreshExpiresIn: this.parseTimeToSeconds(refreshExpiresIn),
    };
  }

  /**
   * Generate access token (short-lived)
   */
  async generateAccessToken(user: JwtUser): Promise<string> {
    const payload: JwtPayloadData = {
      sub: user.userId,
      phoneNumber: user.phoneNumber,
      deviceId: user.deviceId,
      roles: user.roles,
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.parseTimeToSeconds(
        this.configService.get<string>('jwt.expiresIn', '15m')
      ),
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.secret'),
    });
  }

  /**
   * Generate refresh token (long-lived)
   */
  async generateRefreshToken(user: JwtUser, tokenVersion: number = 1): Promise<string> {
    const payload: RefreshTokenData = {
      sub: user.userId,
      deviceId: user.deviceId,
      tokenVersion,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.parseTimeToSeconds(
        this.configService.get<string>('jwt.refreshExpiresIn', '7d')
      ),
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
    });
  }

  /**
   * Verify access token
   */
  async verifyAccessToken(token: string): Promise<JwtPayloadData> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayloadData>(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      if (payload.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      this.logger.warn(`Access token verification failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify refresh token
   */
  async verifyRefreshToken(token: string): Promise<RefreshTokenData> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenData>(token, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      this.logger.warn(`Refresh token verification failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Decode token without verification
   */
  decodeToken(token: string): any {
    return this.jwtService.decode(token);
  }

  /**
   * Extract user info from token payload
   */
  extractUserFromPayload(payload: JwtPayloadData): JwtUser {
    return {
      userId: payload.sub,
      phoneNumber: payload.phoneNumber,
      deviceId: payload.deviceId,
      roles: payload.roles,
    };
  }

  /**
   * Parse time string to seconds
   */
  private parseTimeToSeconds(time: string): number {
    const unit = time.slice(-1);
    const value = parseInt(time.slice(0, -1));

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 900; // Default 15 minutes
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const decoded = this.decodeToken(token) as any;
      if (!decoded.exp) return true;

      return Date.now() >= decoded.exp * 1000;
    } catch {
      return true;
    }
  }

  /**
   * Get token expiry time
   */
  getTokenExpiryTime(token: string): Date | null {
    try {
      const decoded = this.decodeToken(token) as any;
      if (!decoded.exp) return null;

      return new Date(decoded.exp * 1000);
    } catch {
      return null;
    }
  }
}
