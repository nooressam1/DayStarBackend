import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { Product, Variant, Review } from './product.interface';
import { ListProductsDto } from './dto/list_products.dto';
import { BulkUpdateProductDto } from './dto/bulk-update-product.dto';
import { UpdateProductDto } from './dto/updateProdtuctDto';
@Injectable()
export class ProductService {
  constructor(private readonly supabaseService: SupabaseService) { }

  async findBySlug(identifier: string): Promise<Product> {
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(identifier);

    let query = this.supabaseService.admin
      .from('product')
      .select('*, category:category_id ( id, name ), variants ( id, sku, stock, size )');

    if (isUuid) {
      query = query.eq('id', identifier);
    } else {
      query = query.eq('slug', identifier);
    }

    const { data, error } = await query.maybeSingle();

    if (data) {
      return data as Product;
    }

    // Fallback: search by id if searching by slug returned nothing
    const { data: fallbackData } = await this.supabaseService.admin
      .from('product')
      .select('*, category:category_id ( id, name ), variants ( id, sku, stock, size )')
      .eq('id', identifier)
      .maybeSingle();

    if (fallbackData) {
      return fallbackData as Product;
    }

    throw new NotFoundException(`Product "${identifier}" not found`);
  }

  private applyProductFilters(query: any, params: ListProductsDto) {
    if (params.categoryId) query = query.eq('category_id', params.categoryId);
    if (params.discount) query = query.eq('discount_percentage', params.discount);
    if (params.search) query = query.ilike('name', `%${params.search}%`);
    return query;
  }

  async allProducts(
    params: ListProductsDto,
  ): Promise<{ items: Product[]; total: number }> {
    console.log("ALL PRODUCTS PARAMS:", params);
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    if (params.collection === 'best-sellers') {
      const allBestSellers = await this.getBestSellers(100);
      let filtered = allBestSellers;
      if (params.search) {
        filtered = allBestSellers.filter(p =>
          p.name.toLowerCase().includes(params.search!.toLowerCase())
        );
      }
      const total = filtered.length;
      const paginatedItems = filtered.slice(from, from + limit);
      return { items: paginatedItems, total };
    }

    const isSale = params.collection === 'on-sale' || params.collection === 'sale';
    const includeInactive =
      ['true', '1', true].includes(params.includeInactive as any) ||
      ['true', '1', true].includes(params.all as any);

    let countQuery = this.supabaseService.admin
      .from('product')
      .select('*', { count: 'exact', head: true });
    let dataQuery = this.supabaseService.admin
      .from('product')
      .select(`*, category:category_id ( id, name ), variants ( id, sku, stock )`);

    if (isSale) {
      countQuery = countQuery.eq('on_sale', true);
      dataQuery = dataQuery.eq('on_sale', true);
    }
    if (!includeInactive) {
      countQuery = countQuery.eq('is_active', true);
      dataQuery = dataQuery.eq('is_active', true);
    }

    countQuery = this.applyProductFilters(countQuery, params);
    dataQuery = this.applyProductFilters(dataQuery, params);

    const { count, error: countError } = await countQuery;
    if (countError) throw new InternalServerErrorException('Failed to fetch product count');

    const total = count ?? 0;
    if (from >= total) return { items: [], total };

    const { data, error } = await dataQuery
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new InternalServerErrorException(`Failed to fetch products: ${error.message}`);
    }

    return { items: (data || []) as Product[], total };
  }
  async getVariantbyProductId(productid: string): Promise<Variant[]> {
    const { data, error } = await this.supabaseService.admin.from('variants').select(`*`).eq(`product_id`, productid);
    if (error || !data) {
      throw new NotFoundException(`no variants found for product ${productid}`);
    }
    return data as Variant[];
  }
  // in product.service.ts
  async getBestSellers(limit = 4): Promise<Product[]> {
    const { data, error } = await this.supabaseService.admin.rpc('get_best_sellers', { p_limit: limit });

    if (error || !data || data.length === 0) {
      const { data: newest } = await this.supabaseService.admin
        .from('product')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(limit);
      return (newest ?? []) as Product[];
    }
    return data as Product[];
  }

  async getReviews(productId: string): Promise<Review[]> {
    const { data, error } = await this.supabaseService.admin
      .from('review')
      .select('*, profile(username)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(`Failed to fetch reviews: ${error.message}`);
    }

    return (data || []) as Review[];
  }

  async createReview(
    productId: string,
    userId: string,
    reviewData: { rating: number; title: string; body: string },
  ): Promise<Review> {
    const now = new Date();
    const dateEpoch = Math.floor(now.getTime() / 1000);
    const timeString = now.toTimeString().split(' ')[0];

    const reviewToInsert = {
      product_id: productId,
      user_id: userId,
      rating: reviewData.rating,
      title: reviewData.title,
      body: reviewData.body,
      comment: reviewData.body,
      date: dateEpoch,
      timestamp: timeString,
    };
    console.log("testing data");
    const { data, error } = await this.supabaseService.admin
      .from('review')
      .insert(reviewToInsert)
      .select('*, profile(username)')
      .single();

    if (error) {
      throw new InternalServerErrorException(`Failed to create review: ${error.message}`);
    }

    return data as Review;
  }

  async createProduct(dto: any): Promise<Product> {
    const trimmedName = dto.name.trim();

    const { data: existingProduct } = await this.supabaseService.admin
      .from('product')
      .select('id, name')
      .ilike('name', trimmedName)
      .limit(1);

    if (existingProduct && existingProduct.length > 0) {
      throw new BadRequestException(`A product with the name "${trimmedName}" already exists.`);
    }

    const slug = dto.slug || trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');

    const priceInCents = Math.round((Number(dto.price) || 0) * 100);

    const productPayload = {
      name: dto.name,
      description: dto.description,
      category_id: dto.category_id,
      images: dto.images ?? [],
      price: priceInCents,
      slug,
      is_active: dto.is_active ?? true,
      on_sale: dto.on_sale ?? false,
      discount_percentage: dto.discount_percentage ?? null,
      skin_type: dto.skin_type ?? [],
      concern: dto.concern ?? [],
      step_type: dto.step_type,
    };

    const { data: newProduct, error: productError } = await this.supabaseService.admin
      .from('product')
      .insert(productPayload)
      .select('*')
      .single();

    if (productError || !newProduct) {
      throw new InternalServerErrorException(`Failed to create product: ${productError?.message}`);
    }

    if (dto.variants && dto.variants.length > 0) {
      const variantsToInsert = dto.variants.map((v: any) => {
        const item: any = {
          product_id: newProduct.id,
          size: v.size,
          sku: v.sku,
          stock: v.stock,
        };
        return item;
      });

      console.log('Inserting variants into Supabase:', JSON.stringify(variantsToInsert, null, 2));

      const { data: insertedVariants, error: variantError } = await this.supabaseService.admin
        .from('variants')
        .insert(variantsToInsert)
        .select('*');

      if (variantError) {
        // Rollback: Delete newly created product if variant creation fails
        await this.supabaseService.admin
          .from('product')
          .delete()
          .eq('id', newProduct.id);

        console.error('Failed to create variants error details:', JSON.stringify(variantError, null, 2));
        throw new InternalServerErrorException(`Failed to create variants: ${variantError.message || JSON.stringify(variantError)}`);
      }

      console.log('Successfully created variants:', insertedVariants);
    }

    return newProduct as Product;
  }

  async bulkUpdateProducts(dto: BulkUpdateProductDto): Promise<Product[]> {
    const { ids, ...updates } = dto;
    if (!ids || ids.length === 0) {
      throw new BadRequestException('No product IDs provided for bulk update.');
    }

    const updateData: Record<string, any> = {};
    Object.entries(updates).forEach(([key, val]) => {
      if (val !== undefined) {
        updateData[key] = val;
      }
    });

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No update fields provided.');
    }

    const { data, error } = await this.supabaseService.admin
      .from('product')
      .update(updateData)
      .in('id', ids)
      .select();

    if (error) {
      throw new InternalServerErrorException(`Failed bulk update: ${error.message}`);
    }

    return data as Product[];
  }
  async updateProduct(id: string, dto: UpdateProductDto): Promise<Product> {
    if (!id) {
      throw new BadRequestException('No product ID provided for update.');
    }

    const { variants, ...updates } = dto;
    const updateData: Record<string, any> = {};

    Object.entries(updates).forEach(([key, val]) => {
      if (val !== undefined) {
        if (key === 'price' && typeof val === 'number') {
          updateData.price = Math.round(val * 100);
        } else if (key === 'name' && typeof val === 'string' && val.trim()) {
          updateData.name = val.trim();
          updateData.slug = val
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-');
        } else {
          updateData[key] = val;
        }
      }
    });

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await this.supabaseService.admin
        .from('product')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        throw new InternalServerErrorException(`Failed to update product: ${updateError.message}`);
      }
    }

    if (variants !== undefined && variants.length > 0) {
      for (const variantDto of variants) {
        const variantUpdateData: Record<string, any> = {};
        if (variantDto.size !== undefined) variantUpdateData.size = variantDto.size;
        if (variantDto.sku !== undefined) variantUpdateData.sku = variantDto.sku;
        if (variantDto.stock !== undefined) variantUpdateData.stock = Number(variantDto.stock);

        if (Object.keys(variantUpdateData).length > 0) {
          let query = this.supabaseService.admin.from('variants').update(variantUpdateData);
          if (variantDto.id) {
            query = query.eq('id', variantDto.id);
          } else if (variantDto.sku) {
            query = query.eq('sku', variantDto.sku).eq('product_id', id);
          } else {
            continue;
          }
          const { error: vErr } = await query;
          if (vErr) {
            console.error(`Failed to update variant: ${vErr.message}`);
          }
        }
      }
    }

    const { data: updatedProduct, error: fetchError } = await this.supabaseService.admin
      .from('product')
      .select('*, category:category_id ( id, name ), variants ( id, sku, stock, size )')
      .eq('id', id)
      .single();

    if (fetchError || !updatedProduct) {
      throw new NotFoundException(`Product with ID ${id} not found after update.`);
    }

    return updatedProduct as Product;
  }
}
