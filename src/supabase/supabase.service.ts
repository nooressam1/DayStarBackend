import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  /**
   * Privileged client built with the SECRET key. Bypasses Row Level Security,
   * so it must only ever be used on the server. Use this for DB reads/writes.
   */
  public admin!: SupabaseClient;

  /**
   * Lightweight client built with the PUBLISHABLE key, used solely to verify
   * incoming user JWTs against the project's JWKS endpoint.
   */
  private verifier!: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.getOrThrow<string>('SUPABASE_URL');
    const secretKey = this.config.getOrThrow<string>('SUPABASE_SECRET_KEY');
    const publishableKey = this.config.getOrThrow<string>(
      'SUPABASE_PUBLISHABLE_KEY',
    );

    const serverAuth = { persistSession: false, autoRefreshToken: false };
    this.admin = createClient(url, secretKey, { auth: serverAuth });
    this.verifier = createClient(url, publishableKey, { auth: serverAuth });
  }

  /**
   * Verifies a Supabase access token (JWT) against the project's JWKS endpoint
   * and returns its claims (sub = user id, email, role, etc.). Throws if invalid.
   */
  async verifyToken(accessToken: string) {
    const { data, error } = await this.verifier.auth.getClaims(accessToken);
    if (error || !data) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return data.claims;
  }
}
