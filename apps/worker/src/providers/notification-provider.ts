import nodemailer from 'nodemailer';

export interface NotificationMessage {
  channel: 'EMAIL' | 'SMS' | 'WEBHOOK';
  recipient: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
}

export interface NotificationProvider {
  readonly name: string;
  send(message: NotificationMessage): Promise<void>;
}

class SmtpProvider implements NotificationProvider {
  readonly name = 'smtp';
  private readonly transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: String(process.env.SMTP_SECURE ?? 'false') === 'true',
  });

  async send(message: NotificationMessage): Promise<void> {
    if (message.channel !== 'EMAIL') return this.sendNonEmail(message);
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM ?? 'PulseFlow Demo <no-reply@pulseflow.local>',
      to: message.recipient,
      subject: message.subject,
      text: message.text,
      html: message.html,
      headers: { 'x-pulseflow-idempotency-key': message.idempotencyKey },
    });
  }

  private async sendNonEmail(message: NotificationMessage): Promise<void> {
    if (message.channel === 'WEBHOOK') {
      const response = await fetch(message.recipient, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': message.idempotencyKey },
        body: JSON.stringify(message.payload),
      });
      if (!response.ok) throw new Error(`Outbound webhook returned ${response.status}.`);
    }
  }
}

class ResendProvider implements NotificationProvider {
  readonly name = 'resend';

  async send(message: NotificationMessage): Promise<void> {
    if (message.channel !== 'EMAIL') {
      if (message.channel === 'WEBHOOK') {
        const response = await fetch(message.recipient, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'idempotency-key': message.idempotencyKey },
          body: JSON.stringify(message.payload),
        });
        if (!response.ok) throw new Error(`Outbound webhook returned ${response.status}.`);
      }
      return;
    }
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY is required when NOTIFICATION_PROVIDER=resend.');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'idempotency-key': message.idempotencyKey,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? process.env.SMTP_FROM ?? 'PulseFlow <no-reply@example.com>',
        to: [message.recipient],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(payload.message ?? `Resend returned ${response.status}.`);
    }
  }
}

class MockProvider implements NotificationProvider {
  readonly name = 'mock';
  async send(_message: NotificationMessage): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
}

export function resolveNotificationProvider(): NotificationProvider {
  const provider = (process.env.NOTIFICATION_PROVIDER ?? 'smtp').toLowerCase();
  if (provider === 'resend') return new ResendProvider();
  if (provider === 'mock') return new MockProvider();
  return new SmtpProvider();
}
