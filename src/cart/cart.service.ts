import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface ServerCartItem {
  variant_id: string;
  product_id: string;
  name: string;
  price: number;
  size: string;
  photo: string;
  quantity: number;
}

@Injectable()
export class CartService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // 1. Get or Create Cart ID for User
  async getOrCreateCartId(userId: string): Promise<string> {
    const { data: existingCart, error: fetchError } = await this.supabaseService.admin
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      throw new InternalServerErrorException(`Failed to fetch cart: ${fetchError.message}`);
    }

    if (existingCart) {
      return existingCart.id;
    }

    const { data: newCart, error: createError } = await this.supabaseService.admin
      .from('carts')
      .insert({ user_id: userId })
      .select('id')
      .single();

    if (createError) {
      throw new InternalServerErrorException(`Failed to create cart: ${createError.message}`);
    }

    return newCart.id;
  }

  // 2. Fetch User Cart Items
  async getUserCart(userId: string): Promise<ServerCartItem[]> {
    const cartId = await this.getOrCreateCartId(userId);

    const { data: cartItems, error } = await this.supabaseService.admin
      .from('cart_items')
      .select('*')
      .eq('cart_id', cartId);

    if (error) {
      throw new InternalServerErrorException(`Failed to fetch cart items: ${error.message}`);
    }

    if (!cartItems || cartItems.length === 0) {
      return [];
    }

    // Fetch products to map item details
    const { data: products } = await this.supabaseService.admin
      .from('product')
      .select('id, name, price, images');

    const result: ServerCartItem[] = cartItems.map((item) => {
      const matchedProduct = (products || []).find((p) => p.id === item.variant_id) || (products || [])[0];

      return {
        variant_id: item.variant_id,
        product_id: matchedProduct?.id || item.variant_id,
        name: matchedProduct?.name || 'Skincare Essential',
        price: matchedProduct?.price || 0,
        size: 'Standard',
        photo: matchedProduct?.images?.[0] || '',
        quantity: item.quantity,
      };
    });

    return result;
  }

  // 3. Upsert Single Cart Item
  async upsertItem(userId: string, variantId: string, quantity: number) {
    const cartId = await this.getOrCreateCartId(userId);

    const { data, error } = await this.supabaseService.admin
      .from('cart_items')
      .upsert(
        { cart_id: cartId, variant_id: variantId, quantity },
        { onConflict: 'cart_id,variant_id' }
      )
      .select();

    if (error) {
      throw new BadRequestException(`Failed to sync cart item: ${error.message}`);
    }

    return { success: true, data };
  }

  // 4. Remove Single Cart Item
  async removeItem(userId: string, variantId: string) {
    const cartId = await this.getOrCreateCartId(userId);

    const { error } = await this.supabaseService.admin
      .from('cart_items')
      .delete()
      .eq('cart_id', cartId)
      .eq('variant_id', variantId);

    if (error) {
      throw new BadRequestException(`Failed to remove cart item: ${error.message}`);
    }

    return { success: true };
  }

  // 5. Clear Entire Cart
  async clearCart(userId: string) {
    const cartId = await this.getOrCreateCartId(userId);

    const { error } = await this.supabaseService.admin
      .from('cart_items')
      .delete()
      .eq('cart_id', cartId);

    if (error) {
      throw new BadRequestException(`Failed to clear cart: ${error.message}`);
    }

    return { success: true };
  }

  // 6. Merge Guest Cart Items into User Cart
  async mergeGuestCart(userId: string, guestItems: Array<{ variant_id: string; quantity: number }>) {
    if (!guestItems || guestItems.length === 0) {
      return { success: true };
    }

    const cartId = await this.getOrCreateCartId(userId);

    const { data: existingItems } = await this.supabaseService.admin
      .from('cart_items')
      .select('*')
      .eq('cart_id', cartId);

    for (const item of guestItems) {
      const existing = (existingItems || []).find((e) => e.variant_id === item.variant_id);
      const newQty = existing ? existing.quantity + item.quantity : item.quantity;

      await this.supabaseService.admin
        .from('cart_items')
        .upsert(
          { cart_id: cartId, variant_id: item.variant_id, quantity: newQty },
          { onConflict: 'cart_id,variant_id' }
        );
    }

    return { success: true };
  }
}
