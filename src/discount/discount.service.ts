import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { discount } from './discount.interface';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import { ListDiscountsDto } from './dto/list-discounts.dto';

@Injectable()
export class DiscountService {
  constructor(private readonly supabaseService: SupabaseService) { }

  async getAllDiscounts(): Promise<discount[]> {
    const response = await this.supabaseService.admin
      .from('discount')
      .select('*')
      .order('created_at', { ascending: false });

    if (response.error) {
      throw new InternalServerErrorException(response.error.message);
    }
    return (response.data as discount[]) || [];
  }

  async getPaginatedDiscounts(
    params: ListDiscountsDto,
  ): Promise<{ items: discount[]; total: number }> {
    const page = params.page ? Math.max(1, params.page) : 1;
    const limit = params.limit ? Math.max(1, params.limit) : 10;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let countQuery = this.supabaseService.admin
      .from('discount')
      .select('*', { count: 'exact', head: true });

    let dataQuery = this.supabaseService.admin
      .from('discount')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    // Apply search filter
    if (params.search && params.search.trim()) {
      const term = params.search.trim();
      countQuery = countQuery.ilike('code', `%${term}%`);
      dataQuery = dataQuery.ilike('code', `%${term}%`);
    }

    // Apply type filter
    if (params.type && params.type !== 'All Types' && params.type !== 'all') {
      countQuery = countQuery.eq('type', params.type);
      dataQuery = dataQuery.eq('type', params.type);
    }

    // Apply status filter
    if (params.status && params.status !== 'All Statuses' && params.status !== 'all') {
      const now = new Date().toISOString();
      if (params.status.toLowerCase() === 'active') {
        countQuery = countQuery.eq('is_active', true);
        dataQuery = dataQuery.eq('is_active', true);
      } else if (params.status.toLowerCase() === 'scheduled') {
        countQuery = countQuery.gt('active_start_date', now);
        dataQuery = dataQuery.gt('active_start_date', now);
      } else if (params.status.toLowerCase() === 'expired') {
        countQuery = countQuery.lt('active_end_date', now);
        dataQuery = dataQuery.lt('active_end_date', now);
      }
    }

    const [{ count, error: countError }, { data, error: dataError }] = await Promise.all([
      countQuery,
      dataQuery,
    ]);

    if (countError) {
      throw new InternalServerErrorException(countError.message);
    }
    if (dataError) {
      throw new InternalServerErrorException(dataError.message);
    }

    return {
      items: (data as discount[]) || [],
      total: count || 0,
    };
  }

  async findbycode(code: string): Promise<discount> {
    const formattedCode = code.trim().toUpperCase();

    const response = await this.supabaseService.admin
      .from('discount')
      .select('*')
      .ilike('code', formattedCode)
      .single();

    if (response.error || !response.data) {
      throw new NotFoundException('Discount not found');
    }
    return response.data as discount;
  }

  async createDiscount(dto: CreateDiscountDto): Promise<discount> {
    const formattedCode = dto.code.trim().toUpperCase();

    // Check code uniqueness in database
    const existing = await this.supabaseService.admin
      .from('discount')
      .select('id')
      .ilike('code', formattedCode)
      .maybeSingle();

    if (existing.data) {
      throw new ConflictException(
        'This discount code already exists. Discount codes cannot be repeated.'
      );
    }

    const payload = {
      code: formattedCode,
      type: dto.type,
      value: dto.value,
      created_at: new Date().toISOString(),
      is_active: dto.is_active ?? true,
      min_requirement_type: dto.min_requirement_type,
      min_requirement_value: dto.min_requirement_value,
      active_start_date: dto.active_start_date,
      active_end_date: dto.active_end_date,
    };

    const response = await this.supabaseService.admin
      .from('discount')
      .insert(payload)
      .select()
      .single();

    if (response.error) {
      throw new InternalServerErrorException(response.error.message);
    }
    return response.data as discount;
  }

  async updateDiscount(id: string, dto: UpdateDiscountDto): Promise<discount> {
    const payload: Record<string, any> = {};

    if (dto.code !== undefined) {
      const formattedCode = dto.code.trim().toUpperCase();
      // Check code uniqueness excluding current record
      const existing = await this.supabaseService.admin
        .from('discount')
        .select('id')
        .ilike('code', formattedCode)
        .neq('id', id)
        .maybeSingle();

      if (existing.data) {
        throw new ConflictException(
          'This discount code already exists. Discount codes cannot be repeated.'
        );
      }
      payload.code = formattedCode;
    }

    if (dto.type !== undefined) payload.type = dto.type;
    if (dto.value !== undefined) payload.value = dto.value;
    if (dto.is_active !== undefined) payload.is_active = dto.is_active;
    if (dto.min_requirement_type !== undefined) payload.min_requirement_type = dto.min_requirement_type;
    if (dto.min_requirement_value !== undefined) payload.min_requirement_value = dto.min_requirement_value;
    if (dto.active_start_date !== undefined) payload.active_start_date = dto.active_start_date;
    if (dto.active_end_date !== undefined) payload.active_end_date = dto.active_end_date;

    const response = await this.supabaseService.admin
      .from('discount')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (response.error) {
      throw new InternalServerErrorException(response.error.message);
    }
    return response.data as discount;
  }

  async deleteDiscount(id: string): Promise<{ success: boolean }> {
    const response = await this.supabaseService.admin
      .from('discount')
      .delete()
      .eq('id', id);

    if (response.error) {
      throw new InternalServerErrorException(response.error.message);
    }
    return { success: true };
  }
}