import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { SupabaseService } from '../supabase/supabase.service'; // Adjust path if needed

@Module({
  controllers: [ProductController],
  providers: [ProductService, SupabaseService],
})
export class ProductModule {}
