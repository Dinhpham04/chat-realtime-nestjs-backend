import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { JsonWebTokenError, TokenExpiredError, NotBeforeError } from 'jsonwebtoken';

/**
 * Global Exception Filter for handling authentication and authorization errors
 */
// @Catch()
// export class GlobalExceptionFilter implements ExceptionFilter {
//   private readonly logger = new Logger(GlobalExceptionFilter.name);

//   catch(exception: unknown, host: ArgumentsHost) {
//     const ctx = host.switchToHttp();
//     const response = ctx.getResponse<Response>();
//     const request = ctx.getRequest<Request>();

//     let status: HttpStatus;
//     let message: string;
//     let errorCode: string;
//     let details: any = {};

//     // Handle different types of exceptions
//     if (exception instanceof HttpException) {
//       status = exception.getStatus();
//       const exceptionResponse = exception.getResponse();

//       if (typeof exceptionResponse === 'object') {
//         message = (exceptionResponse as any).message || exception.message;
//         errorCode = (exceptionResponse as any).errorCode || 'HTTP_EXCEPTION';
//         details = (exceptionResponse as any).details || {};
//       } else {
//         message = exceptionResponse as string;
//         errorCode = 'HTTP_EXCEPTION';
//       }
//     } else if (exception instanceof TokenExpiredError) {
//       // JWT Token expired
//       status = HttpStatus.UNAUTHORIZED;
//       message = 'Access token has expired';
//       errorCode = 'TOKEN_EXPIRED';
//       details = {
//         expiredAt: exception.expiredAt,
//         hint: 'Use refresh token to get new access token'
//       };
//     } else if (exception instanceof JsonWebTokenError) {
//       // JWT Token invalid
//       status = HttpStatus.UNAUTHORIZED;
//       message = 'Invalid access token';
//       errorCode = 'TOKEN_INVALID';
//       details = {
//         hint: 'Please login again to get valid token'
//       };
//     } else if (exception instanceof NotBeforeError) {
//       // JWT Token not active yet
//       status = HttpStatus.UNAUTHORIZED;
//       message = 'Token not active';
//       errorCode = 'TOKEN_NOT_ACTIVE';
//       details = {
//         date: exception.date
//       };
//     } else {
//       // Unknown error
//       status = HttpStatus.INTERNAL_SERVER_ERROR;
//       message = 'Internal server error';
//       errorCode = 'INTERNAL_ERROR';

//       // Log unknown errors for debugging
//       this.logger.error(
//         `Unhandled exception: ${exception}`,
//         exception instanceof Error ? exception.stack : undefined,
//         'GlobalExceptionFilter'
//       );
//     }

//     // Create error response
//     const errorResponse = {
//       success: false,
//       error: {
//         code: errorCode,
//         message,
//         details,
//         timestamp: new Date().toISOString(),
//         path: request.url,
//         method: request.method,
//       },
//     };

//     // Add request ID if available
//     if (request.headers['x-request-id']) {
//       errorResponse.error['requestId'] = request.headers['x-request-id'];
//     }

//     // Log the error (but not sensitive info)
//     this.logger.warn(
//       `${request.method} ${request.url} - ${status} - ${errorCode}: ${message}`,
//       'GlobalExceptionFilter'
//     );

//     response.status(status).json(errorResponse);
//   }
// }

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = {
      statusCode: status,
      message: exception instanceof HttpException
        ? exception.message
        : 'Internal server error',
      path: request.url,
      timestamp: new Date().toISOString(),
    }
    // Add request ID if available
    if (request.headers['x-request-id']) {
      errorResponse['requestId'] = request.headers['x-request-id'];
    }

    // Log the error (but not sensitive info)
    this.logger.warn(
      `${errorResponse.timestamp} - ${request.method} ${request.url} - ${status} - ${errorResponse.message} `,
      'GlobalExceptionFilter'
    );

    response.status(status).json(errorResponse);
  }
}
