import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class OrdersQueryService {
  constructor(private readonly supabaseService: SupabaseService) { }

  async getOrderById(userId: string, orderId: string, userEmail?: string) {
    const client: SupabaseClient = this.supabaseService.admin;

    let { data: orders, error: orderError } = await client
      .from('orders')
      .select(`
        id,
        user_id,
        order_number,
        status,
        total,
        discount_amount,
        payment_method,
        payment_status,
        full_name,
        phone_number,
        created_at,
        addresses (
          id,
          street,
          building_no,
          city,
          country
        )
      `)
      .eq('id', orderId)
      .eq('user_id', userId)
      .single();

    if (orderError || !orders) {
      // Fallback query if payment columns don't exist in Supabase schema yet
      const fallbackQuery = await client
        .from('orders')
        .select(`
          id,
          user_id,
          order_number,
          status,
          total,
          discount_amount,
          full_name,
          phone_number,
          created_at,
          addresses (
            id,
            street,
            building_no,
            city,
            country
          )
        `)
        .eq('id', orderId)
        .eq('user_id', userId)
        .single();

      if (fallbackQuery.error || !fallbackQuery.data) {
        console.error('Order query error:', fallbackQuery.error || orderError);
        throw new BadRequestException('Order not found or access denied.');
      }

      orders = {
        ...fallbackQuery.data,
        payment_method: 'cash',
        payment_status: 'pending',
      };
    }

    const { data: items, error: itemsError } = await client
      .from('order_item')
      .select(`
        id,
        quantity,
        unit_price_snapshot,
        variants (
          id,
          size,
          product (
            id,
            name,
            images
          )
        )
      `)
      .eq('order_id', orderId);

    if (itemsError) {
      throw new BadRequestException('Could not retrieve order items.');
    }

    return {
      ...orders,
      email: userEmail || null,
      order_number: orders.order_number || orders.id.slice(0, 8).toUpperCase(),
      items,
    };
  }

  async getAllOrders(userId: string, limit?: number, offset?: number) {
    const client: SupabaseClient = this.supabaseService.admin;
    let query = client
      .from('orders')
      .select(`
        id,
        user_id,
        order_number,
        status,
        total,
        discount_amount,
        full_name,
        phone_number,
        created_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (limit !== undefined) {
      const from = offset ?? 0;
      const to = from + limit - 1;
      query = query.range(from, to);
    }

    const { data: orders, error: orderError } = await query;
    if (orderError) {
      throw new BadRequestException('could not retrieve orders');
    }

    return (orders || []).map((o: Record<string, unknown>) => ({
      ...o,
      order_number: (o.order_number as number) || (o.id as string).slice(0, 8).toUpperCase(),
    }));
  }

  async cancelOrder(orderID: string, userID: string) {
    const client: SupabaseClient = this.supabaseService.admin;
    const { data: order, error: OrderError } = await client
      .from('orders')
      .select('id, status, user_id')
      .eq('id', orderID)
      .single();

    if (OrderError || !order) {
      throw new BadRequestException('Order Not found');
    }
    if (order.user_id !== userID) {
      throw new BadRequestException('Access denied.');
    }
    if (order.status !== 'pending') {
      throw new BadRequestException(`Cannot cancel order because it is already '${order.status}'.`);
    }

    const { data: updateOrder, error: UpdateError } = await client
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderID)
      .select()
      .single();

    if (UpdateError || !updateOrder) {
      throw new BadRequestException('Failed to cancel the order');
    }

    return {
      success: true,
      message: 'Order cancelled successfully',
      order: updateOrder,
    };
  }
}
