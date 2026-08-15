import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // 1. Get User Favorites (with full product metadata)
  async getUserFavorites(userId: string) {
    const { data, error } = await this.supabaseService.admin
      .from('favorites')
      .select('id, product_id, notify_on_sale, created_at, product:product_id (*, category:category_id ( id, name ), variants ( id, sku, stock, size ))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(`Failed to fetch favorites: ${error.message}`);
    }

    return (data || []).map((fav: any) => ({
      favorite_id: fav.id,
      notify_on_sale: fav.notify_on_sale,
      product: fav.product,
    }));
  }

  // 2. Add product to favorites
  async addFavorite(userId: string, productId: string, notifyOnSale = true) {
    const { data, error } = await this.supabaseService.admin
      .from('favorites')
      .upsert(
        {
          user_id: userId,
          product_id: productId,
          notify_on_sale: notifyOnSale,
        },
        { onConflict: 'user_id,product_id' }
      )
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to add favorite: ${error.message}`);
    }

    return { success: true, favorite: data };
  }

  // 3. Remove product from favorites
  async removeFavorite(userId: string, productId: string) {
    const { error } = await this.supabaseService.admin
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);

    if (error) {
      throw new BadRequestException(`Failed to remove favorite: ${error.message}`);
    }

    return { success: true };
  }

  // 4. Toggle notify_on_sale
  async toggleNotify(userId: string, notifyOnSale: boolean, productId?: string) {
    let query = this.supabaseService.admin
      .from('favorites')
      .update({ notify_on_sale: notifyOnSale })
      .eq('user_id', userId);

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { error } = await query;

    if (error) {
      throw new BadRequestException(`Failed to update notification settings: ${error.message}`);
    }

    return { success: true, notify_on_sale: notifyOnSale };
  }

  // 5. Sync guest favorites into user account on login
  async syncGuestFavorites(userId: string, productIds: string[]) {
    if (!productIds || productIds.length === 0) {
      return { success: true };
    }

    const records = productIds.map((productId) => ({
      user_id: userId,
      product_id: productId,
      notify_on_sale: true,
    }));

    const { error } = await this.supabaseService.admin
      .from('favorites')
      .upsert(records, { onConflict: 'user_id,product_id' });

    if (error) {
      throw new BadRequestException(`Failed to sync guest favorites: ${error.message}`);
    }

    return { success: true };
  }
}
