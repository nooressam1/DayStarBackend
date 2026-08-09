import {
    Injectable,
    InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { category } from './category.interface';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

function toStatusBool(statusVal: any): boolean | undefined {
    if (statusVal === undefined || statusVal === null) return undefined;
    if (typeof statusVal === 'boolean') return statusVal;
    const str = String(statusVal).trim().toLowerCase();
    if (str === 'active' || str === 'true') return true;
    if (str === 'inactive' || str === 'false') return false;
    return Boolean(statusVal);
}

function formatCategory(item: any): category {
    if (!item) return item;
    return {
        ...item,
        status: typeof item.status === 'boolean'
            ? (item.status ? 'Active' : 'Inactive')
            : (item.status || 'Active'),
    };
}

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
            return (data || []).map(formatCategory);
        } catch (error) {
            throw new InternalServerErrorException(error);
        }
    }

    async createCategory(dto: CreateCategoryDto): Promise<category> {
        try {
            const payload: any = {
                name: dto.name,
                slug: dto.slug,
                photo: dto.photo || null,
            };
            if (dto.status !== undefined) {
                payload.status = toStatusBool(dto.status);
            }

            const { data, error } = await this.supabaseService.admin
                .from('category')
                .insert(payload)
                .select()
                .single();

            if (error) throw error;
            return formatCategory(data);
        } catch (error: any) {
            throw new InternalServerErrorException(error?.message || 'Failed to create category');
        }
    }

    async updateCategory(id: string, dto: UpdateCategoryDto): Promise<category> {
        try {
            const payload: Record<string, any> = {};
            if (dto.name !== undefined) payload.name = dto.name;
            if (dto.slug !== undefined) payload.slug = dto.slug;
            if (dto.photo !== undefined) payload.photo = dto.photo;
            if (dto.status !== undefined) payload.status = toStatusBool(dto.status);

            const { data, error } = await this.supabaseService.admin
                .from('category')
                .update(payload)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return formatCategory(data);
        } catch (error: any) {
            throw new InternalServerErrorException(error?.message || 'Failed to update category');
        }
    }

    async deleteCategory(id: string): Promise<{ success: boolean }> {
        try {
            const { error } = await this.supabaseService.admin
                .from('category')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { success: true };
        } catch (error: any) {
            throw new InternalServerErrorException(error?.message || 'Failed to delete category');
        }
    }
}