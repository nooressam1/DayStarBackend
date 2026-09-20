export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  body: string;
  comment?: string | null;
  title: string;
  created_at?: string;
  date?: string | number;
  timestamp?: string | number;
  username?: string;
  product_name?: string;
  profile?: any;
  product?: any;
}
