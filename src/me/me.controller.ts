import { Controller, Get, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

/**
 * Sample protected endpoint. Proves the full auth chain works:
 * frontend login -> JWT -> guard verification -> claims returned here.
 */
@Controller('me')
@UseGuards(SupabaseAuthGuard)
export class MeController {
  @Get()
  getProfile(@CurrentUser() user: unknown) {
    return { user };
  }
}
