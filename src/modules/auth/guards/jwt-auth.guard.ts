import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ExecutionContext } from '@nestjs/common';

/**
 * JWT Authentication Guard
 * Protects routes that require valid JWT access token
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext) {
    // Add any additional logic here if needed
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      this.logger.warn(`JWT authentication failed: ${info?.message || 'Unknown error'}`);
      throw err || new UnauthorizedException('Invalid or expired access token');
    }

    // Log successful authentication for security audit
    this.logger.log(`User authenticated: ${user.userId}`);
    return user;
  }
}
