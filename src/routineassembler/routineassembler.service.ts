// routine-assembler.service.ts
import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service'; // however you access supabase in Nest
import { Product } from 'src/product/product.interface';
import { SkinProfile } from 'src/routineassembler/skinProfile.interface';

@Injectable()
export class RoutineAssemblerService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async getProductsByStep() {
        const { data: products, error } = await this.supabaseService.admin
            .from('product')
            .select('*');

        if (error) throw error;

        // group products into { cleanser: [...], treatment: [...], ... }
        const grouped: Record<string, any[]> = {};
        for (const product of products) {
            const step = product.step_type;
            if (!grouped[step]) grouped[step] = [];
            grouped[step].push(product);
        }

        return grouped;
    }
    async scoreProduct(product: Product, profile: SkinProfile): Promise<number> {
        let score = 0
        if (product.skin_type.includes(profile.skin_type)
        ) {
            score += 10;
        }
        if (product.concern?.filter((c) => profile.concern.includes(c))) {
            score += 5
        }
        return score;

    }
    async assembleRoutine(profile: SkinProfile) {
        //get the group piles
        const groupProducts = await this.getProductsByStep();
        const steps = ['cleanser', 'toner', 'serum', 'treatment', 'moisturizer', 'spf']
        const routine: Record<string, Product | null> = {}

        let savedNumber = 0;
        for (const step of steps) {
            savedNumber = 0;
            routine[step] = null;
            console.log("testing products");
            const productsInStep = groupProducts[step] ?? [];
            for (const step_product of productsInStep) {
                const checkedProduct = await this.scoreProduct(step_product, profile);
                if (checkedProduct > savedNumber) {
                    savedNumber = checkedProduct;
                    routine[step] = step_product;
                }
                console.log("testing products");

            }

        }
        console.log("testing routine", routine);

        return routine;
    }
}
