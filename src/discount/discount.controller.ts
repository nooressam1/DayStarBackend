import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { DiscountService } from './discount.service';
import { discount } from './discount.interface';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import { ListDiscountsDto } from './dto/list-discounts.dto';

@Controller('discount')
export class discountController {
  constructor(private readonly discountService: DiscountService) { }

  @Get('all')
  async getAllDiscounts(): Promise<discount[]> {
    return this.discountService.getAllDiscounts();
  }

  @Get()
  async getPaginatedDiscounts(
    @Query() query: ListDiscountsDto,
  ): Promise<{ items: discount[]; total: number }> {
    return this.discountService.getPaginatedDiscounts(query);
  }

  @Get(':code')
  async findByCode(@Param('code') code: string): Promise<discount> {
    return this.discountService.findbycode(code);
  }

  @Post()
  async createDiscount(@Body() dto: CreateDiscountDto): Promise<discount> {
    return this.discountService.createDiscount(dto);
  }

  @Patch(':id')
  async updateDiscount(
    @Param('id') id: string,
    @Body() dto: UpdateDiscountDto
  ): Promise<discount> {
    return this.discountService.updateDiscount(id, dto);
  }

  @Delete(':id')
  async deleteDiscount(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.discountService.deleteDiscount(id);
  }
}