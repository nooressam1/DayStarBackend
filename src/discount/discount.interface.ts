import { DiscountType, DiscountMinRequirement } from './discount.enum';

export { DiscountType, DiscountMinRequirement };

export interface discount {
  id: string;
  code: string;
  title?: string;
  value: number;
  type: DiscountType | string;
  created_at: string;
  is_active?: boolean;
  min_requirement_type?: DiscountMinRequirement | string;
  min_requirement_value?: number;
  start_date?: string;
  end_date?: string;
}