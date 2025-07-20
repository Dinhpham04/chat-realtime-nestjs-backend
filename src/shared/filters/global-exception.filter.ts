import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { JsonWebTokenError, TokenExpiredError, NotBeforeError } from 'jsonwebtoken';

/**
 * Global Exception Filter - Senior Level Implementation
 * 
 * 🎯 Purpose: Centralized error handling với proper message formatting
 * 🔒 Security: No sensitive data leakage trong error responses
 * 📱 Mobile-Friendly: Consistent error structure cho mobile clients
 * 🚀 Production-Ready: Proper logging và monitoring integration
 * 
 * Features:
 * - HttpException message preservation
 * - JWT error handling với clear messages
 * - Request tracking với correlation IDs
 * - Security-first error responses
 * - Structured logging cho monitoring
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: HttpStatus;
    let message: string | string[];
    let errorCode: string;
    let details: any = {};

    // Handle different types of exceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        // Handle validation errors (class-validator)
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;
        errorCode = responseObj.error || this.getErrorCodeFromStatus(status);
        details = responseObj.details || {};
      } else {
        // Handle simple string messages
        message = exceptionResponse as string || exception.message;
        errorCode = this.getErrorCodeFromStatus(status);
      }
    } else if (exception instanceof TokenExpiredError) {
      // JWT Token expired
      status = HttpStatus.UNAUTHORIZED;
      message = 'Access token has expired';
      errorCode = 'TOKEN_EXPIRED';
      details = {
        expiredAt: exception.expiredAt,
        hint: 'Use refresh token to get new access token'
      };
    } else if (exception instanceof JsonWebTokenError) {
      // JWT Token invalid
      status = HttpStatus.UNAUTHORIZED;
      message = 'Invalid access token';
      errorCode = 'TOKEN_INVALID';
      details = {
        hint: 'Please login again to get valid token'
      };
    } else if (exception instanceof NotBeforeError) {
      // JWT Token not active yet
      status = HttpStatus.UNAUTHORIZED;
      message = 'Token not active';
      errorCode = 'TOKEN_NOT_ACTIVE';
      details = {
        date: exception.date
      };
    } else {
      // Unknown error - Don't expose internal details
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      errorCode = 'INTERNAL_ERROR';

      // Log full error for debugging (server-side only)
      this.logger.error(
        `Unhandled exception: ${exception}`,
        exception instanceof Error ? exception.stack : undefined,
        'GlobalExceptionFilter'
      );
    }

    // Extract source location from stack trace for debugging
    const sourceLocation = this.extractSourceLocation(exception);

    // Create standardized error response
    const errorResponse = {
      success: false,
      error: {
        code: errorCode,
        message,
        ...(Object.keys(details).length > 0 && { details }),
        // Add source location in development mode only
        ...(process.env.NODE_ENV === 'development' && sourceLocation && {
          debug: {
            sourceFile: sourceLocation.file,
            lineNumber: sourceLocation.line,
            columnNumber: sourceLocation.column,
            functionName: sourceLocation.function,
          }
        }),
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        ...(request.headers['x-request-id'] && {
          requestId: request.headers['x-request-id']
        }),
      },
    };

    // Log error for monitoring (structured logging)
    this.logger.warn(
      `${request.method} ${request.url} - ${status} - ${errorCode}: ${Array.isArray(message) ? message.join(', ') : message
      }`,
      {
        statusCode: status,
        errorCode,
        path: request.url,
        method: request.method,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        requestId: request.headers['x-request-id'],
        // Add source location to logs for debugging
        ...(sourceLocation && {
          sourceFile: sourceLocation.file,
          lineNumber: sourceLocation.line,
          columnNumber: sourceLocation.column,
          functionName: sourceLocation.function,
          stackTrace: exception instanceof Error ? exception.stack : undefined,
        }),
      }
    );

    response.status(status).json(errorResponse);
  }

  /**
   * Extract source location from error stack trace
   * 🎯 Purpose: Help developers identify exactly where errors occur
   * 📍 Location: Parse stack trace to get file, line, column info
   * 🚀 Debug: Essential for rapid debugging in development
   */
  private extractSourceLocation(exception: unknown): {
    file?: string;
    line?: number;
    column?: number;
    function?: string;
  } | null {
    if (!(exception instanceof Error) || !exception.stack) {
      return null;
    }

    try {
      // Parse stack trace - format varies by Node.js version
      const stackLines = exception.stack.split('\n');

      // Find first line that contains our source code (skip node_modules)
      for (const line of stackLines) {
        if (line.includes('at ') &&
          !line.includes('node_modules') &&
          !line.includes('internal/') &&
          (line.includes('.ts:') || line.includes('.js:'))) {

          // Extract function name
          const functionMatch = line.match(/at\s+([^\s]+)/);
          const functionName = functionMatch ? functionMatch[1] : 'anonymous';

          // Extract file path and location
          const locationMatch = line.match(/\(([^)]+):(\d+):(\d+)\)/) ||
            line.match(/at\s+[^\s]+\s+([^:]+):(\d+):(\d+)/);

          if (locationMatch) {
            const [, filePath, lineStr, columnStr] = locationMatch;

            // Get just the filename for cleaner display
            const fileName = filePath.split(/[/\\]/).pop() || filePath;

            return {
              file: fileName,
              line: parseInt(lineStr, 10),
              column: parseInt(columnStr, 10),
              function: functionName,
            };
          }
        }
      }
    } catch (parseError) {
      // If stack parsing fails, don't break the error handling
      this.logger.debug(`Failed to parse stack trace: ${parseError.message}`);
    }

    return null;
  }

  /**
   * Map HTTP status codes to error codes
   */
  private getErrorCodeFromStatus(status: HttpStatus): string {
    const statusMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };

    return statusMap[status] || 'HTTP_EXCEPTION';
  }
}
