import nodemailer from "nodemailer"

type MailInput = {
  to: string
  subject: string
  text: string
  html?: string
}

const BRAND_MARKER = 'data-autoparts-email="true"'

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")

const numberFromEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const textToHtml = (value: string) =>
  value
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 14px">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("")

const formatEmailSubject = (subject: string) => {
  const cleanSubject = subject.trim().replace(/\s+/g, " ") || "Notification"
  if (/AutoParts Pro/i.test(cleanSubject)) return cleanSubject
  return `AutoParts Pro — ${cleanSubject}`
}

export function brandedEmailHtml(input: {
  title: string
  preview?: string
  body: string
}) {
  const safeTitle = escapeHtml(input.title)
  const safePreview = escapeHtml(input.preview ?? input.title)

  return [
    `<!doctype html>`,
    `<html lang="en">`,
    `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>`,
    `<body ${BRAND_MARKER} style="margin:0;background:#0a0a0a;padding:0;font-family:Arial,Helvetica,sans-serif;color:#f9fafb">`,
    `<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${safePreview}</span>`,
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">`,
    `<tr><td align="center" style="padding:24px 12px">`,
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border-collapse:collapse;border:1px solid #2a2a2a;background:#111111;border-radius:14px;overflow:hidden">`,
    `<tr><td style="padding:24px 28px;background:#171717;border-bottom:1px solid #2a2a2a">`,
    `<p style="margin:0 0 8px;color:#dc2626;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">AutoParts Pro</p>`,
    `<h1 style="margin:0;color:#ffffff;font-size:22px;line-height:1.3">${safeTitle}</h1>`,
    `</td></tr>`,
    `<tr><td style="padding:28px;color:#d1d5db;font-size:15px;line-height:1.65">${input.body}</td></tr>`,
    `<tr><td style="padding:18px 28px;border-top:1px solid #2a2a2a;color:#9ca3af;font-size:12px">This is an automated AutoParts Pro message.</td></tr>`,
    `</table>`,
    `</td></tr>`,
    `</table>`,
    `</body>`,
    `</html>`,
  ].join("")
}

const ensureBrandedHtml = (input: MailInput) => {
  if (input.html?.includes(BRAND_MARKER)) return input.html
  return brandedEmailHtml({
    title: input.subject,
    preview: input.text.split("\n").find(Boolean) ?? input.subject,
    body: input.html ?? textToHtml(input.text),
  })
}

export async function sendSmtpMail(input: MailInput) {
  const host = process.env.SMTP_HOST?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  const fromAddress = process.env.SMTP_FROM?.trim() || user
  const port = numberFromEnv(process.env.SMTP_PORT, 587)

  if (!host || !user || !pass || !fromAddress) {
    throw new Error("SMTP is not configured")
  }

  const from = fromAddress.includes("<") ? fromAddress : `AutoParts Pro <${fromAddress}>`
  const subject = formatEmailSubject(input.subject)

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  await transporter.sendMail({
    from,
    to: input.to,
    subject,
    text: input.text,
    html: ensureBrandedHtml(input),
  })
}
