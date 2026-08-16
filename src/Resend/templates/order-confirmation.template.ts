import { renderEmailLayout } from '../components/email-layout';

export function buildOrderConfirmationHtml(order: any): string {
  const formatMoney = (amount: number) => `EGP ${(amount / 100).toFixed(2)}`;
  const orderNum = order.order_number;
  const customerName = order.fullName || order.name || 'Valued Customer';
  const paymentMethod = order.payment_method === 'card' ? 'Credit / Debit Card' : 'Cash on Delivery';
  const isPaid = order.payment_status === 'paid' || order.payment_method === 'card';
  const paymentStatusText = isPaid ? 'Paid (Online)' : 'Pay on Delivery';

  const itemsRows = (order.items || [])
    .map(
      (item: any) => `
    <tr style="border-bottom: 1px solid #e8dfdc;">
      <td style="padding: 12px 8px; text-align: left; font-size: 14px; color: #374151;">
        <strong style="color: #78534a; font-family: serif; font-size: 15px;">${item.name}</strong>
        <div style="font-size: 12px; color: #8b7e7a; margin-top: 2px;">Size: ${item.size}</div>
      </td>
      <td style="padding: 12px 8px; text-align: center; font-size: 14px; color: #374151;">
        ${item.quantity}
      </td>
      <td style="padding: 12px 8px; text-align: right; font-size: 14px; color: #374151; font-weight: 500;">
        ${formatMoney(item.unit_price_snapshot * item.quantity)}
      </td>
    </tr>
  `
    )
    .join('');

  const addr = order.shippingAddress || {};
  const addressText = addr.address || 'N/A';
  const floorAptText = `Floor: ${addr.floorNumber || '-'}, Apt: ${addr.apartmentNumber || '-'}`;
  const areaCityText = `${addr.area || ''}, ${addr.city || ''}`;
  const govPostalText = `${addr.governorate ? `${addr.governorate} ` : ''}${addr.postalCode || ''}`;

  const content = `
    <h2 style="color: #78534a; font-family: serif; font-size: 22px; font-weight: 600; margin: 0 0 14px 0;">
      Thank You for Your Order, ${customerName}!
    </h2>
    <p style="color: #686361; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
      We are processing your order and preparing your skincare routine selection. Below are the details of your order.
    </p>

    <!-- Order Overview -->
    <table width="100%" style="background-color: #faf5f3; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
      <tr>
        <td style="font-size: 13px; color: #8b7e7a; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Order ID</td>
        <td align="right" style="font-size: 14px; color: #004956; font-weight: 700;">#${orderNum}</td>
      </tr>
      <tr>
        <td style="padding-top: 8px; font-size: 13px; color: #8b7e7a; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Date</td>
        <td align="right" style="padding-top: 8px; font-size: 14px; color: #374151;">${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}</td>
      </tr>
      <tr>
        <td style="padding-top: 8px; font-size: 13px; color: #8b7e7a; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Payment Method</td>
        <td align="right" style="padding-top: 8px; font-size: 14px; color: #374151; font-weight: 600;">${paymentMethod}</td>
      </tr>
      <tr>
        <td style="padding-top: 8px; font-size: 13px; color: #8b7e7a; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Payment Status</td>
        <td align="right" style="padding-top: 8px; font-size: 13px; color: ${isPaid ? '#2e7d32' : '#b45309'}; font-weight: 700;">${paymentStatusText}</td>
      </tr>
    </table>

    <!-- Customer & Shipping Details -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background-color: #faf5f3; border-radius: 8px; padding: 14px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 12px; font-size: 13px; vertical-align: top; width: 50%;">
          <strong style="color: #78534a; font-family: serif; font-size: 14px; display: block; margin-bottom: 8px;">Customer Information</strong>
          <div style="font-size: 13px; color: #686361; line-height: 1.5;">
            <strong>Name:</strong> ${customerName}<br>
            <strong>Email:</strong> ${order.email || 'N/A'}<br>
            <strong>Phone:</strong> ${order.phone || 'N/A'}
          </div>
        </td>
        <td style="padding: 12px; font-size: 13px; vertical-align: top; width: 50%; border-left: 1px solid #e8dfdc;">
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

    <!-- Products Table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="border-bottom: 2px solid #78534a;">
          <th style="padding: 8px; text-align: left; font-size: 13px; color: #78534a; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Product</th>
          <th style="padding: 8px; text-align: center; font-size: 13px; color: #78534a; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; width: 60px;">Qty</th>
          <th style="padding: 8px; text-align: right; font-size: 13px; color: #78534a; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; width: 100px;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Grand Total -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 14px; color: #374151;">
      <tr>
        <td style="padding: 6px 0; text-align: right; color: #8b7e7a;">Grand Total</td>
        <td style="padding: 6px 0; text-align: right; font-weight: 600; width: 120px; color: #004956; font-size: 16px;">
          ${formatMoney(order.total)}
        </td>
      </tr>
    </table>
  `;

  return renderEmailLayout({
    title: `Order Confirmation #${orderNum}`,
    content,
    previewText: `Thank you for your order #${orderNum} with DayStar.`,
  });
}
