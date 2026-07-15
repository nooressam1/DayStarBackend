// skin-profile.service.ts
import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SkinProfile } from './skinProfile.interface';

@Injectable()
export class SkinProfileService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async create(profile: Partial<SkinProfile>): Promise<SkinProfile> {
        const { data, error } = await this.supabaseService.admin
            .from('skin_profile')
            .insert(profile)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
}