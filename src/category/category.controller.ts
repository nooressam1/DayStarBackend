import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { CategoryService } from './category.service';
import { category } from './category.interface';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('category')
export class categoryController {
    constructor(private readonly catergoryService: CategoryService) { }

    @Get('')
    async getCategories(
        @Query('all') all?: string,
        @Query('includeInactive') includeInactive?: string,
    ): Promise<category[]> {
        const showAll = ['true', '1', true].includes(all as any) || ['true', '1', true].includes(includeInactive as any);
        return this.catergoryService.getCategories(showAll);
    }

    @Get(':id')
    async getCategory(@Param('id') id: string): Promise<category | null> {
        return this.catergoryService.getCategoryById(id);
    }

    @Post('')
    async createCategory(@Body() dto: CreateCategoryDto): Promise<category> {
        return this.catergoryService.createCategory(dto);
    }

    @Patch(':id')
    async updateCategory(
        @Param('id') id: string,
        @Body() dto: UpdateCategoryDto,
    ): Promise<category> {
        return this.catergoryService.updateCategory(id, dto);
    }

    @Delete(':id')
    async deleteCategory(@Param('id') id: string): Promise<{ success: boolean }> {
        return this.catergoryService.deleteCategory(id);
    }
}