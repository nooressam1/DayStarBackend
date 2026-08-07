import {
    Injectable,
    InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { category } from './category.interface';

@Injectable()
export class CategoryService {
    constructor(
        private readonly supabaseService: SupabaseService,
    ) { }

    async getCategories(): Promise<category[]> {
        try {
            const { data, error } = await this.supabaseService.admin
                .from('category')
                .select('*');
            if (error) throw error;
            return data as category[];
        } catch (error) {
            throw new InternalServerErrorException(error);
        }
    }

    async createCategory(dto: any): Promise<category> {
        try {
            const payload = {
                name: dto.name,
                slug: dto.slug,
                photo: dto.photo || null,
            };

            const { data, error } = await this.supabaseService.admin
                .from('category')
                .insert(payload)
                .select()
                .single();

            if (error) throw error;
            return data as category;
        } catch (error: any) {
            throw new InternalServerErrorException(error?.message || 'Failed to create category');
        }
    }
}