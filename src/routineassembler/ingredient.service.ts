import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  Ingredient,
  IngredientConflict,
  IngredientWithConcerns,
  ProductIngredientDetail,
} from './ingredient.interface';

@Injectable()
export class IngredientService {
  private readonly logger = new Logger(IngredientService.name);

  constructor(private readonly supabaseService: SupabaseService) { }

  /**
   * Get all ingredients for a single product
   */
  async getProductIngredients(productId: string): Promise<ProductIngredientDetail[]> {
    const { data, error } = await this.supabaseService.admin
      .from('product_ingredients')
      .select(`
        ingredient_id,
        is_key_ingredient,
        ingredient:ingredients (
          *,
          concerns:ingredient_concerns (
            concern,
            relevance_weight
          )
        )
      `)
      .eq('product_id', productId);

    if (error) {
      this.logger.error(`Failed to fetch ingredients for product ${productId}:`, error);
      throw error;
    }

    return (data || []) as unknown as ProductIngredientDetail[];
  }

  /**
   * Batch fetch ingredients for multiple products
   * Returns a map of productId -> ProductIngredientDetail[]
   */
  async getProductsIngredients(productIds: string[]): Promise<Record<string, ProductIngredientDetail[]>> {
    if (!productIds || productIds.length === 0) {
      return {};
    }

    const { data, error } = await this.supabaseService.admin
      .from('product_ingredients')
      .select(`
        product_id,
        ingredient_id,
        is_key_ingredient,
        ingredient:ingredients (
          *,
          concerns:ingredient_concerns (
            concern,
            relevance_weight
          )
        )
      `)
      .in('product_id', productIds);


    if (error) {
      this.logger.error('Failed to batch fetch product ingredients:', error);
      throw error;
    }

    const result: Record<string, ProductIngredientDetail[]> = {};
    for (const pid of productIds) {
      result[pid] = [];
    }

    for (const row of data || []) {
      const pid = (row as any).product_id;
      if (!result[pid]) result[pid] = [];
      result[pid].push({
        ingredient_id: row.ingredient_id,
        is_key_ingredient: row.is_key_ingredient,
        ingredient: (row as any).ingredient,
      });
    }

    return result;
  }

  /**
   * Get an ingredient by ID with its addressed concerns
   */
  async getIngredientById(ingredientId: string): Promise<IngredientWithConcerns | null> {
    const { data: ingredient, error: ingError } = await this.supabaseService.admin
      .from('ingredients')
      .select('*')
      .eq('id', ingredientId)
      .maybeSingle();

    if (ingError) {
      this.logger.error(`Failed to fetch ingredient ${ingredientId}:`, ingError);
      throw ingError;
    }

    if (!ingredient) return null;

    const { data: concerns, error: concernError } = await this.supabaseService.admin
      .from('ingredient_concerns')
      .select('concern, relevance_weight')
      .eq('ingredient_id', ingredientId);

    if (concernError) {
      this.logger.error(`Failed to fetch concerns for ingredient ${ingredientId}:`, concernError);
      throw concernError;
    }

    return {
      ...(ingredient as Ingredient),
      concerns: concerns || [],
    };
  }

  /**
   * Find conflicts among a list of ingredient IDs
   */
  async getConflictsForIngredients(ingredientIds: string[]): Promise<IngredientConflict[]> {
    if (ingredientIds.length < 2) return [];

    const { data, error } = await this.supabaseService.admin
      .from('ingredient_conflicts')
      .select('ingredient_a_id, ingredient_b_id, conflict_type, notes')
      .in('ingredient_a_id', ingredientIds)
      .in('ingredient_b_id', ingredientIds);

    if (error) throw error;
    return data || [];
  }
}
