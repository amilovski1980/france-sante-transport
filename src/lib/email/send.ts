import type { EmailContent } from "./templates";

export type EmailProvider = "resend" | "smtp" | "console";

export interface SendResult {
  ok: boolean;
  provider: EmailProvider;
  error?: string;
}

function parseFrom(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw;
}

async function sendViaResend(
  to: string[],
  from: string | undefined,
  content: EmailContent,
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, provider: "resend", error: "RESEND_API_KEY manquante" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: from ?? "France Santé Transport <no-reply@france-sante-transport.fr>",
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, provider: "resend", error: `Resend ${res.status}: ${detail}` };
  }
  return { ok: true, provider: "resend" };
}

async function sendViaSmtp(
  to: string[],
  from: string | undefined,
  content: EmailContent,
): Promise<SendResult> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  if (!host) return { ok: false, provider: "smtp", error: "SMTP_HOST manquant" };

  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    tls: port !== 465 ? { rejectUnauthorized: false } : undefined,
  });
  await transport.sendMail({
    from: from ?? "France Santé Transport <no-reply@fst.local>",
    to: to.join(", "),
    subject: content.subject,
    html: content.html,
    text: content.text,
  });
  return { ok: true, provider: "smtp" };
}

/**
 * Envoi d'un e-mail transactionnel.
 * Hiérarchie : RESEND_API_KEY (prod) → SMTP_HOST/SMTP_PORT (dev, mailpit) → console.
 * Ne lève jamais : l'échec d'un e-mail ne doit pas casser le flux métier.
 */
export async function sendEmail(input: { to: string | string[]; content: EmailContent }): Promise<SendResult> {
  const to = Array.isArray(input.to) ? input.to : [input.to];
  const from = parseFrom(process.env.SMTP_FROM);

  try {
    if (process.env.RESEND_API_KEY) {
      return await sendViaResend(to, from, input.content);
    }
    if (process.env.SMTP_HOST) {
      return await sendViaSmtp(to, from, input.content);
    }
    console.info("[email:console]", {
      to,
      subject: input.content.subject,
      text: input.content.text,
    });
    return { ok: true, provider: "console" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] échec :", message);
    return { ok: false, provider: process.env.RESEND_API_KEY ? "resend" : "smtp", error: message };
  }
}
