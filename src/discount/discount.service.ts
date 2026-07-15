import {
    Inject,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { discount } from './discount.interface';

@Injectable()
export class DiscountService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async findbycode(code: string): Promise<discount> {
        const response = await this.supabaseService.admin.from('discount').select('*').eq('code', code).eq('is_active', true).single()
        if (response.error) {
            throw new NotFoundException('discount not found ');
        }
        return response.data as discount;
    }

}