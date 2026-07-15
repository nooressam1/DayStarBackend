import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Optionally parses the Supabase access token. If present and valid,
 * attaches request.user. If absent or invalid, lets the request pass anyway
 * (for guest skin profile creation).
 */
@Injectable()
export class OptionalSupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);
    if (!token) {
      return true;
    }
    try {
      const claims = await this.supabase.verifyToken(token);
      (request as Request & { user?: unknown }).user = claims;
    } catch (error) {
      // If verification fails, treat as guest rather than returning 401
      console.warn("Optional auth verification failed:", error);
    }
    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    return scheme === 'Bearer' && token ? token : undefined;
  }
}
