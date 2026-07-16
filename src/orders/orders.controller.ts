import { Controller, Post, Body, UseGuards, Get, Param, Patch, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/cartDto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('orders')
@UseGuards(SupabaseAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) { }

  @Post('checkout')
  async checkout(
    @CurrentUser() user: any,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    const userId = user.sub;
    const email = user.email;
    return this.ordersService.processCheckout(userId, email, createOrderDto);
  }

  @Get(':id')
  async getOrder(
    @CurrentUser() user: any,
    @Param('id') orderId: string,
  ) {
    const userId = user.sub;
    return this.ordersService.getOrderById(userId, orderId);
  }
  @Get('')
  async getAllOrders(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userId = user.sub;
    return this.ordersService.getAllOrders(
      userId,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
  }
  @Patch(':orderid/cancel')
  async cancelOrder(
    @CurrentUser() user: any,
    @Param('orderid') orderId: string
  ) {
    const userId = user.sub;
    console.log("testingg 2", orderId);
    return this.ordersService.cancelOrder(orderId, userId);
  }
}
