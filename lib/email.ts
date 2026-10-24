import nodemailer from "nodemailer"

// SMTP everywhere: Mailpit locally, Resend's SMTP in production.
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: Number(process.env.SMTP_PORT) === 465,
  // With credentials (Resend on 2587), refuse to fall back to plaintext if STARTTLS is stripped.
  requireTLS: !!process.env.SMTP_USER,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
})

export function sendEmail(to: string | string[], subject: string, text: string, html?: string) {
  return transport.sendMail({ from: process.env.EMAIL_FROM, to, subject, text, html })
}
