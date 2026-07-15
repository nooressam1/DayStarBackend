import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { ContactSubmissionsService } from './contact_submissions.service';
import { ContactSubmission } from './contact_submissions.interface';
import { CreateContactSubmissionDto, UpdateContactSubmissionDto } from './contact_submissionsDTO';
@Controller('contact_submissions')
export class ContactSubmissionsController {
    constructor(private readonly contactSubmissionsService: ContactSubmissionsService) { }
    @Post()
    async create(
        @Body() dto: CreateContactSubmissionDto,
    ): Promise<ContactSubmission> {
        return this.contactSubmissionsService.createContactSubmission(dto);
    }
    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateContactSubmissionDto,
    ): Promise<ContactSubmission> {
        return this.contactSubmissionsService.updateContactSubmission(id, dto);
    }
    @Get()
    async findAll(): Promise<ContactSubmission[]> {
        return this.contactSubmissionsService.findAll();
    }
}
