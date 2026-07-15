export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  images: string[];
  slug: string;
  price: number;
  created_at: string;
  is_active: boolean;
  on_sale?: boolean;
  skin_type: string[];
  concern: string[];
  step_type: string;
  discount_percentage?: number | null;
}

export interface Variant {
  id: string;
  product_id: string;
  size: string;
  price: number;
  sku: string;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  body: string;
  comment?: string | null;
  title: string;
  created_at?: string;
  date: string;
  timestamp: number;
  profile?: {
    username: string;
  };
}


