import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { buildOrderConfirmationHtml } from './templates/order-confirmation.template';
import { buildSaleAlertHtml } from './templates/sale-alert.template';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend = new Resend(process.env.RESEND_APIKEY);
  private readonly fromAddress = process.env.EMAIL_FROM || 'DayStar <onboarding@resend.dev>';

  /**
   * Dispatches an order confirmation email to the customer
   */
  async sendOrderConfirmation(to: string, order: any): Promise<boolean> {
    const orderNum = order.order_number;
    try {
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: `Order Confirmation - #${orderNum}`,
        html: buildOrderConfirmationHtml(order),
      });
      this.logger.log(`Order confirmation email successfully dispatched to: ${to}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Resend API order email failure to ${to}: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Dispatches an on-sale alert email to a subscriber who favorited the product
   */
  async sendSaleAlert(to: string, product: any, customerName = 'Valued Customer'): Promise<boolean> {
    const productName = product.name || product.product_name || 'Your Favorited Product';
    try {
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: `🔥 Good news! "${productName}" is on Sale!`,
        html: buildSaleAlertHtml(product, customerName),
      });
      this.logger.log(`Sale alert email successfully dispatched to: ${to} for product "${productName}"`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send sale alert email to ${to}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
