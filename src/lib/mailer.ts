import nodemailer, { type Transporter } from "nodemailer";

/**
 * Transport email. Dibaca dari env SMTP_*.
 * Bila SMTP_HOST kosong → transport console (development): email hanya dicetak ke log
 * dan baris outbox langsung ditandai SENT.
 */

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface Mailer {
  readonly kind: "smtp" | "console";
  send(message: MailMessage): Promise<{ messageId?: string }>;
}

function createConsoleMailer(): Mailer {
  return {
    kind: "console",
    async send(message) {
      console.info(
        `\n📧 [EMAIL console-transport] To: ${message.to} | Subject: ${message.subject}\n${stripHtml(message.html)}\n`
      );
      return { messageId: `console-${Date.now()}` };
    },
  };
}

function createSmtpMailer(): Mailer {
  const host = process.env.SMTP_HOST!;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || undefined;
  const pass = process.env.SMTP_PASS || undefined;
  const from = process.env.SMTP_FROM || `GreenPark <no-reply@${host}>`;

  const transporter: Transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });

  return {
    kind: "smtp",
    async send(message) {
      const info = await transporter.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        html: message.html,
      });
      return { messageId: info.messageId };
    },
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

let cached: Mailer | null = null;

export function getMailer(): Mailer {
  if (cached) return cached;
  cached = process.env.SMTP_HOST?.trim()
    ? createSmtpMailer()
    : createConsoleMailer();
  return cached;
}

/** Untuk pengujian: mengganti transport sementara. */
export function __setMailerForTests(mailer: Mailer | null) {
  cached = mailer;
}
