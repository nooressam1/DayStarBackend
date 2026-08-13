import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { CartService } from './cart.service';
import { SyncCartItemDto } from './dto/sync-cart-item.dto';
import { MergeGuestCartDto } from './dto/merge-guest-cart.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('cart')
@UseGuards(SupabaseAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@CurrentUser() user: any) {
    return this.cartService.getUserCart(user.sub);
  }

  @Post('item')
  async syncItem(@CurrentUser() user: any, @Body() dto: SyncCartItemDto) {
    return this.cartService.upsertItem(user.sub, dto.variant_id, dto.quantity);
  }

  @Delete('item/:variantId')
  async removeItem(@CurrentUser() user: any, @Param('variantId') variantId: string) {
    return this.cartService.removeItem(user.sub, variantId);
  }

  @Delete('clear')
  async clearCart(@CurrentUser() user: any) {
    return this.cartService.clearCart(user.sub);
  }

  @Post('merge')
  async mergeGuestCart(@CurrentUser() user: any, @Body() dto: MergeGuestCartDto) {
    return this.cartService.mergeGuestCart(user.sub, dto.items);
  }
}
