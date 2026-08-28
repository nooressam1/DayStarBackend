import { Product } from "src/product/product.interface";

export type TimeOfUse = 'day' | 'night' | 'either';

export type IngredientStrengthTier = 1 | 2 | 3;

export type ConflictType =
  | 'irritation_risk'
  | 'efficacy_reduction'
  | 'avoid_same_routine';

// 1. Master ingredient interface matching `ingredients` table
export interface Ingredient {
  id: string;
  name: string;
  inci_name?: string | null;
  time_of_use: TimeOfUse;
  photosensitizing: boolean;
  strength_tier: IngredientStrengthTier;
  requires_prescription: boolean;
  requires_spf_pairing: boolean;
  description?: string | null;
  created_at: string;
}

// 2. Concern mapping interface matching `ingredient_concerns` table
export interface IngredientConcern {
  ingredient_id: string;
  concern: string;
  relevance_weight: number;
}

// 3. Product ingredient mapping interface matching `product_ingredients` table
export interface ProductIngredient {
  product_id: string;
  ingredient_id: string;
  is_key_ingredient: boolean;
}

// 4. Ingredient conflict interface matching `ingredient_conflicts` table
export interface IngredientConflict {
  ingredient_a_id: string;
  ingredient_b_id: string;
  conflict_type: ConflictType;
  notes?: string | null;
}

// ============================================================
// Extended / Joined interfaces for Quiz & Routine Assembly
// ============================================================

export interface IngredientWithConcerns extends Ingredient {
  concerns?: Array<{
    concern: string;
    relevance_weight: number;
  }>;
}

export interface ProductIngredientDetail {
  ingredient_id: string;
  is_key_ingredient: boolean;
  ingredient: IngredientWithConcerns;
}


export interface ProductWithIngredients extends Product {
  ingredients: ProductIngredientDetail[];
}

export interface IngredientConflictDetail extends IngredientConflict {
  ingredient_a?: Ingredient;
  ingredient_b?: Ingredient;
}

