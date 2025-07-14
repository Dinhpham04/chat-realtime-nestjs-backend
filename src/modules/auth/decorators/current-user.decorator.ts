import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Current User Decorator
 * 
 * Following instruction-senior.md:
 * - Custom decorators for reusability
 * - Type-safe parameter extraction
 * - Clean code with single responsibility
 * 
 * Extracts the current authenticated user from the request object
 * after JWT authentication guard has processed the token.
 * 
 * @example
 * ```typescript
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * async getProfile(@CurrentUser() user: JwtUser) {
 *   return user;
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

/**
 * Current User ID Decorator
 * 
 * Convenience decorator to extract only the user ID
 * 
 * @example
 * ```typescript
 * @Get('devices')
 * @UseGuards(JwtAuthGuard)
 * async getUserDevices(@CurrentUserId() userId: string) {
 *   return this.deviceService.getUserDevices(userId);
 * }
 * ```
 */
export const CurrentUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.userId;
  },
);

/**
 * Current Device ID Decorator
 * 
 * Extracts the device ID from the current user's JWT token
 * 
 * @example
 * ```typescript
 * @Post('logout')
 * @UseGuards(JwtAuthGuard)
 * async logout(@CurrentDeviceId() deviceId: string) {
 *   return this.authService.logout(deviceId);
 * }
 * ```
 */
export const CurrentDeviceId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.deviceId;
  },
);
