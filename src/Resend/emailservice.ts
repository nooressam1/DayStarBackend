// email.service.ts
import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
    private resend = new Resend(process.env.RESEND_APIKEY);

    async sendOrderConfirmation(to: string, order: any) {
        const orderNum = order.order_number;
        try {
            await this.resend.emails.send({
                from: 'Acme <onboarding@resend.dev>', // Resend verified test sending domain
                to,
                subject: `Order Confirmation - #${orderNum}`,
                html: this.buildOrderEmailHtml(order),
            });
            console.log("Order confirmation email successfully dispatched to:", to);
        } catch (error) {
            console.error("Resend API email dispatch failure:", error);
        }
    }

    private buildOrderEmailHtml(order: any): string {
        const formatMoney = (amount: number) => `EGP ${(amount / 100).toFixed(2)}`;
        const orderNum = order.order_number;

        // Loop over the items and build HTML table rows
        const itemsRows = order.items.map((item: any) => `
            <tr style="border-bottom: 1px solid #e8dfdc;">
                <td style="padding: 12px 8px; text-align: left; font-family: sans-serif; font-size: 14px; color: #374151;">
                    <strong style="color: #78534a; font-family: serif; font-size: 15px;">${item.name}</strong>
                    <div style="font-size: 12px; color: #8b7e7a; margin-top: 2px;">Size: ${item.size}</div>
                </td>
                <td style="padding: 12px 8px; text-align: center; font-family: sans-serif; font-size: 14px; color: #374151;">
                    ${item.quantity}
                </td>
                <td style="padding: 12px 8px; text-align: right; font-family: sans-serif; font-size: 14px; color: #374151; font-weight: 500;">
                    ${formatMoney(item.unit_price_snapshot * item.quantity)}
                </td>
            </tr>
        `).join('');

        // Prepare shipping address display safe fallback
        const addr = order.shippingAddress || {};
        const addressText = addr.address || 'N/A';
        const floorAptText = `Floor: ${addr.floorNumber || '-'}, Apt: ${addr.apartmentNumber || '-'}`;
        const areaCityText = `${addr.area || ''}, ${addr.city || ''}`;
        const govPostalText = `${addr.governorate ? `${addr.governorate} ` : ''}${addr.postalCode || ''}`;

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Order Confirmation</title>
        </head>
        <body style="background-color: #faf5f3; margin: 0; padding: 20px; font-family: sans-serif;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border: 1px solid #e8dfdc; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 10px rgba(120, 83, 74, 0.05);">
                <!-- Header Banner -->
                <tr>
                    <td align="center" style="background-color: #004956; padding: 40px 20px;">
                        <h1 style="color: #ffffff; font-family: serif; font-size: 32px; font-weight: 700; letter-spacing: 2px; margin: 0; text-transform: uppercase;">DayStar</h1>
                        <p style="color: rgba(255, 255, 255, 0.8); font-size: 14px; font-weight: 300; margin: 8px 0 0 0; letter-spacing: 1px;">Skincare routine recommended by professionals</p>
                    </td>
                </tr>

                <!-- Greeting Box -->
                <tr>
                    <td style="padding: 40px 30px 20px 30px;">
                        <h2 style="color: #78534a; font-family: serif; font-size: 22px; font-weight: 600; margin: 0 0 16px 0;">Thank You for Your Order!</h2>
                        <p style="color: #686361; font-size: 15px; line-height: 1.6; margin: 0;">
                            We are processing your order and preparing your skincare routine selection. Below are the details of your order.
                        </p>
                    </td>
                </tr>

                <!-- Order Information Overview -->
                <tr>
                    <td style="padding: 0 30px 20px 30px;">
                        <table width="100%" style="background-color: #faf5f3; border-radius: 8px; padding: 16px;">
                            <tr>
                                <td style="font-family: sans-serif; font-size: 13px; color: #8b7e7a; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Order ID</td>
                                <td align="right" style="font-family: sans-serif; font-size: 14px; color: #004956; font-weight: 700;">#${orderNum}</td>
                            </tr>
                            <tr>
                                <td style="padding-top: 8px; font-family: sans-serif; font-size: 13px; color: #8b7e7a; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Date</td>
                                <td align="right" style="padding-top: 8px; font-family: sans-serif; font-size: 14px; color: #374151;">${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}</td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <!-- Customer Details & Shipping Address -->
                <tr>
                    <td style="padding: 0 30px 20px 30px;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background-color: #faf5f3; border-radius: 8px; padding: 16px;">
                            <tr>
                                <td style="padding: 12px; font-family: sans-serif; font-size: 13px; vertical-align: top; width: 50%;">
                                    <strong style="color: #78534a; font-family: serif; font-size: 14px; display: block; margin-bottom: 8px;">Customer Information</strong>
                                    <div style="font-size: 13px; color: #686361; line-height: 1.5;">
                                        <strong>Email:</strong> ${order.email || 'N/A'}<br>
                                        <strong>Phone:</strong> ${order.phone || 'N/A'}
                                    </div>
                                </td>
                                <td style="padding: 12px; font-family: sans-serif; font-size: 13px; vertical-align: top; width: 50%; border-left: 1px solid #e8dfdc;">
                                    <strong style="color: #78534a; font-family: serif; font-size: 14px; display: block; margin-bottom: 8px;">Shipping Address</strong>
                                    <div style="font-size: 13px; color: #686361; line-height: 1.5;">
                                        ${addressText}<br>
                                        ${floorAptText}<br>
                                        ${areaCityText}<br>
                                        ${govPostalText}
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <!-- Products Table -->
                <tr>
                    <td style="padding: 0 30px 20px 30px;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid #78534a;">
                                    <th style="padding: 8px; text-align: left; font-family: sans-serif; font-size: 13px; color: #78534a; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Product</th>
                                    <th style="padding: 8px; text-align: center; font-family: sans-serif; font-size: 13px; color: #78534a; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; width: 60px;">Qty</th>
                                    <th style="padding: 8px; text-align: right; font-family: sans-serif; font-size: 13px; color: #78534a; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; width: 100px;">Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsRows}
                            </tbody>
                        </table>
                    </td>
                </tr>

                <!-- Summary Panel -->
                <tr>
                    <td style="padding: 0 30px 40px 30px;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-family: sans-serif; font-size: 14px; color: #374151;">
                            <tr>
                                <td style="padding: 6px 0; text-align: right; color: #8b7e7a;">Grand Total</td>
                                <td style="padding: 6px 0; text-align: right; font-weight: 600; width: 120px; color: #004956; font-size: 16px;">
                                    ${formatMoney(order.total)}
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <!-- Footer Sign-off -->
                <tr>
                    <td align="center" style="background-color: #faf5f3; padding: 30px 20px; border-top: 1px solid #e8dfdc; text-align: center;">
                        <p style="margin: 0; font-size: 13px; color: #8b7e7a; font-family: sans-serif;">
                            Need help with your skincare routine? Reply to this email or contact support.
                        </p>
                        <p style="margin: 8px 0 0 0; font-size: 12px; color: #8b7e7a; font-family: sans-serif;">
                            &copy; ${new Date().getFullYear()} DayStar Skincare. All rights reserved.
                        </p>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        `;
    }
}
