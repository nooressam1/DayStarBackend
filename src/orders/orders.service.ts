// src/orders/orders.service.ts
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/cartDto';
import { SupabaseService } from '../supabase/supabase.service';
import { orders } from './orders.interface';
import { EmailService } from 'src/Resend/emailservice';

@Injectable()
export class OrdersService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly emailService: EmailService,
  ) { }

  async processCheckout(userId: string, email: string, createOrderDto: CreateOrderDto) {
    const client = this.supabaseService.admin;
    const { items, city, area, address, floorNumber, apartmentNumber, couponCode, governorate, postalCode, fullName, phoneNumber, addressId } = createOrderDto;

    // 1. Validate items and fetch pricing info
    const { subTotal, orderItemsPayload } = await this.validateCartItems(client, items);

    // 2. Validate and calculate promo code discount
    const { discountId, discountAmount } = await this.validateAndCalculateDiscount(client, couponCode, subTotal);
    const finalTotal = Math.max(0, subTotal - discountAmount);

    try {
      // 3. Determine address ID (reuse existing address or create a new one)
      let finalAddressId: string;
      if (addressId) {
        finalAddressId = addressId;
      } else {
        finalAddressId = await this.createAddress(client, userId, { city, area, address, floorNumber, apartmentNumber, governorate, postalCode });
      }

      // 4. Create parent order header
      const createdOrder = await this.createOrder(client, userId, finalAddressId, finalTotal, discountId, discountAmount, fullName, phoneNumber);
      const orderId = createdOrder.id;
      const orderNumber = createdOrder.order_number || orderId.slice(0, 8).toUpperCase();

      // 5. Insert order line items
      await this.createOrderItems(client, orderId, orderItemsPayload);

      // Save phone number back to Supabase Auth metadata
      if (phoneNumber) {
        const { error: authError } = await client.auth.admin.updateUserById(userId, {
          phone: phoneNumber,
          user_metadata: { phone: phoneNumber }
        });
        if (authError) {
          console.error('Failed to save user phone to Supabase auth:', authError);
        }
      }

      // 6. Fetch phone number from Supabase Auth Admin
      let phone = phoneNumber || '';
      if (!phone) {
        try {
          const { data } = await client.auth.admin.getUserById(userId);
          phone = data?.user?.phone || data?.user?.user_metadata?.phone || '';
        } catch (e) {
          console.warn("Could not retrieve user phone details from Supabase admin auth:", e);
        }
      }

      // 7. Send order confirmation email asynchronously
      this.emailService.sendOrderConfirmation(email, {
        id: orderId,
        order_number: orderNumber,
        fullName: fullName || '',
        total: finalTotal,
        items: orderItemsPayload,
        email,
        phone,
        shippingAddress: {
          city,
          area,
          address,
          floorNumber,
          apartmentNumber,
          governorate,
          postalCode
        },
      }).catch(err => {
        console.error('Failed to send order confirmation email:', err);
      });

      return {
        success: true,
        orderId,
        orderNumber,
        total: finalTotal,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      console.error('Checkout transaction failure:', error);
      throw new InternalServerErrorException('Transaction execution engine error.');
    }
  }

  private async validateCartItems(client: any, items: any[]) {
    const variantIds = items.map((item) => item.variant_id);

    const { data: fetchedVariants, error: fetchError } = await client
      .from('variants')
      .select(`
        id,
        stock,
        size,
        product (
          id,
          name,
          price
        )
      `)
      .in('id', variantIds);

    if (fetchError || !fetchedVariants) {
      throw new BadRequestException('Could not verify cart items metadata.');
    }

    let subTotal = 0;
    const orderItemsPayload: { variant_id: string; quantity: number; unit_price_snapshot: number; name: string; size: string }[] = [];

    for (const item of items) {
      const dbVariant = fetchedVariants.find((v) => v.id === item.variant_id);

      if (!dbVariant) {
        throw new BadRequestException(`Selected variant package ${item.variant_id} is no longer available.`);
      }

      if (dbVariant.stock < item.quantity) {
        throw new BadRequestException(`Insufficient inventory stock for this item allocation request.`);
      }

      const parentProduct = dbVariant.product as unknown as { id: string; name: string; price: number };
      const secureLivePrice = parentProduct.price;

      subTotal += secureLivePrice * item.quantity;

      orderItemsPayload.push({
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price_snapshot: secureLivePrice,
        name: parentProduct.name,
        size: dbVariant.size || 'Standard',
      });
    }

    return { subTotal, orderItemsPayload };
  }

  private async validateAndCalculateDiscount(client: any, couponCode: string | undefined, subTotal: number) {
    let discountId: number | null = null;
    let discountAmount = 0;

    if (couponCode) {
      const { data: discountRecord, error: discountError } = await client
        .from('discount')
        .select('id, type, value, is_active')
        .eq('code', couponCode)
        .eq('is_active', true)
        .single();

      if (discountError || !discountRecord) {
        throw new BadRequestException('The promo code is invalid or has expired.');
      }

      discountId = discountRecord.id;

      if (discountRecord.type === 'percent') {
        discountAmount = subTotal * (discountRecord.value / 100);
      } else {
        discountAmount = discountRecord.value;
      }
    }

    return { discountId, discountAmount };
  }

  private async createAddress(client: any, userId: string, details: { city: string; area: string; address: string; floorNumber?: string; apartmentNumber?: string; governorate?: string; postalCode?: string }) {
    const { data: insertedAddress, error: addressError } = await client
      .from('addresses')
      .insert({
        user_id: userId,
        street: details.address,
        area: details.area,
        governorate: details.governorate || null,
        postal_code: details.postalCode || null,
        floor_number: details.floorNumber || null,
        apartment_number: details.apartmentNumber || null,
        city: details.city,
        country: 'Egypt',
        label: 'Checkout Address',
      })
      .select()
      .single();

    if (addressError || !insertedAddress) {
      console.error('Address creation failure:', addressError);
      throw new BadRequestException('Could not save shipping address.');
    }

    return insertedAddress.id;
  }

  private async createOrder(
    client: any,
    userId: string,
    addressId: string,
    finalTotal: number,
    discountId: number | null,
    discountAmount: number,
    fullName?: string,
    phoneNumber?: string,
  ) {
    const { data: insertedOrder, error: orderError } = await client
      .from('orders')
      .insert({
        user_id: userId,
        address_id: addressId,
        status: 'pending',
        total: finalTotal,
        discount_amount: discountAmount,
        discount_id: discountId,
        full_name: fullName,
        phone_number: phoneNumber,
      })
      .select()
      .single();

    if (orderError || !insertedOrder) {
      console.error('Order header creation failure:', orderError);
      throw new BadRequestException('Could not create order.');
    }

    return insertedOrder;
  }

  private async createOrderItems(client: any, orderId: string, orderItemsPayload: any[]) {
    const finalizedOrderItems = orderItemsPayload.map((item) => ({
      order_id: orderId,
      variant_id: item.variant_id,
      quantity: item.quantity,
      unit_price_snapshot: item.unit_price_snapshot,
    }));

    const { error: itemsError } = await client
      .from('order_item')
      .insert(finalizedOrderItems);

    if (itemsError) {
      console.error('Line items insertion failure:', itemsError);
      throw new BadRequestException('Could not create order items.');
    }
  }

  async getOrderById(userId: string, orderId: string, userEmail?: string) {
    const client = this.supabaseService.admin;

    const { data: orders, error: orderError } = await client
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

    if (orderError || !orders) {
      throw new BadRequestException('Order not found or access denied.');
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
      order_number: orders.order_number,
      items,
    };
  }
  async getAllOrders(userId: string, limit?: number, offset?: number) {
    const client = this.supabaseService.admin;
    let query = client.from("orders").select(`
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
      .eq("user_id", userId)
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
    return (orders || []).map((o) => ({
      ...o,
      order_number: o.order_number || o.id.slice(0, 8).toUpperCase(),
    }));
  }

  async getAllOrdersAdmin(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    const client = this.supabaseService.admin;
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
        status,
        total,
        full_name,
        phone_number,
        created_at
      `)
      .order('created_at', { ascending: false })
      .range(from, to);

    // Apply status filter
    if (params?.status) {
      countQuery = countQuery.eq('status', params.status);
      dataQuery = dataQuery.eq('status', params.status);
    }

    // Apply search filter (search by order_number, full_name, phone_number)
    if (params?.search) {
      const term = params.search.trim().replace(/^#/, '');
      if (term) {
        const isNumeric = /^\d+$/.test(term);
        const conditions = [
          `full_name.ilike.%${term}%`,
        ];

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

    const items = (orders || []).map((o) => ({
      ...o,
      order_number: o.order_number || o.id.slice(0, 8).toUpperCase(),
    }));

    return { items, total: count ?? 0 };
  }

  async getOrderByIdAdmin(orderId: string) {
    const client = this.supabaseService.admin;

    const { data: order, error: orderError } = await client
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

    const formattedItems = (items || []).map((item: any) => ({
      id: item.id,
      order_id: orderId,
      variant_id: item.variants?.id,
      quantity: item.quantity,
      unit_price_snapshot: item.unit_price_snapshot,
      product_name: item.variants?.product?.name || 'Product',
      sku: item.variants?.id ? `VAR-${item.variants.id.slice(0, 6).toUpperCase()}` : 'N/A',
      image: Array.isArray(item.variants?.product?.images) && item.variants?.product?.images.length > 0
        ? item.variants?.product?.images[0]
        : typeof item.variants?.product?.images === 'string'
          ? item.variants?.product?.images
          : undefined,
    }));

    return {
      ...order,
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
  async cancelOrder(orderID: string, userID: string) {
    const client = this.supabaseService.admin;
    const { data: order, error: OrderError } = await client.from("orders").select('id, status, user_id').eq('id', orderID).single();
    if (OrderError || !order) {
      throw new BadRequestException('Order Not found');
    }
    if (order.user_id !== userID) {
      throw new BadRequestException('Access denied.');

    }
    if (order.status !== 'pending') {
      throw new BadRequestException(`Cannot cancel order because it is already '${order.status}'.`);
    }
    const { data: updateOrder, error: UpdateError } = await client.from('orders').update({ status: 'cancelled' }).eq('id', orderID).select().single();

    if (UpdateError || !updateOrder) {
      throw new BadRequestException('Failed to cancel the order');
    }
    return {
      success: true,
      message: 'Order cancelled successfully',
      order: updateOrder,
    }
  }
}
