import { SupabaseService } from "src/supabase/supabase.service";

import { Module } from "@nestjs/common";
import { categoryController } from "./category.controller";
import { CategoryService } from "./category.service";

@Module({
    controllers: [categoryController],
    providers: [CategoryService, SupabaseService],
})
export class CategoryModule { }
