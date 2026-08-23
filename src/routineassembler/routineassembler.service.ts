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
            const step = (product.step_type || '').toLowerCase();
            if (!grouped[step]) grouped[step] = [];
            grouped[step].push(product);
        }

        return grouped;
    }
    async scoreProduct(product: Product, profile: SkinProfile): Promise<number> {
        let score = 0;
        const userSkinType = (profile.skinType || (profile as any).skin_type || '').toLowerCase();
        
        if (userSkinType && Array.isArray(product.skin_type)) {
            const productTypes = product.skin_type.map(t => (t || '').toLowerCase());
            if (productTypes.includes(userSkinType) || productTypes.includes('all') || productTypes.includes('all skin types')) {
                score += 10;
            }
        }

        const userConcerns: string[] = Array.isArray(profile.concern)
            ? profile.concern.map(c => (c || '').toLowerCase())
            : Array.isArray((profile as any).concerns)
                ? (profile as any).concerns.map((c: string) => (c || '').toLowerCase())
                : [];

        if (Array.isArray(product.concern) && userConcerns.length > 0) {
            const productConcerns = product.concern.map(c => (c || '').toLowerCase());
            const matchedCount = productConcerns.filter(c => userConcerns.includes(c)).length;
            score += matchedCount * 5;
        }

        return score;
    }

    async assembleRoutine(profile: SkinProfile) {
        const groupProducts = await this.getProductsByStep();
        const steps = ['cleanser', 'toner', 'serum', 'treatment', 'moisturizer', 'spf'];
        const routine: Record<string, Product | null> = {};
        const recommendedProducts: Array<{ step: string; product: Product }> = [];

        for (const step of steps) {
            routine[step] = null;
            const productsInStep = groupProducts[step] ?? [];
            if (productsInStep.length === 0) continue;

            let highestScore = -1;
            let bestProduct: Product = productsInStep[0]; // default fallback to first product in step

            for (const step_product of productsInStep) {
                const score = await this.scoreProduct(step_product, profile);
                if (score > highestScore) {
                    highestScore = score;
                    bestProduct = step_product;
                }
            }

            routine[step] = bestProduct;
            recommendedProducts.push({
                step,
                product: bestProduct,
            });
        }

        console.log('✅ [RoutineAssembler] Generated routine with steps:', Object.keys(routine));

        return {
            ...routine,
            recommendedProducts,
        };
    }
}
