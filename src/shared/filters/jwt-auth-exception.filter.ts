import { ExceptionFilter, Catch, ArgumentsHost, UnauthorizedException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Specific filter for JWT Authentication errors
 */
@Catch(UnauthorizedException)
export class JwtAuthExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(JwtAuthExceptionFilter.name);

  catch(exception: UnauthorizedException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const exceptionResponse = exception.getResponse() as any;

    // Determine specific JWT error type
    let errorCode = 'UNAUTHORIZED';
    let message = 'Authentication failed';
    let details: any = {};

    if (typeof exceptionResponse === 'object') {
      const errorMessage = exceptionResponse.message;

      if (errorMessage.includes('jwt expired')) {
        errorCode = 'TOKEN_EXPIRED';
        message = 'Access token has expired';
        details = {
          hint: 'Use refresh token endpoint to get new access token',
          refreshEndpoint: '/auth/refresh-token'
        };
      } else if (errorMessage.includes('invalid token') || errorMessage.includes('jwt malformed')) {
        errorCode = 'TOKEN_INVALID';
        message = 'Invalid access token format';
        details = {
          hint: 'Please login again to get valid token'
        };
      } else if (errorMessage.includes('No auth token')) {
        errorCode = 'TOKEN_MISSING';
        message = 'Authentication token is required';
        details = {
          hint: 'Include Bearer token in Authorization header'
        };
      } else if (errorMessage.includes('invalid signature')) {
        errorCode = 'TOKEN_SIGNATURE_INVALID';
        message = 'Token signature verification failed';
        details = {
          hint: 'Token may have been tampered with'
        };
      }
    }

    const errorResponse = {
      success: false,
      error: {
        code: errorCode,
        message,
        details,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
      },
    };

    // Add helpful headers for client
    response.setHeader('WWW-Authenticate', 'Bearer');

    if (errorCode === 'TOKEN_EXPIRED') {
      response.setHeader('X-Token-Expired', 'true');
    }

    // Log authentication failures (useful for security monitoring)
    this.logger.warn(
      `Authentication failed: ${errorCode} - ${request.method} ${request.url} - IP: ${request.ip} - User-Agent: ${request.get('User-Agent')}`,
      'JwtAuthExceptionFilter'
    );

    response.status(401).json(errorResponse);
  }
}
