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

  @Get('admin/all')
  async getAllOrdersAdmin(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.ordersService.getAllOrdersAdmin({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status: status || undefined,
      search: search || undefined,
    });
  }

  @Get('admin/:id')
  async getAdminOrderById(@Param('id') orderId: string) {
    return this.ordersService.getOrderByIdAdmin(orderId);
  }
  @Get(':id')
  async getOrder(
    @CurrentUser() user: any,
    @Param('id') orderId: string,
  ) {
    const userId = user.sub;
    const email = user.email;
    return this.ordersService.getOrderById(userId, orderId, email);
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
  @Patch('admin/:id/status')
  async updateOrderStatusAdmin(
    @Param('id') orderId: string,
    @Body() body: { status: string; reason?: string }
  ) {
    return this.ordersService.updateOrderStatusAdmin(orderId, body.status, body.reason);
  }

  @Patch('admin/:id/cancel')
  async cancelOrderAdmin(
    @Param('id') orderId: string,
    @Body() body?: { reason?: string }
  ) {
    return this.ordersService.cancelOrderAdmin(orderId, body?.reason);
  }

  @Patch('admin/:id/complete-payment')
  async completePaymentAdmin(
    @Param('id') orderId: string
  ) {
    return this.ordersService.completePaymentAdmin(orderId);
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
