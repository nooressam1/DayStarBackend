import { Controller, Get, Param, Query } from '@nestjs/common';
import { CategoryService } from './category.service';
import { category } from './category.interface';
@Controller('category')

export class categoryController {
    constructor(private readonly catergoryService: CategoryService) { }
    @Get('')
    async getCategories(): Promise<category[]> {
        return this.catergoryService.getCategories();
    }
}