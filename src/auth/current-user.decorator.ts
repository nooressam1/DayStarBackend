import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Returns the verified Supabase user claims attached by SupabaseAuthGuard.
 * Usage: `getProfile(@CurrentUser() user) { ... }`
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    return request.user;
  },
);
