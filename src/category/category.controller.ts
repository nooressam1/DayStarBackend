import { Controller, Get, Post, Body } from '@nestjs/common';
import { CategoryService } from './category.service';
import { category } from './category.interface';
import { CreateCategoryDto } from './dto/create-category.dto';

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
}