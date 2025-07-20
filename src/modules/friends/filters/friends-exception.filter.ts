import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Friends Exception Filter - MVP Error Handling
 * 
 * 🎯 Purpose: Centralized error handling cho Friends module
 * 📱 Mobile-First: Consistent error responses
 * 🚀 Clean Architecture: Error handling layer
 */

@Catch()
export class FriendsExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(FriendsExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let error = 'INTERNAL_ERROR';

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
                const responseObj = exceptionResponse as any;
                message = responseObj.message || responseObj.error || message;
                error = responseObj.error || error;
            }
        }

        // Map specific friend-related errors
        if (message.includes('already friends')) {
            error = 'ALREADY_FRIENDS';
        } else if (message.includes('already pending')) {
            error = 'FRIEND_REQUEST_EXISTS';
        } else if (message.includes('not found')) {
            error = 'NOT_FOUND';
        } else if (message.includes('blocked')) {
            error = 'USER_BLOCKED';
        }

        const errorResponse = {
            statusCode: status,
            message,
            error,
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method
        };

        // Log error for monitoring
        this.logger.error(
            `${request.method} ${request.url} - ${status} - ${message}`,
            exception instanceof Error ? exception.stack : 'Unknown error'
        );

        response.status(status).json(errorResponse);
    }
}
