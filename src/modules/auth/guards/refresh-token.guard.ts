import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { TokenService } from '../services/token.service';

/**
 * Refresh Token Guard
 * Validates refresh tokens for token refresh endpoint
 */
@Injectable()
export class RefreshTokenGuard implements CanActivate {
  private readonly logger = new Logger(RefreshTokenGuard.name);

  constructor(private readonly tokenService: TokenService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const refreshToken = this.extractRefreshToken(request);

    if (!refreshToken) {
      this.logger.warn('Refresh token missing from request');
      throw new UnauthorizedException('Refresh token is required');
    }

    try {
      // Verify refresh token
      const payload = await this.tokenService.verifyRefreshToken(refreshToken);

      // Attach payload to request for use in controller
      request.refreshTokenPayload = payload;

      this.logger.log(`Refresh token validated for user: ${payload.sub}`);
      return true;
    } catch (error) {
      this.logger.warn(`Refresh token validation failed: ${error.message}`);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private extractRefreshToken(request: any): string | null {
    // Try to get refresh token from body first
    if (request.body?.refreshToken) {
      return request.body.refreshToken;
    }

    // Try to get from Authorization header as fallback
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }
}
