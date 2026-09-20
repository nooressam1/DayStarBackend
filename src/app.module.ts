import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from './config/env.validation';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { MeModule } from './me/me.module';
import { HealthModule } from './health/health.module';
import { ProductController } from './product/product.controller';
import { ProductService } from './product/product.service';
import { discountController } from './discount/discount.controller';
import { DiscountService } from './discount/discount.service';
import { categoryController } from './category/category.controller';
import { CategoryService } from './category/category.service';
import { OrdersModule } from './orders/orders.module';
import { AddressesModule } from './addresses/addresses.module';
import { QuizModule } from './routineassembler/QuizModule';
import { CustomersModule } from './customers/customers.module';
import { CustomersController } from './customers/customers.controller';
import { CustomersService } from './customers/customers.service';
import { ContactSubmissionsController } from './contact_submissions/contact_submissions.controller';
import { ContactSubmissionsService } from './contact_submissions/contact_submissions.service';
import { CartModule } from './cart/cart.module';
import { FavoritesModule } from './favorites/favorites.module';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsModule } from './jobs/jobs.module';
import { GroqModule } from './groq/groq.module';
import { ReviewModule } from './review/review.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'; // <-- 1. Import Throttler
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds (1 minute window)
        limit: 60,  // Max 60 requests per minute for normal routes
      },
    ]),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    ScheduleModule.forRoot(),
    SupabaseModule,
    AuthModule,
    MeModule,
    HealthModule,
    OrdersModule,
    AddressesModule,
    QuizModule,
    CustomersModule,
    CartModule,
    FavoritesModule,
    JobsModule,
    GroqModule,
    ReviewModule,
  ],
  controllers: [ProductController, discountController, categoryController, ContactSubmissionsController, CustomersController],
  providers: [ProductService, DiscountService, CategoryService, ContactSubmissionsService, CustomersService, {
    provide: APP_GUARD,
    useClass: ThrottlerGuard,
  },],
})
export class AppModule { }
