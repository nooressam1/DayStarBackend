import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { Product } from 'src/product/product.interface';
import { SkinProfile } from 'src/routineassembler/skinProfile.interface';
import { IngredientService } from './ingredient.service';
import { ProductWithIngredients } from './ingredient.interface';

export type SensitivityTier = 'high' | 'moderate' | 'all';

export type SensitivityBuckets = {
    high: ProductWithIngredients[];
    moderate: ProductWithIngredients[];
    all: ProductWithIngredients[];
};

export type StepBuckets = {
    day: SensitivityBuckets;
    night: SensitivityBuckets;
    either: SensitivityBuckets;
};

const emptyBuckets = (): SensitivityBuckets => ({
    high: [],
    moderate: [],
    all: [],
});

@Injectable()
export class RoutineAssemblerService {
    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly ingredientService: IngredientService,
    ) { }

    /**
     * Resolves the user profile's sensitivity bucket key:
     * - `high`: Highly sensitive / redness-prone / sensitive skin type
     * - `moderate`: Moderately sensitive / occasional reaction
     * - `all`: Resilient / tolerant to standard formulations
     */
    getSensitivityBucketKeyForProfile(profile: SkinProfile): SensitivityTier {
        const rawSensitivity = (profile.sensitivity || '').toLowerCase();
        const userSkinType = (profile.skinType || (profile as any).skin_type || '').toLowerCase();

        if (
            userSkinType === 'sensitive' ||
            ['high', 'highly_sensitive', 'very sensitive', 'sensitive'].includes(rawSensitivity)
        ) {
            return 'high';
        }

        if (
            ['moderate', 'moderately_sensitive', 'unpredictable', 'medium'].includes(rawSensitivity)
        ) {
            return 'moderate';
        }

        return 'all';
    }

    /**
     * Determines if a product is safe for daytime use (e.g. not photosensitizing or night-only)
     */
    isProductSuitableForDay(product: ProductWithIngredients): boolean {
        const hasNightOnlyOrPhotosensitizing = product.ingredients.some(
            pi => pi.ingredient?.time_of_use === 'night' || pi.ingredient?.photosensitizing === true,
        );

        return !hasNightOnlyOrPhotosensitizing;
    }

    /**
     * Determines if a product is safe for nighttime use (e.g. not SPF)
     */
    isProductSuitableForNight(product: ProductWithIngredients): boolean {
        const step = (product.step_type || '').toLowerCase();
        if (step === 'spf' || step === 'sunscreen') {
            return false;
        }

        const hasDayOnly = product.ingredients.some(
            pi => pi.ingredient?.time_of_use === 'day',
        );

        return !hasDayOnly;
    }

    /**
     * Determines which sensitivity buckets a product qualifies for based on tags & ingredient strengths
     */
    getSensitivityBucketKeysForProduct(product: ProductWithIngredients): SensitivityTier[] {
        const skinTypes = (product.skin_type || []).map((t: string) => (t || '').toLowerCase());
        const isExplicitlySensitiveSafe =
            skinTypes.includes('sensitive') ||
            skinTypes.includes('all') ||
            skinTypes.includes('all skin types');

        const maxIngredientStrength = product.ingredients.reduce((max, pi) => {
            const tier = pi.ingredient?.strength_tier || 1;
            return tier > max ? tier : max;
        }, 1);

        const keys: SensitivityTier[] = ['all'];

        // Gentle / Sensitive-safe (no harsh Tier 3 actives)
        if (isExplicitlySensitiveSafe && maxIngredientStrength < 3) {
            keys.push('high', 'moderate');
        } else if (isExplicitlySensitiveSafe || maxIngredientStrength <= 2) {
            keys.push('moderate');
        }

        return keys;
    }

    /**
     * Groups products by step_type, time_of_use (day/night/either), and sensitivity in a single pass.
     * Returns: Record<step, StepBuckets>
     */
    async getProductsGroupedByStepAndSensitivity(): Promise<Record<string, StepBuckets>> {
        const { data: products, error } = await this.supabaseService.admin
            .from('product')
            .select('*, variants ( id, sku, stock, size )');

        if (error) throw error;

        // Batch fetch ingredients for all products in one query
        const productIds = (products || []).map(p => p.id);
        const ingredientsByProduct = await this.ingredientService.getProductsIngredients(productIds);

        const grouped: Record<string, StepBuckets> = {};

        for (const product of products || []) {
            const step = (product.step_type || '').toLowerCase();
            const ingredients = ingredientsByProduct[product.id] || [];
            const withIngredients: ProductWithIngredients = { ...product, ingredients };

            if (!grouped[step]) {
                grouped[step] = { day: emptyBuckets(), night: emptyBuckets(), either: emptyBuckets() };
            }

            const qualifyingSensitivityKeys = this.getSensitivityBucketKeysForProduct(withIngredients);
            const suitableForDay = this.isProductSuitableForDay(withIngredients);
            const suitableForNight = this.isProductSuitableForNight(withIngredients);

            // Populate 'either' bucket (products safe for BOTH day and night)
            if (suitableForDay && suitableForNight) {
                for (const key of qualifyingSensitivityKeys) {
                    grouped[step].either[key].push(withIngredients);
                }
            }

            // Populate day buckets
            if (suitableForDay) {
                for (const key of qualifyingSensitivityKeys) {
                    grouped[step].day[key].push(withIngredients);
                }
            }

            // Populate night buckets
            if (suitableForNight) {
                for (const key of qualifyingSensitivityKeys) {
                    grouped[step].night[key].push(withIngredients);
                }
            }
        }

        return grouped;
    }

    /**
     * Scores a product based on whether the step is an Active treatment step or a Barrier/Protection step.
     */
    scoreProduct(product: ProductWithIngredients, profile: SkinProfile, step: string): number {
        let score = 0;
        const normalizedStep = (step || product.step_type || '').toLowerCase();
        const userSkinType = (profile.skinType || (profile as any).skin_type || '').toLowerCase();

        const userConcerns: string[] = Array.isArray(profile.concern)
            ? profile.concern.map(c => (c || '').toLowerCase())
            : Array.isArray((profile as any).concerns)
                ? (profile as any).concerns.map((c: string) => (c || '').toLowerCase())
                : [];

        const isActiveStep = ['serum', 'treatment', 'toner'].includes(normalizedStep);
        const isBarrierStep = ['cleanser', 'moisturizer', 'spf', 'sunscreen'].includes(normalizedStep);

        const productSkinTypes = (product.skin_type || []).map(t => (t || '').toLowerCase());
        const productConcerns = (product.concern || []).map(c => (c || '').toLowerCase());

        // 1. KEY ACTIVE INGREDIENT VERIFICATION
        const keyIngredients = (product.ingredients || []).filter(pi => pi.is_key_ingredient);
        let keyActiveMatchScore = 0;
        let hasDirectActiveMatch = false;

        for (const keyIng of keyIngredients) {
            const ingConcerns = (keyIng.ingredient?.concerns || []).map(c => ({
                concern: (c.concern || '').toLowerCase(),
                weight: Number(c.relevance_weight) || 1,
            }));

            for (const userConcern of userConcerns) {
                const match = ingConcerns.find(
                    ic => ic.concern.includes(userConcern) || userConcern.includes(ic.concern),
                );
                if (match) {
                    hasDirectActiveMatch = true;
                    // Boost based on key active relevance weight (1 to 3)
                    keyActiveMatchScore += match.weight * 10;
                }
            }
        }

        // 2. ACTIVE STEPS SPECIALIZATION (Serum, Treatment, Toner)
        if (isActiveStep) {
            // Major boost when key active ingredients directly target the user's primary concerns
            if (hasDirectActiveMatch) {
                score += 30 + keyActiveMatchScore;
            }

            // General product concern tag matching
            const matchedTagCount = productConcerns.filter(c =>
                userConcerns.some(uc => uc.includes(c) || c.includes(uc)),
            ).length;
            score += matchedTagCount * 8;

            // Skin type compatibility for active steps
            if (userSkinType && productSkinTypes.includes(userSkinType)) {
                score += 10;
            } else if (productSkinTypes.includes('all') || productSkinTypes.includes('all skin types')) {
                score += 5;
            }
        }

        // 3. BARRIER / PROTECTION STEPS SPECIALIZATION (Cleanser, Moisturizer, SPF)
        if (isBarrierStep) {
            // High priority on exact skin type compatibility
            if (userSkinType && productSkinTypes.includes(userSkinType)) {
                score += 25;
            } else if (productSkinTypes.includes('all') || productSkinTypes.includes('all skin types')) {
                score += 12;
            }

            // Barrier support & soothing ingredient detection (Ceramides, Centella, Hyaluronic, Glycerin, Panthenol, Squalane)
            const hasBarrierIngredients = (product.ingredients || []).some(pi => {
                const name = (pi.ingredient?.name || '').toLowerCase();
                const inci = (pi.ingredient?.inci_name || '').toLowerCase();
                return /ceramide|hyaluronic|centella|panthenol|glycerin|squalane|cica|allantoin|oat|lipid|peptide/i.test(
                    name + ' ' + inci,
                );
            });

            if (hasBarrierIngredients) {
                score += 12;
            }

            // General concern matching for barrier steps
            const matchedTagCount = productConcerns.filter(c =>
                userConcerns.some(uc => uc.includes(c) || c.includes(uc)),
            ).length;
            score += matchedTagCount * 5;
        }

        // 4. GRANULAR TIE-BREAKER: Product rating (e.g. 4.8 / 5.0)
        if (product.rating) {
            score += Math.min(5, Math.max(0, Number(product.rating)));
        }

        return score;
    }

    async assembleRoutine(profile: SkinProfile, time: string = 'day') {
        const groupedProducts = await this.getProductsGroupedByStepAndSensitivity();
        const userSensitivity = this.getSensitivityBucketKeyForProfile(profile);

        const safeTime = (time || 'day').toLowerCase();
        const isMorning = safeTime.includes('morning') || safeTime.includes('day');
        const timeKey: 'day' | 'night' = isMorning ? 'day' : 'night';

        const routineSteps: Record<'day' | 'night', string[]> = {
            day: ['cleanser', 'toner', 'serum', 'treatment', 'moisturizer', 'spf'],
            night: ['cleanser', 'serum', 'treatment', 'moisturizer'],
        };

        const steps = routineSteps[timeKey];

        const routine: Record<string, ProductWithIngredients | null> = {};
        const recommendedProducts: Array<{ step: string; product: ProductWithIngredients }> = [];

        for (const step of steps) {
            routine[step] = null;
            const stepBucket = groupedProducts[step];
            if (!stepBucket) continue;

            const timeSensitivityBuckets = stepBucket[timeKey];
            if (!timeSensitivityBuckets) continue;

            // Pick products from user's sensitivity group, falling back to 'all' if empty
            const candidateProducts =
                timeSensitivityBuckets[userSensitivity]?.length > 0
                    ? timeSensitivityBuckets[userSensitivity]
                    : timeSensitivityBuckets.all;

            if (candidateProducts.length === 0) continue;

            // Score all candidates for this specific step
            const scoredCandidates = candidateProducts.map(cand => ({
                product: cand,
                score: this.scoreProduct(cand, profile, step),
            }));

            // Find the highest score
            const highestScore = Math.max(...scoredCandidates.map(c => c.score));

            // Collect top candidates within 1.5 points of the top score (tied matches)
            const topCandidates = scoredCandidates.filter(c => c.score >= highestScore - 1.5);

            // Select dynamically/randomly among top matches for variety
            const selectedMatch =
                topCandidates[Math.floor(Math.random() * topCandidates.length)].product;

            routine[step] = selectedMatch;
            recommendedProducts.push({
                step,
                product: selectedMatch,
            });
        }

        console.log(`✅ [RoutineAssembler] Generated ${timeKey} routine with steps:`, Object.keys(routine));

        return {
            ...routine,
            recommendedProducts,
        };
    }

    /**
     * Assembles a complete dual regimen containing both Morning (AM) and Evening (PM) routines.
     */
    async assembleFullRoutine(profile: SkinProfile) {
        const morning = await this.assembleRoutine(profile, 'day');
        const evening = await this.assembleRoutine(profile, 'night');

        // Combine unique products across both routines
        const seenProductIds = new Set<string>();
        const allRecommendedProducts: Array<{ step: string; product: ProductWithIngredients; time: 'morning' | 'evening' | 'both' }> = [];

        for (const item of morning.recommendedProducts || []) {
            if (item.product?.id) {
                seenProductIds.add(item.product.id);
                allRecommendedProducts.push({
                    ...item,
                    time: 'morning',
                });
            }
        }

        for (const item of evening.recommendedProducts || []) {
            if (item.product?.id) {
                if (seenProductIds.has(item.product.id)) {
                    // Product is shared in both morning and evening (e.g. gentle cleanser or moisturizer)
                    const existing = allRecommendedProducts.find(p => p.product.id === item.product.id);
                    if (existing) existing.time = 'both';
                } else {
                    seenProductIds.add(item.product.id);
                    allRecommendedProducts.push({
                        ...item,
                        time: 'evening',
                    });
                }
            }
        }

        return {
            morning,
            evening,
            allRecommendedProducts,
            recommendedProducts: allRecommendedProducts, // backwards compatibility
        };
    }
}


