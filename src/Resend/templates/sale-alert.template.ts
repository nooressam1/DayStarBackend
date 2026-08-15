import { renderEmailLayout } from '../components/email-layout';

export function buildSaleAlertHtml(product: any, customerName = 'Valued Customer'): string {
  const formatMoney = (amount: number) => `EGP ${(amount / 100).toFixed(2)}`;
  const productName = product.name || product.product_name || 'Skincare Product';
  const rawPrice = product.price || 0;
  const discountPercentage = product.discount_percentage || 0;
  const salePrice =
    discountPercentage > 0
      ? Math.round(rawPrice * (1 - discountPercentage / 100))
      : rawPrice;

  const productSlug = product.slug || '';
  const websiteBaseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const productUrl = `${websiteBaseUrl}/product/${productSlug}`;
  const imageUrl = product.image || '';

  const content = `
    <div style="display: inline-block; background-color: #fdf2e9; color: #b45309; padding: 4px 14px; border-radius: 999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px;">
      Special Offer
    </div>
    <h2 style="color: #78534a; font-family: serif; font-size: 24px; font-weight: 700; margin: 0 0 14px 0;">
      Good news, ${customerName}!
    </h2>
    <p style="color: #57534e; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
      An item you saved to your <strong>Favorites</strong> just went on sale. Grab it before stock runs out!
    </p>

    <!-- Product Card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #faf5f3; border: 1px solid #ebdcd7; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <tr>
        ${imageUrl
      ? `
        <td width="120" style="vertical-align: top; padding-right: 20px;">
          <img src="${imageUrl}" alt="${productName}" width="110" height="110" style="border-radius: 8px; object-fit: cover; display: block; border: 1px solid #e8dfdc;" />
        </td>
        `
      : ''
    }
        <td style="vertical-align: middle;">
          <h3 style="color: #292524; font-family: serif; font-size: 18px; font-weight: 600; margin: 0 0 8px 0;">
            ${productName}
          </h3>
          <div style="margin-bottom: 14px;">
            ${discountPercentage > 0
      ? `
            <span style="color: #a8a29e; font-size: 14px; text-decoration: line-through; margin-right: 8px;">
              ${formatMoney(rawPrice)}
            </span>
            `
      : ''
    }
            <span style="color: #004956; font-size: 20px; font-weight: 700;">
              ${formatMoney(salePrice)}
            </span>
            ${discountPercentage > 0
      ? `
            <span style="background-color: #557b55; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-left: 8px;">
              ${discountPercentage}% OFF
            </span>
            `
      : ''
    }
          </div>
          <a href="${productUrl}" style="display: inline-block; background-color: #78534a; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 6px; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">
            View Product &rarr;
          </a>
        </td>
      </tr>
    </table>

    <p style="color: #78716c; font-size: 13px; line-height: 1.5; margin: 0;">
      You received this email because you favorited this product on DayStar with sale notifications enabled.
    </p>
  `;

  return renderEmailLayout({
    title: `Item on Sale: ${productName}`,
    content,
    previewText: `🔥 Great news! ${productName} from your favorites is now on sale!`,
  });
}
