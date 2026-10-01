export function invoiceEmailTemplate(
  customerName: string,
  invoiceNumber: string,
  invoiceDate: string,
  totalAmount: string,
  invoiceLink: string,
  termsText: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2c5282; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .content { margin-bottom: 20px; }
    .invoice-details { background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
    .amount { font-size: 24px; font-weight: bold; color: #2c5282; }
    .button { display: inline-block; background-color: #2c5282; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { font-size: 12px; color: #999; border-top: 1px solid #ddd; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Invoice Received</h1>
    </div>
    
    <div class="content">
      <p>Hi ${customerName},</p>
      <p>Your invoice is ready. See the details below.</p>
      
      <div class="invoice-details">
        <div style="margin-bottom: 10px;">
          <strong>Invoice #:</strong> ${invoiceNumber}<br>
          <strong>Date:</strong> ${invoiceDate}<br>
          <strong>Amount Due:</strong> <span class="amount">${totalAmount}</span>
        </div>
      </div>
      
      <p style="text-align: center;">
        <a href="${invoiceLink}" class="button">View Invoice</a>
      </p>
      
      <p><strong>Payment Terms:</strong> ${termsText}</p>
      
      <p>If you have any questions, please don't hesitate to reach out.</p>
      
      <p>Thank you!</p>
    </div>
    
    <div class="footer">
      <p>© Alpha Home Services. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function paymentConfirmationTemplate(
  customerName: string,
  invoiceNumber: string,
  amount: string,
  date: string,
  method: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #28a745; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .content { margin-bottom: 20px; }
    .receipt { background-color: #f0f8f4; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #28a745; }
    .amount { font-size: 20px; font-weight: bold; color: #28a745; }
    .footer { font-size: 12px; color: #999; border-top: 1px solid #ddd; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">✓ Payment Received</h1>
    </div>
    
    <div class="content">
      <p>Hi ${customerName},</p>
      <p>Thank you for your payment!</p>
      
      <div class="receipt">
        <div style="margin-bottom: 10px;">
          <strong>Invoice #:</strong> ${invoiceNumber}<br>
          <strong>Amount:</strong> <span class="amount">${amount}</span><br>
          <strong>Payment Method:</strong> ${method}<br>
          <strong>Date:</strong> ${date}
        </div>
      </div>
      
      <p>We appreciate your business!</p>
    </div>
    
    <div class="footer">
      <p>© Alpha Home Services. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function reviewRequestTemplate(
  customerName: string,
  reviewLink: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #ffc107; color: #333; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .content { margin-bottom: 20px; }
    .button { display: inline-block; background-color: #ffc107; color: #333; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
    .footer { font-size: 12px; color: #999; border-top: 1px solid #ddd; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">⭐ How did we do?</h1>
    </div>
    
    <div class="content">
      <p>Hi ${customerName},</p>
      <p>We'd love to hear about your experience with Alpha Home Services. Your feedback helps us improve!</p>
      
      <p style="text-align: center;">
        <a href="${reviewLink}" class="button">Leave a Review</a>
      </p>
      
      <p>Thank you for choosing us.</p>
    </div>
    
    <div class="footer">
      <p>© Alpha Home Services. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}