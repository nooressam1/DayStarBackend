import {
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ContactSubmission } from './contact_submissions.interface';
import { CreateContactSubmissionDto, UpdateContactSubmissionDto } from './contact_submissionsDTO';

@Injectable()
export class ContactSubmissionsService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async createContactSubmission(dto: CreateContactSubmissionDto): Promise<ContactSubmission> {
        const { data, error } = await this.supabaseService.admin
            .from('contact_submissions')
            .insert([dto])
            .select()
            .single();

        if (error) {
            throw new InternalServerErrorException(`Failed to create contact submission: ${error.message}`);
        }

        return data as ContactSubmission;
    }

    async updateContactSubmission(id: string, dto: UpdateContactSubmissionDto): Promise<ContactSubmission> {
        const updateData: any = { ...dto };
        if (dto.status === 'resolved' && !dto.resolved_at) {
            updateData.resolved_at = new Date().toISOString();
        }

        const { data, error } = await this.supabaseService.admin
            .from('contact_submissions')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new NotFoundException(`Contact submission with ID "${id}" not found or update failed: ${error.message}`);
        }

        return data as ContactSubmission;
    }

    async findAll(): Promise<ContactSubmission[]> {
        const { data, error } = await this.supabaseService.admin
            .from('contact_submissions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw new InternalServerErrorException(`Failed to fetch contact submissions: ${error.message}`);
        }

        return data as ContactSubmission[];
    }
}