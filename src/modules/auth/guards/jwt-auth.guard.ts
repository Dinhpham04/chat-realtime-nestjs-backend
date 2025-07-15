import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ExecutionContext } from '@nestjs/common';

/**
 * JWT Authentication Guard
 * Protects routes that require valid JWT access token
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') { // extends Passport's AuthGuard with strategy 'jwt'
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext) { // called first when route is accessed
    // Add any additional logic here if needed
    // optional: checking ip is allowed, rate limiting, etc.
    return super.canActivate(context); // call passport's jwt strategy
  }

  /**
   * 
   * @param err: error from jwt strategy (if any)
   * @param user: user object if authentication is successful
   * @param info: additional info from strategy(error message)
   * @param context: Execution context with request/response
   * @returns 
   */

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      const request = context.switchToHttp().getRequest();
      this.logger.warn(`JWT authentication failed: ${info?.message || 'Unknown error'}: ${request.id || 'unknown ip'}`);
      if (info?.message === 'Token expired') {
        throw new UnauthorizedException('Token expired', 'TOKEN_EXPIRED');
      }
      throw new UnauthorizedException('Invalid token', 'INVALID_TOKEN');
    }

    // Log successful authentication for security audit
    this.logger.log(`User authenticated: ${user.userId}`);
    return user;
  }
}


/**
  * 1. JwtAuthGuard.canActivate() called
  * 2. super.canActivate() → Passport JWT Strategy
  * 3. Strategy validates token signature
  * 4. Strategy decodes payload: { userId, phoneNumber, deviceId }
  * 5. Strategy calls validate() method in JwtStrategy
  * 6. JwtAuthGuard.handleRequest() called with results
 */