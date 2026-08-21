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

    async findAll(
        page?: number,
        limit?: number,
        status?: string,
        search?: string,
    ) {
        const client = this.supabaseService.admin;

        // Base query for paginated list with total count
        let query = client
            .from('contact_submissions')
            .select('*', { count: 'exact' });

        // Filter by status if provided and not "all"
        if (status && status.toLowerCase() !== 'all' && status.toLowerCase() !== 'all statuses') {
            query = query.eq('status', status.toLowerCase());
        }

        // Filter by search query
        if (search && search.trim() !== '') {
            const q = search.trim();
            query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,subject.ilike.%${q}%,message.ilike.%${q}%`);
        }

        // Order by created_at DESC
        query = query.order('created_at', { ascending: false });

        // Apply pagination ranges if limit is provided
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 10;
        const from = (pageNum - 1) * limitNum;
        const to = from + limitNum - 1;

        query = query.range(from, to);

        const { data, count, error } = await query;

        if (error) {
            throw new InternalServerErrorException(`Failed to fetch contact submissions: ${error.message}`);
        }

        // Fetch KPI counts across all submissions
        const { data: allSubmissions } = await client
            .from('contact_submissions')
            .select('status');

        let pendingCount = 0;
        let inProgressCount = 0;
        let resolvedCount = 0;

        if (allSubmissions) {
            allSubmissions.forEach((s) => {
                if (s.status === 'pending') pendingCount++;
                else if (s.status === 'in_progress') inProgressCount++;
                else if (s.status === 'resolved') resolvedCount++;
            });
        }

        return {
            items: (data as ContactSubmission[]) || [],
            total: count || 0,
            page: pageNum,
            limit: limitNum,
            pendingCount,
            inProgressCount,
            resolvedCount,
        };
    }
}