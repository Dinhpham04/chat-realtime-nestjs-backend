import { Injectable, CanActivate, ExecutionContext, Logger, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import Redis from 'ioredis';

/**
 * Refactor code to prevent hardcoding
 */

/**
 * Rate Limit Guard
 * Implements rate limiting to prevent abuse of auth endpoints
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  // Default rate limits for different endpoints
  private readonly defaultLimits = {
    '/auth/login': { requests: 5, window: 15 * 60 }, // 5 requests per 15 minutes
    '/auth/register': { requests: 3, window: 60 * 60 }, // 3 requests per hour
    '/auth/refresh-token': { requests: 10, window: 5 * 60 }, // 10 requests per 5 minutes
    'default': { requests: 20, window: 15 * 60 }, // 20 requests per 15 minutes
  };

  constructor(
    private readonly reflector: Reflector,
    @Inject('IOREDIS_CLIENT') private readonly redis: Redis,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Skip rate limiting for health checks
    if (request.url.includes('/health')) {
      return true;
    }

    const key = this.generateRateLimitKey(request);
    const limit = this.getRateLimitForEndpoint(request.url);

    try {
      const current = await this.incrementCounter(key, limit.window);

      // Set rate limit headers
      response.setHeader('X-RateLimit-Limit', limit.requests);
      response.setHeader('X-RateLimit-Remaining', Math.max(0, limit.requests - current));
      response.setHeader('X-RateLimit-Window', limit.window);

      if (current > limit.requests) {
        this.logger.warn(`Rate limit exceeded for ${key}: ${current}/${limit.requests}`);

        const ttl = await this.redis.ttl(`rate_limit:${key}`);
        response.setHeader('Retry-After', ttl);

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests. Please try again later.',
            retryAfter: ttl,
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Rate limiting error: ${error.message}`);
      // Allow request if Redis is unavailable (fail open)
      return true;
    }
  }

  private generateRateLimitKey(request: any): string {
    // Use IP address as primary identifier
    const ip = this.getClientIp(request);

    // For login/register, also include phone number to prevent targeted attacks
    if (request.body?.phoneNumber && (request.url.includes('/login') || request.url.includes('/register'))) {
      return `${ip}:${request.body.phoneNumber}:${request.url}`;
    }

    return `${ip}:${request.url}`;
  }

  private getClientIp(request: any): string {
    // Check various headers for real IP
    return (
      request.headers['cf-connecting-ip'] || // Cloudflare
      request.headers['x-real-ip'] || // Nginx
      request.headers['x-forwarded-for']?.split(',')[0] || // Load balancer
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }

  private getRateLimitForEndpoint(url: string): { requests: number; window: number } {
    // Find matching endpoint limit
    for (const [endpoint, limit] of Object.entries(this.defaultLimits)) {
      if (endpoint !== 'default' && url.includes(endpoint)) {
        return limit;
      }
    }

    return this.defaultLimits.default;
  }

  /**
   * 
   * @param key 
   * @param windowSeconds: time limit expire in seconds
   * @returns 
   */
  private async incrementCounter(key: string, windowSeconds: number): Promise<number> {
    const redisKey = `rate_limit:${key}`;

    // Use Redis pipeline for atomic operations
    const pipeline = this.redis.pipeline();
    pipeline.incr(redisKey); // instruction 1;
    pipeline.expire(redisKey, windowSeconds); // instruction 

    const results = await pipeline.exec(); // Execute both instructions atomically returning an array of results

    if (!results || results[0][1] === null) {
      throw new Error('Failed to increment rate limit counter');
    }

    return results[0][1] as number;
  }
}
