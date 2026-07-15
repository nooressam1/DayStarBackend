import { SupabaseService } from "src/supabase/supabase.service";
import { discountController } from "./discount.controller";
import { DiscountService } from "./discount.service";
import { Module } from "@nestjs/common";

@Module({
    controllers: [discountController],
    providers: [DiscountService, SupabaseService],
})
export class ProductModule { }
