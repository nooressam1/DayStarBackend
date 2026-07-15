import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';

/**
 * Provides and exports SupabaseAuthGuard so feature modules can protect routes.
 * (SupabaseService is injected from the global SupabaseModule.)
 */
@Module({
  providers: [SupabaseAuthGuard],
  exports: [SupabaseAuthGuard],
})
export class AuthModule {}
