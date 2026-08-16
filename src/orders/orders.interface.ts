export interface Order {
  id: string;
  order_number: number;
  user_id: string;
  address_id: string;
  order_status: string;
  status?: string;
  total: number;
  discount_amount?: number;
  discount_id?: number | null;
  payment_method?: string;
  payment_status?: string;
  full_name?: string;
  phone_number?: string;
  cancel_reason?: string;
  created_at: string;
  updated_at?: string;
}

export interface OrderItemPayload {
  variant_id: string;
  quantity: number;
  unit_price_snapshot: number;
  name: string;
  size: string;
}

export interface CreateAddressParams {
  city: string;
  area: string;
  address: string;
  floorNumber?: string;
  apartmentNumber?: string;
  governorate?: string;
  postalCode?: string;
}

export interface CreateOrderPayload {
  user_id: string;
  address_id: string;
  order_status: string;
  status?: string;
  total: number;
  discount_amount: number;
  discount_id: number | null;
  full_name?: string;
  phone_number?: string;
  payment_method: string;
  payment_status: string;
}

export interface DbProductVariant {
  id: string;
  product_id?: string;
  size?: string;
  price: number;
  stock_quantity: number;
  product?: {
    id: string;
    name: string;
    price: number;
    images?: string[] | string;
  };
}

export interface DbDiscountRecord {
  id: number;
  code: string;
  type: string;
  value: number;
  is_active: boolean;
  active_start_date?: string;
  active_end_date?: string;
  min_requirement_type?: string;
  min_requirement_value?: string | number;
}

export interface DbAddress {
  id: string;
  street: string;
  building_no?: string;
  floor_number?: string;
  apartment_number?: string;
  area?: string;
  city: string;
  country: string;
  governorate?: string;
  postal_code?: string;
}

export interface DbOrderItemWithVariant {
  id: string;
  quantity: number;
  unit_price_snapshot: number;
  variants?:
    | {
        id: string;
        size?: string;
        product?:
          | {
              id: string;
              name: string;
              images?: string[] | string;
            }
          | {
              id: string;
              name: string;
              images?: string[] | string;
            }[];
      }
    | {
        id: string;
        size?: string;
        product?:
          | {
              id: string;
              name: string;
              images?: string[] | string;
            }
          | {
              id: string;
              name: string;
              images?: string[] | string;
            }[];
      }[];
}

export interface ProcessCheckoutResult {
  success: boolean;
  orderId: string;
  orderNumber: string;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
}