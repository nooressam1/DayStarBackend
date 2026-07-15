import { Controller, Get, Param, Query } from '@nestjs/common';
import { DiscountService } from './discount.service';
import { discount } from './discount.interface';
@Controller('discount')

export class discountController {
    constructor(private readonly discountService: DiscountService) { }
    @Get(':code')
    async findByCode(@Param('code') code: string): Promise<discount> {
        return this.discountService.findbycode(code);
    }
}