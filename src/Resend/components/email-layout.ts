export function renderEmailLayout({
  title,
  content,
  previewText = '',
}: {
  title: string;
  content: string;
  previewText?: string;
}): string {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${previewText ? `<div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</div>` : ''}
</head>
<body style="background-color: #faf5f3; margin: 0; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e8dfdc; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 14px rgba(120, 83, 74, 0.05); margin: 0 auto;">
    <!-- Header -->
    <tr>
      <td align="center" style="background-color: #004956; padding: 36px 20px;">
        <h1 style="color: #ffffff; font-family: serif, 'Times New Roman'; font-size: 32px; font-weight: 700; letter-spacing: 2.5px; margin: 0; text-transform: uppercase;">
          DayStar
        </h1>
        <p style="color: rgba(255, 255, 255, 0.85); font-size: 13px; font-weight: 300; margin: 6px 0 0 0; letter-spacing: 1px;">
          Skincare routine recommended by professionals
        </p>
      </td>
    </tr>

    <!-- Body Content -->
    <tr>
      <td style="padding: 36px 28px 24px 28px;">
        ${content}
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td align="center" style="background-color: #faf5f3; padding: 28px 20px; border-top: 1px solid #e8dfdc; text-align: center;">
        <p style="margin: 0; font-size: 13px; color: #8b7e7a;">
          Need help with your skincare routine? Reply directly to this email.
        </p>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #8b7e7a;">
          &copy; ${currentYear} DayStar Skincare. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
