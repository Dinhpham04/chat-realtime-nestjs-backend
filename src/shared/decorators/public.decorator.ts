import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to mark routes as public (skip JWT authentication)
 */
export const Public = () => SetMetadata('isPublic', true);
