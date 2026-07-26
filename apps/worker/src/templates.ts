interface TemplateInput {
  customerName: string;
  amount: number;
  currency: string;
  status: string;
  paymentId: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function renderNotificationTemplate(template: string, input: TemplateInput): {
  subject: string;
  html: string;
  text: string;
} {
  const amount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: input.currency,
  }).format(input.amount / 100);
  const approved = template === 'payment-approved';
  const title = approved ? 'Payment approved' : 'Payment update';
  const subject = approved ? 'Your payment was approved' : 'Your payment was not approved';
  const name = escapeHtml(input.customerName);
  const safeAmount = escapeHtml(amount);
  const status = escapeHtml(input.status);
  const paymentId = escapeHtml(input.paymentId);

  return {
    subject,
    text: `${title}\nHello, ${input.customerName}.\nPayment ${input.paymentId} for ${amount}: ${input.status}.`,
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#07111f;color:#e6edf7;font-family:Inter,Arial,sans-serif;padding:32px">
    <div style="max-width:620px;margin:auto;background:#0d1b2e;border:1px solid #1d3553;border-radius:20px;overflow:hidden">
      <div style="padding:28px 32px;background:linear-gradient(135deg,#102b46,#0d1b2e)">
        <div style="color:#6fe7ff;font-weight:800;letter-spacing:.14em;font-size:12px">PULSEFLOW</div>
        <h1 style="font-size:28px;margin:14px 0 0">${title}</h1>
      </div>
      <div style="padding:32px">
        <p>Hello, <strong>${name}</strong>.</p>
        <p>Your payment of <strong>${safeAmount}</strong> is now <strong>${status}</strong>.</p>
        <div style="margin:24px 0;padding:16px;border-radius:12px;background:#081524;color:#9fb4cc;font-size:13px">
          Payment ID: ${paymentId}
        </div>
        <p style="color:#8ea4bc;font-size:14px">This message was processed asynchronously by the PulseFlow worker.</p>
      </div>
    </div>
  </body>
</html>`,
  };
}
