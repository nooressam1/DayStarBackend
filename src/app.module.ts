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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    SupabaseModule,
    AuthModule,
    MeModule,
    HealthModule,
    OrdersModule,
    AddressesModule,
    QuizModule,
    CustomersModule,
    CartModule,
  ],
  controllers: [ProductController, discountController, categoryController, ContactSubmissionsController, CustomersController],
  providers: [ProductService, DiscountService, CategoryService, ContactSubmissionsService, CustomersService],
})
export class AppModule { }
