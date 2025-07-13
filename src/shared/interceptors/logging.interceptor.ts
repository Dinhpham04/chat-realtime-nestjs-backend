import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Interceptor to log HTTP requests and responses
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, ip } = request;
    const userAgent = request.get('User-Agent') || '';
    const startTime = Date.now();

    // Get user info if authenticated
    const user = request['user'] as any;
    const userId = user?.userId || 'anonymous';

    // Log request
    this.logger.log(
      `→ ${method} ${url} - ${ip} - ${userId}`,
      'Request'
    );

    return next.handle().pipe(
      tap(() => { // thực hiện sau khi request được xử lý
        const duration = Date.now() - startTime;
        const { statusCode } = response;

        this.logger.log(
          `← ${method} ${url} - ${statusCode} - ${duration}ms - ${userId} - ${userAgent}`,
          'Response'
        );
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        this.logger.error(
          `✗ ${method} ${url} - ${error.status || 500} - ${duration}ms - ${userId} - ${error.message}`,
          error.stack,
          'Error'
        );

        throw error;
      }),
    );
  }
}
