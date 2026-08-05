import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { DiscountService } from './discount.service';
import { discount } from './discount.interface';
import { CreateDiscountDto } from './dto/create-discount.dto';

@Controller('discount')
export class discountController {
  constructor(private readonly discountService: DiscountService) { }

  @Get()
  async getAllDiscounts(): Promise<discount[]> {
    return this.discountService.getAllDiscounts();
  }

  @Get(':code')
  async findByCode(@Param('code') code: string): Promise<discount> {
    return this.discountService.findbycode(code);
  }

  @Post()
  async createDiscount(@Body() dto: CreateDiscountDto): Promise<discount> {
    return this.discountService.createDiscount(dto);
  }

  @Delete(':id')
  async deleteDiscount(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.discountService.deleteDiscount(id);
  }
}