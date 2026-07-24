import nodemailer from "nodemailer"

type MailInput = {
  to: string
  subject: string
  text: string
  html?: string
}

const numberFromEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function sendSmtpMail(input: MailInput) {
  const host = process.env.SMTP_HOST?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  const from = process.env.SMTP_FROM?.trim() || user
  const port = numberFromEnv(process.env.SMTP_PORT, 587)

  if (!host || !user || !pass || !from) {
    throw new Error("SMTP is not configured")
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  })
}
