import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateOrderDto, cartItemDto } from '../dto/cartDto';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  Order,
  OrderItemPayload,
  CreateAddressParams,
  CreateOrderPayload,
  DbProductVariant,
  DbDiscountRecord,
  ProcessCheckoutResult,
} from '../orders.interface';
import { EmailService } from '../../Resend/emailservice';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly emailService: EmailService,
  ) { }

  async processCheckout(
    userId: string,
    email: string,
    createOrderDto: CreateOrderDto,
  ): Promise<ProcessCheckoutResult> {
    const client: SupabaseClient = this.supabaseService.admin;
    const {
      items,
      city,
      area,
      address,
      floorNumber,
      apartmentNumber,
      couponCode,
      governorate,
      postalCode,
      fullName,
      phoneNumber,
      addressId,
      paymentMethod = 'cash',
      paymentStatus,
    } = createOrderDto;

    const resolvedPaymentMethod = paymentMethod === 'card' ? 'card' : 'cash';
    const resolvedPaymentStatus =
      resolvedPaymentMethod === 'card' ? 'paid' : (paymentStatus || 'pending');

    // 1. Validate items and fetch pricing info
    const { subTotal, orderItemsPayload } = await this.validateCartItems(client, items);

    // 2. Validate and calculate promo code discount
    const { discountId, discountAmount } = await this.validateAndCalculateDiscount(
      client,
      couponCode,
      subTotal,
    );
    const finalTotal = Math.max(0, subTotal - discountAmount);

    try {
      // 3. Determine address ID (reuse existing address or create a new one)
      let finalAddressId: string;
      if (addressId) {
        finalAddressId = addressId;
      } else {
        finalAddressId = await this.createAddress(client, userId, {
          city,
          area,
          address,
          floorNumber,
          apartmentNumber,
          governorate,
          postalCode,
        });
      }

      // 4. Create parent order header
      const createdOrder = await this.createOrder(
        client,
        userId,
        finalAddressId,
        finalTotal,
        discountId,
        discountAmount,
        fullName,
        phoneNumber,
        resolvedPaymentMethod,
        resolvedPaymentStatus,
      );
      const orderId = createdOrder.id;
      const orderNumber = String(createdOrder.order_number || orderId.slice(0, 8).toUpperCase());

      // 5. Insert order line items
      await this.createOrderItems(client, orderId, orderItemsPayload);

      // Save phone number back to Supabase Auth metadata
      if (phoneNumber) {
        const { error: authError } = await client.auth.admin.updateUserById(userId, {
          phone: phoneNumber,
          user_metadata: { phone: phoneNumber },
        });
        if (authError) {
          console.error('Failed to save user phone to Supabase auth:', authError);
        }
      }

      // 6. Fetch phone number from Supabase Auth Admin if not provided
      let phone = phoneNumber || '';
      if (!phone) {
        try {
          const { data } = await client.auth.admin.getUserById(userId);
          phone = data?.user?.phone || (data?.user?.user_metadata?.phone as string) || '';
        } catch (e) {
          console.warn('Could not retrieve user phone details from Supabase admin auth:', e);
        }
      }

      // 7. Send order confirmation email asynchronously
      this.emailService
        .sendOrderConfirmation(email, {
          id: orderId,
          order_number: orderNumber,
          fullName: fullName || '',
          total: finalTotal,
          payment_method: resolvedPaymentMethod,
          payment_status: resolvedPaymentStatus,
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
            postalCode,
          },
        })
        .catch((err: Error) => {
          console.error('Failed to send order confirmation email:', err);
        });

      return {
        success: true,
        orderId,
        orderNumber,
        total: finalTotal,
        paymentMethod: resolvedPaymentMethod,
        paymentStatus: resolvedPaymentStatus,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      console.error('Checkout transaction failure:', error);
      throw new InternalServerErrorException('Transaction execution engine error.');
    }
  }

  private async validateCartItems(
    client: SupabaseClient,
    items: cartItemDto[],
  ): Promise<{ subTotal: number; orderItemsPayload: OrderItemPayload[] }> {
    const variantIds = items.map((item) => item.variant_id);
    const { data: variantsData, error: variantsError } = await client
      .from('variants')
      .select('id, product_id, size, sku, stock')
      .in('id', variantIds);

    if (variantsError || !variantsData || variantsData.length === 0) {
      console.error('Failed to fetch variants from database:', variantsError);
      throw new BadRequestException('Could not retrieve product variants info for the order items.');
    }

    const productIds = Array.from(
      new Set(variantsData.map((v) => v.product_id).filter(Boolean)),
    );

    const { data: productsData, error: productsError } = await client
      .from('product')
      .select('id, name, price, on_sale, discount_percentage, images')
      .in('id', productIds);

    if (productsError || !productsData || productsData.length === 0) {
      console.error('Failed to fetch products for variants:', productsError);
      throw new BadRequestException('Could not retrieve product information for the order items.');
    }

    const productMap = new Map(productsData.map((p) => [p.id, p]));
    let subTotal = 0;
    const orderItemsPayload: OrderItemPayload[] = [];

    for (const item of items) {
      const variant = variantsData.find((v) => v.id === item.variant_id);
      if (!variant) {
        throw new BadRequestException(`Variant with id ${item.variant_id} does not exist.`);
      }

      const product = productMap.get(variant.product_id);
      if (!product) {
        throw new BadRequestException(`Product for variant ${item.variant_id} does not exist.`);
      }

      if (variant.stock !== undefined && variant.stock !== null && variant.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for item "${product.name || variant.id}". Only ${variant.stock} available.`,
        );
      }

      let unitPrice = Number(product.price) || 0;
      if (product.on_sale && product.discount_percentage && product.discount_percentage > 0) {
        unitPrice = Math.round(unitPrice * (1 - product.discount_percentage / 100));
      }

      subTotal += unitPrice * item.quantity;

      orderItemsPayload.push({
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price_snapshot: unitPrice,
        name: product.name || 'Skincare Product',
        size: variant.size || 'Standard',
      });
    }

    return { subTotal, orderItemsPayload };
  }

  private async validateAndCalculateDiscount(
    client: SupabaseClient,
    couponCode?: string,
    subTotal = 0,
  ): Promise<{ discountId: number | null; discountAmount: number }> {
    let discountId: number | null = null;
    let discountAmount = 0;

    if (couponCode && couponCode.trim()) {
      const cleanCode = couponCode.trim();
      const { data: discountRecord, error: discountError } = await client
        .from('discounts')
        .select('*')
        .eq('code', cleanCode)
        .eq('is_active', true)
        .maybeSingle();

      if (discountError || !discountRecord) {
        throw new BadRequestException('Invalid or inactive promo code.');
      }

      const typedDiscount = discountRecord as DbDiscountRecord;
      const now = new Date();

      if (typedDiscount.active_start_date && new Date(typedDiscount.active_start_date) > now) {
        throw new BadRequestException('This promo code is not active yet.');
      }

      if (typedDiscount.active_end_date && new Date(typedDiscount.active_end_date) < now) {
        throw new BadRequestException('This promo code has expired.');
      }

      if (
        typedDiscount.min_requirement_type === 'amount' &&
        typedDiscount.min_requirement_value &&
        subTotal < Number(typedDiscount.min_requirement_value)
      ) {
        throw new BadRequestException(
          `Minimum purchase amount of ${typedDiscount.min_requirement_value} is required to use this promo code.`,
        );
      }

      discountId = typedDiscount.id;

      if (typedDiscount.type === 'percent' || typedDiscount.type === 'Percentage') {
        discountAmount = subTotal * (typedDiscount.value / 100);
      } else if (typedDiscount.type === 'Free Shipping') {
        discountAmount = 0;
      } else {
        discountAmount = typedDiscount.value;
      }
    }

    return { discountId, discountAmount };
  }

  private async createAddress(
    client: SupabaseClient,
    userId: string,
    details: CreateAddressParams,
  ): Promise<string> {
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

    return insertedAddress.id as string;
  }

  private async createOrder(
    client: SupabaseClient,
    userId: string,
    addressId: string,
    finalTotal: number,
    discountId: number | null,
    discountAmount: number,
    fullName?: string,
    phoneNumber?: string,
    paymentMethod = 'cash',
    paymentStatus = 'pending',
  ): Promise<Order> {
    const payload: CreateOrderPayload = {
      user_id: userId,
      address_id: addressId,
      status: 'pending',
      total: finalTotal,
      discount_amount: discountAmount,
      discount_id: discountId,
      full_name: fullName,
      phone_number: phoneNumber,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
    };

    let { data: insertedOrder, error: orderError } = await client
      .from('orders')
      .insert(payload)
      .select()
      .single();

    if (orderError) {
      console.warn('Orders insert failed on full payload:', orderError.message);
      // Fallback: omit payment columns if they do not exist in the database table schema yet
      const { payment_method, payment_status, ...fallbackPayload } = payload;
      const fallbackRes = await client
        .from('orders')
        .insert(fallbackPayload)
        .select()
        .single();

      if (fallbackRes.error || !fallbackRes.data) {
        console.error('Order header creation failure:', fallbackRes.error || orderError);
        throw new BadRequestException(
          `Could not create order: ${fallbackRes.error?.message || orderError.message}`,
        );
      }

      insertedOrder = {
        ...fallbackRes.data,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
      };
    }

    return insertedOrder as Order;
  }

  private async createOrderItems(
    client: SupabaseClient,
    orderId: string,
    orderItemsPayload: OrderItemPayload[],
  ): Promise<void> {
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
}
