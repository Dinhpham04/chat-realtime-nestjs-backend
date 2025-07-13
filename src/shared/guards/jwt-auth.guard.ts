import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';

/**
 * JWT Authentication Guard with proper error handling
 */

export interface JwtPayload {
  userId: string;
  phoneNumber: string;
  deviceId: string;
  roles?: string[];
  iat?: number;     // Issued at
  exp?: number;     // Expires at
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No auth token');
    }

    try {
      // Verify JWT token
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      // Check token type (should be access token)
      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Attach user info to request
      request['user'] = {
        userId: payload.userId,
        phoneNumber: payload.phoneNumber,
        deviceId: payload.deviceId,
        roles: payload.roles || ['user'],
      };

      return true;
    } catch (error) {
      // Log security-relevant information
      this.logger.warn(
        `JWT verification failed: ${error.message} - IP: ${request.ip}`,
        'JwtAuthGuard'
      );

      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('jwt expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('invalid token');
      } else if (error.name === 'NotBeforeError') {
        throw new UnauthorizedException('token not active');
      } else {
        throw new UnauthorizedException(error.message);
      }
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? []; // ?? means if undefined or null return second value (empty array)
    return type === 'Bearer' ? token : undefined;
  }
}
