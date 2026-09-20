import { Controller, Get, Param, Query, Post, Patch, Body } from '@nestjs/common';
import { ProductService } from './product.service';
import { Product, Variant } from './product.interface';
import { ListProductsDto } from './dto/list_products.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { BulkUpdateProductDto } from './dto/bulk-update-product.dto';
import { UpdateProductDto } from './dto/updateProdtuctDto';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) { }

  @Post()
  async createProduct(@Body() dto: CreateProductDto): Promise<Product> {
    return this.productService.createProduct(dto);
  }

  @Patch('bulk')
  async bulkUpdateProducts(@Body() dto: BulkUpdateProductDto): Promise<Product[]> {
    return this.productService.bulkUpdateProducts(dto);
  }

  @Patch(':id')
  async updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<Product> {
    return this.productService.updateProduct(id, dto);
  }

  @Get()
  async getAllProducts(
    @Query() query: ListProductsDto,
  ): Promise<{ items: Product[]; total: number }> {
    return this.productService.allProducts(query);
  }

  // NOTE: specific routes MUST come before dynamic :slug to avoid shadowing
  @Get('best-sellers')
  async getBestSellers(): Promise<Product[]> {
    return this.productService.getBestSellers();
  }

  @Get('new-arrivals')
  async getNewArrivals(): Promise<Product[]> {
    return this.productService.getNewArrivals();
  }

  @Get(':id/variants')
  async getVariantsbyID(@Param('id') id: string): Promise<Variant[]> {
    return this.productService.getVariantbyProductId(id);
  }

  @Get(':slug')
  async getProductBySlug(@Param('slug') slug: string): Promise<Product> {
    return this.productService.findBySlug(slug);
  }
}
