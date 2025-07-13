import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to extract user information from JWT token
 */
export const CurrentUser = createParamDecorator(
  // data: means the name of the property to extract from the user object
  // ctx: ExecutionContext provides access to the request object
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);

/**
 * Interface for JWT user payload
 */
export interface JwtUser {
  userId: string;
  phoneNumber: string;
  deviceId: string;
  roles: string[];
}
