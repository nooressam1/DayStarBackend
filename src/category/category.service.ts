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
}