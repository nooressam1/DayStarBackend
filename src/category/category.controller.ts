import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { CategoryService } from './category.service';
import { category } from './category.interface';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('category')
export class categoryController {
    constructor(private readonly catergoryService: CategoryService) { }

    @Get('')
    async getCategories(): Promise<category[]> {
        return this.catergoryService.getCategories();
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