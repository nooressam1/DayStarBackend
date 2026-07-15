import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { EmailService } from '../Resend/emailservice';

@Module({
  imports: [SupabaseModule],
  controllers: [OrdersController],
  providers: [OrdersService, EmailService],
  exports: [OrdersService],
})
export class OrdersModule {}
