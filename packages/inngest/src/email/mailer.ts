import nodemailer, { type Transporter } from "nodemailer";

/* ------------------------------------------------------------------ *
 * Email sending via Nodemailer over Resend's SMTP gateway.
 *
 * The transport is created LAZILY (on first send) and cached. This is
 * deliberate: building it at module load would read process.env before the
 * server's dotenv.config() has run (this package is imported before config),
 * leaving credentials empty → "Missing credentials for PLAIN". Reading env
 * at send-time avoids that ordering trap entirely.
 *
 * Resend SMTP auth is always the literal username "resend"; the password is
 * your Resend API key (https://resend.com/api-keys).
 * ------------------------------------------------------------------ */
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not set — add it to your .env (then run `pnpm env:sync`) to send email."
    );
  }

  transporter = nodemailer.createTransport({
    host: process.env.RESEND_SMTP_HOST ?? "smtp.resend.com",
    port: Number(process.env.RESEND_SMTP_PORT ?? 465),
    secure: true, // port 465 = implicit TLS
    auth: { user: "resend", pass: apiKey },
  });

  return transporter;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Send an email. From-address comes from EMAIL_FROM (verified Resend domain in prod). */
export async function sendEmail({ to, subject, text, html }: SendEmailOptions) {
  const from = process.env.EMAIL_FROM ?? "Codesetu <onboarding@resend.dev>";
  return getTransporter().sendMail({ from, to, subject, text, html });
}
