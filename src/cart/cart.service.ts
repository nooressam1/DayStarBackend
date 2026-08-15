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

  // 2. Fetch User Cart Items with Accurate Variant & Product Resolution
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

    // Fetch all variants and products to accurately resolve variant details
    const { data: variants } = await this.supabaseService.admin
      .from('variants')
      .select('*, product:product_id ( id, name, price, images )');

    const { data: products } = await this.supabaseService.admin
      .from('product')
      .select('id, name, price, images');

    const result: ServerCartItem[] = cartItems.map((item) => {
      // 1. Match by variant_id in variants table
      const matchedVariant = (variants || []).find((v) => v.id === item.variant_id);
      if (matchedVariant) {
        const prod = matchedVariant.product || (products || []).find((p) => p.id === matchedVariant.product_id);
        return {
          variant_id: matchedVariant.id,
          product_id: matchedVariant.product_id,
          name: prod?.name || 'Skincare Essential',
          price: prod?.price || 0,
          size: matchedVariant.size || 'Standard',
          photo: prod?.images?.[0] || '',
          quantity: item.quantity,
        };
      }

      // 2. Match by variant_id equaling product_id directly
      const matchedProduct = (products || []).find((p) => p.id === item.variant_id);
      if (matchedProduct) {
        return {
          variant_id: matchedProduct.id,
          product_id: matchedProduct.id,
          name: matchedProduct.name,
          price: matchedProduct.price,
          size: 'Standard',
          photo: matchedProduct.images?.[0] || '',
          quantity: item.quantity,
        };
      }

      // 3. Fallback for custom or unlinked item (never replace with arbitrary products[0])
      return {
        variant_id: item.variant_id,
        product_id: item.variant_id,
        name: 'Skincare Essential',
        price: 0,
        size: 'Standard',
        photo: '',
        quantity: item.quantity,
      };
    });

    return result;
  }

  // 3. Upsert Single Cart Item
  async upsertItem(userId: string, variantId: string, quantity: number) {
    const cartId = await this.getOrCreateCartId(userId);
    const cappedQuantity = Math.min(5, Math.max(1, quantity));

    const { data, error } = await this.supabaseService.admin
      .from('cart_items')
      .upsert(
        { cart_id: cartId, variant_id: variantId, quantity: cappedQuantity },
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
      const computedQty = existing ? existing.quantity + item.quantity : item.quantity;
      const newQty = Math.min(5, Math.max(1, computedQty));

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
