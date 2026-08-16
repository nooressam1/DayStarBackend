// src/orders/orders.service.ts
import { Injectable } from '@nestjs/common';
import { CheckoutService } from './services/checkout.service';
import { OrdersQueryService } from './services/orders-query.service';
import { OrdersAdminService } from './services/orders-admin.service';
import { CreateOrderDto } from './dto/cartDto';

/**
 * Facade service combining Checkout, Query, and Admin order operations.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly ordersQueryService: OrdersQueryService,
    private readonly ordersAdminService: OrdersAdminService,
  ) {}

  // Checkout operations
  async processCheckout(userId: string, email: string, createOrderDto: CreateOrderDto) {
    return this.checkoutService.processCheckout(userId, email, createOrderDto);
  }

  // User order query operations
  async getOrderById(userId: string, orderId: string, userEmail?: string) {
    return this.ordersQueryService.getOrderById(userId, orderId, userEmail);
  }

  async getAllOrders(userId: string, limit?: number, offset?: number) {
    return this.ordersQueryService.getAllOrders(userId, limit, offset);
  }

  async cancelOrder(orderID: string, userID: string) {
    return this.ordersQueryService.cancelOrder(orderID, userID);
  }

  // Admin order operations
  async getAllOrdersAdmin(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    return this.ordersAdminService.getAllOrdersAdmin(params);
  }

  async getOrderByIdAdmin(orderId: string) {
    return this.ordersAdminService.getOrderByIdAdmin(orderId);
  }

  async updateOrderStatusAdmin(orderId: string, status: string, reason?: string) {
    return this.ordersAdminService.updateOrderStatusAdmin(orderId, status, reason);
  }

  async cancelOrderAdmin(orderId: string, reason?: string) {
    return this.ordersAdminService.cancelOrderAdmin(orderId, reason);
  }

  async completePaymentAdmin(orderId: string) {
    return this.ordersAdminService.completePaymentAdmin(orderId);
  }
}
