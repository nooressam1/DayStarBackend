import { Controller, Get, Param, Query, Post, Body, UseGuards } from '@nestjs/common';
import { ProductService } from './product.service';
import { Product, Variant, Review } from './product.interface';
import { ListProductsDto } from './dto/list_products.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) { }
  @Get()
  async getAllProducts(
    @Query() query: ListProductsDto,
  ): Promise<{ items: Product[]; total: number }> {
    return this.productService.allProducts(query);
  }
  // NOTE: specific routes MUST come before dynamic `:slug` to avoid shadowing
  @Get('best-sellers')
  async getBestSellers(): Promise<Product[]> {
    return this.productService.getBestSellers();
  }
  @Get(':id/variants')
  async getVariantsbyID(@Param('id') id: string): Promise<Variant[]> {
    return this.productService.getVariantbyProductId(id);
  }
  @Get(':id/reviews')
  async getReviews(@Param('id') id: string): Promise<Review[]> {
    return this.productService.getReviews(id);
  }
  @Post(':id/reviews')
  @UseGuards(SupabaseAuthGuard)
  async postReview(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: CreateReviewDto,
  ): Promise<Review> {
    return this.productService.createReview(id, user.sub, dto);
  }
  @Get(':slug')
  async getProductBySlug(@Param('slug') slug: string): Promise<Product> {
    return this.productService.findBySlug(slug);
  }

}

