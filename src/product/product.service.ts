import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { Product, Variant, Review } from './product.interface';
import { ListProductsDto } from './dto/list_products.dto';
@Injectable()
export class ProductService {
  constructor(private readonly supabaseService: SupabaseService) { }

  async findBySlug(slug: string): Promise<Product> {
    // 1. Save the raw response into a single variable
    const response = await this.supabaseService.admin
      .from('product')
      .select('*')
      .eq('slug', slug)
      .single();

    // 2. Check the error property directly on that response object
    if (response.error || !response.data) {
      throw new NotFoundException(`Product with slug "${slug}" not found`);
    }

    // 3. Explicitly cast the final data asset right when you return it
    return response.data as Product;
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
    if (params.collection === 'on-sale' || params.collection === 'sale') {
      let countQuery = this.supabaseService.admin.from('product').select('*', { count: 'exact', head: true })
        .eq('is_active', true).eq('on_sale', true);
      if (params.discount) {
        countQuery = countQuery.eq('discount_percentage', params.discount);
      }
      if (params.categoryId) {
        countQuery = countQuery.eq('category_id', params.categoryId);
      }
      if (params.search) {
        countQuery = countQuery.ilike('name', `%${params.search}%`);
      }
      const { count, error: countError } = await countQuery;
      if (countError) throw new InternalServerErrorException('Failed to fetch count');

      const total = count ?? 0;
      if (from >= total) return { items: [], total }
      let dataQuery = this.supabaseService.admin.from('product').select('*').eq('is_active', true).eq('on_sale', true)
      if (params.discount) {
        dataQuery = dataQuery.eq('discount_percentage', params.discount);
      }
      if (params.categoryId) {
        dataQuery = dataQuery.eq('category_id', params.categoryId)
      }
      if (params.search) {
        dataQuery = dataQuery.ilike('name', `%${params.search}%`);
      }
      const { data: products, error: dataError } = await dataQuery.order('created_at', { ascending: false }).range(from, to);

      if (dataError) throw new InternalServerErrorException('Failed to fetch sale products');
      return { items: products as Product[], total };
    }

    let query = this.supabaseService.admin
      .from('product')
      .select(`*,  category:category_id ( id, name ), variants ( id, sku, stock )`, { count: 'exact' })
      .eq('is_active', true);

    if (params.categoryId) {
      query = query.eq('category_id', params.categoryId);
    }
    if (params.discount) {
      query = query.eq('discount_percentage', params.discount);
    }
    if (params.search) {
      query = query.ilike('name', `%${params.search}%`);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error("SUPABASE ERROR DETAILS:", JSON.stringify(error, null, 2));
      throw new InternalServerErrorException(`Failed to fetch products: ${error.message || JSON.stringify(error)}`);
    }
    console.log("TEST", data);
    return { items: (data || []) as Product[], total: count ?? (data?.length || 0) };
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
}
