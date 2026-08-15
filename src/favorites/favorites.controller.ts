import { Controller, Get, Post, Delete, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { ToggleNotifyDto } from './dto/toggle-notify.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('favorites')
@UseGuards(SupabaseAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  async getFavorites(@CurrentUser() user: any) {
    return this.favoritesService.getUserFavorites(user.sub);
  }

  @Post(':productId')
  async addFavorite(
    @CurrentUser() user: any,
    @Param('productId') productId: string,
    @Body('notify_on_sale') notifyOnSale?: boolean,
  ) {
    return this.favoritesService.addFavorite(user.sub, productId, notifyOnSale ?? true);
  }

  @Delete(':productId')
  async removeFavorite(
    @CurrentUser() user: any,
    @Param('productId') productId: string,
  ) {
    return this.favoritesService.removeFavorite(user.sub, productId);
  }

  @Patch('notify')
  async toggleNotify(
    @CurrentUser() user: any,
    @Body() dto: ToggleNotifyDto,
  ) {
    return this.favoritesService.toggleNotify(user.sub, dto.notify_on_sale, dto.product_id);
  }

  @Post('sync')
  async syncGuestFavorites(
    @CurrentUser() user: any,
    @Body('productIds') productIds: string[],
  ) {
    return this.favoritesService.syncGuestFavorites(user.sub, productIds || []);
  }
}
