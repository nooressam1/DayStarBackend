import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CheckoutService } from './services/checkout.service';
import { OrdersQueryService } from './services/orders-query.service';
import { OrdersAdminService } from './services/orders-admin.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { EmailService } from '../Resend/emailservice';

@Module({
  imports: [SupabaseModule],
  controllers: [OrdersController],
  providers: [
    CheckoutService,
    OrdersQueryService,
    OrdersAdminService,
    OrdersService,
    EmailService,
  ],
  exports: [
    CheckoutService,
    OrdersQueryService,
    OrdersAdminService,
    OrdersService,
  ],
})
export class OrdersModule {}
