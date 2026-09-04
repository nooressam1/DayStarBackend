import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase/supabase.service';
import { DbOrderItemWithVariant } from '../orders.interface';

@Injectable()
export class OrdersAdminService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getAllOrdersAdmin(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    const client: SupabaseClient = this.supabaseService.admin;
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 10;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Count query
    let countQuery = client
      .from('orders')
      .select('id', { count: 'exact', head: true });

    // Data query
    let dataQuery = client
      .from('orders')
      .select(`
        id,
        user_id,
        order_number,
        order_status,
        total,
        discount_amount,
        payment_method,
        payment_status,
        full_name,
        phone_number,
        created_at
      `)
      .order('created_at', { ascending: false })
      .range(from, to);

    // Apply status filter
    if (params?.status) {
      countQuery = countQuery.eq('order_status', params.status);
      dataQuery = dataQuery.eq('order_status', params.status);
    }

    // Apply search filter (search by order_number, full_name, phone_number)
    if (params?.search) {
      const term = params.search.trim().replace(/^#/, '');
      if (term) {
        const isNumeric = /^\d+$/.test(term);
        const conditions = [`full_name.ilike.%${term}%`];

        if (isNumeric) {
          const num = parseInt(term, 10);
          conditions.push(`order_number.eq.${num}`);
          conditions.push(`phone_number.eq.${num}`);
        }

        const searchFilter = conditions.join(',');
        countQuery = countQuery.or(searchFilter);
        dataQuery = dataQuery.or(searchFilter);
      }
    }

    const { count, error: countError } = await countQuery;
    if (countError) {
      throw new BadRequestException('Could not count orders.');
    }

    const { data: orders, error: orderError } = await dataQuery;
    if (orderError) {
      throw new BadRequestException('Could not retrieve orders.');
    }

    const items = (orders || []).map((o: Record<string, unknown>) => {
      const resolvedStatus = (o.order_status as string) || (o.status as string) || 'pending';
      return {
        ...o,
        status: resolvedStatus,
        order_status: resolvedStatus,
        order_number: (o.order_number as number) || (o.id as string).slice(0, 8).toUpperCase(),
      };
    });

    return { items, total: count ?? 0 };
  }

  async getOrderByIdAdmin(orderId: string) {
    const client: SupabaseClient = this.supabaseService.admin;

    const { data: order, error: orderError } = await client
      .from('orders')
      .select(`
        id,
        user_id,
        order_number,
        order_status,
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
          area,
          floor_number,
          apartment_number,
          city,
          country,
          governorate,
          postal_code
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new BadRequestException('Order not found.');
    }

    let userEmail: string | undefined = undefined;
    if (order.user_id) {
      try {
        const { data: userData } = await client.auth.admin.getUserById(order.user_id);
        if (userData?.user?.email) {
          userEmail = userData.user.email;
        }
      } catch (err) {
        console.warn('Could not fetch user auth email:', err);
      }
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

    const typedItems = (items || []) as unknown as DbOrderItemWithVariant[];
    const formattedItems = typedItems.map((item) => {
      const variant = Array.isArray(item.variants) ? item.variants[0] : item.variants;
      const product = Array.isArray(variant?.product) ? variant?.product[0] : variant?.product;
      return {
        id: item.id,
        order_id: orderId,
        variant_id: variant?.id,
        quantity: item.quantity,
        unit_price_snapshot: item.unit_price_snapshot,
        product_name: product?.name || 'Product',
        sku: variant?.id ? `VAR-${variant.id.slice(0, 6).toUpperCase()}` : 'N/A',
        image:
          Array.isArray(product?.images) && product.images.length > 0
            ? product.images[0]
            : typeof product?.images === 'string'
              ? product.images
              : undefined,
      };
    });

    const resolvedStatus = order.order_status || (order as Record<string, unknown>).status || 'pending';

    return {
      ...order,
      status: resolvedStatus,
      order_status: resolvedStatus,
      order_number: order.order_number || order.id.slice(0, 8).toUpperCase(),
      user: {
        id: order.user_id,
        full_name: order.full_name,
        email: userEmail,
      },
      user_email: userEmail,
      items: formattedItems,
      address: order.addresses,
    };
  }

  async updateOrderStatusAdmin(orderId: string, status: string, reason?: string) {
    const client: SupabaseClient = this.supabaseService.admin;
    const { data: order, error: orderError } = await client
      .from('orders')
      .select('id, order_status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new BadRequestException('Order not found.');
    }

    const payload: { order_status: string } = { order_status: status };

    const { data: updatedOrder, error: updateError } = await client
      .from('orders')
      .update(payload)
      .eq('id', orderId)
      .select()
      .single();

    if (updateError || !updatedOrder) {
      console.error('Failed to update order status:', updateError);
      throw new BadRequestException(`Failed to update order status: ${updateError?.message || 'Unknown error'}`);
    }

    return {
      success: true,
      message: `Order status updated to '${status}'`,
      order: {
        ...updatedOrder,
        status: updatedOrder.order_status,
      },
    };
  }

  async cancelOrderAdmin(orderId: string, reason?: string) {
    return this.updateOrderStatusAdmin(orderId, 'cancelled', reason);
  }

  async completePaymentAdmin(orderId: string) {
    return this.updateOrderStatusAdmin(orderId, 'delivered');
  }

  async completeDeliveryAdmin(orderId: string) {
    return this.updateOrderStatusAdmin(orderId, 'delivered');
  }
}
