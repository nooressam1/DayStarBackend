import { renderEmailLayout } from '../components/email-layout';

export function buildSaleAlertHtml(products: any | any[], customerName = 'Valued Customer'): string {
  const items: any[] = Array.isArray(products) ? products : [products];
  const count = items.length;
  const isMultiple = count > 1;
  const formatMoney = (amount: number) => `EGP ${(amount / 100).toFixed(2)}`;
  const websiteBaseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  const productCardsHtml = items
    .map((product) => {
      const productName = product.name || product.product_name || 'Skincare Product';
      const rawPrice = product.price || 0;
      const discountPercentage = product.discount_percentage || 0;
      const salePrice =
        discountPercentage > 0
          ? Math.round(rawPrice * (1 - discountPercentage / 100))
          : rawPrice;

      const productSlug = product.slug || '';
      const productUrl = `${websiteBaseUrl}/product/${productSlug}`;
      const imageUrl = product.image || '';

      return `
      <!-- Product Card -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #faf5f3; border: 1px solid #ebdcd7; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
        <tr>
          ${
            imageUrl
              ? `
          <td width="110" style="vertical-align: top; padding-right: 18px;">
            <img src="${imageUrl}" alt="${productName}" width="100" height="100" style="border-radius: 8px; object-fit: cover; display: block; border: 1px solid #e8dfdc;" />
          </td>
          `
              : ''
          }
          <td style="vertical-align: middle;">
            <h3 style="color: #292524; font-family: serif; font-size: 17px; font-weight: 600; margin: 0 0 6px 0;">
              ${productName}
            </h3>
            <div style="margin-bottom: 12px;">
              ${
                discountPercentage > 0
                  ? `
              <span style="color: #a8a29e; font-size: 13px; text-decoration: line-through; margin-right: 8px;">
                ${formatMoney(rawPrice)}
              </span>
              `
                  : ''
              }
              <span style="color: #004956; font-size: 18px; font-weight: 700;">
                ${formatMoney(salePrice)}
              </span>
              ${
                discountPercentage > 0
                  ? `
              <span style="background-color: #557b55; color: #ffffff; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-left: 8px;">
                ${discountPercentage}% OFF
              </span>
              `
                  : ''
              }
            </div>
            <a href="${productUrl}" style="display: inline-block; background-color: #78534a; color: #ffffff; text-decoration: none; padding: 8px 18px; border-radius: 6px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">
              View Product &rarr;
            </a>
          </td>
        </tr>
      </table>
      `;
    })
    .join('');

  const headline = isMultiple
    ? `${count} items you saved to your Favorites just went on sale!`
    : `An item you saved to your Favorites just went on sale.`;

  const pageTitle = isMultiple
    ? `${count} Items on Sale from Your Favorites`
    : `Item on Sale: ${items[0]?.name || items[0]?.product_name || 'Skincare Product'}`;

  const previewText = isMultiple
    ? `🔥 ${count} of your favorited items are on sale now! Check them out before stock runs out.`
    : `🔥 Great news! ${items[0]?.name || items[0]?.product_name} is now on sale!`;

  const content = `
    <div style="display: inline-block; background-color: #fdf2e9; color: #b45309; padding: 4px 14px; border-radius: 999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px;">
      Special Sale Alert
    </div>
    <h2 style="color: #78534a; font-family: serif; font-size: 24px; font-weight: 700; margin: 0 0 14px 0;">
      Good news, ${customerName}!
    </h2>
    <p style="color: #57534e; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
      ${headline} Grab them before stock runs out!
    </p>

    <!-- Product Cards List -->
    ${productCardsHtml}

    <p style="color: #78716c; font-size: 13px; line-height: 1.5; margin: 16px 0 0 0;">
      You received this email because you saved these products to your DayStar Favorites with sale notifications enabled.
    </p>
  `;

  return renderEmailLayout({
    title: pageTitle,
    content,
    previewText,
  });
}
