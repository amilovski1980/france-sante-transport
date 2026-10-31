import { loadAppSettings } from "@/lib/app-settings";
import type { EmailContent } from "./templates";

export type EmailProvider = "resend" | "smtp" | "console";

export interface SendResult {
  ok: boolean;
  provider: EmailProvider;
  error?: string;
}

let providerHint: EmailProvider = "smtp";

function parseFrom(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw;
}

async function sendViaResend(
  to: string[],
  from: string | undefined,
  content: EmailContent,
  apiKey: string,
): Promise<SendResult> {
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
  config: { host: string; port: number; user: string | null; pass: string | null },
): Promise<SendResult> {
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
    tls: config.port !== 465 ? { rejectUnauthorized: false } : undefined,
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
 * Hiérarchie : réglages admin (Resend → SMTP) → variables d'environnement → console.
 * Ne lève jamais : l'échec d'un e-mail ne doit pas casser le flux métier.
 */
export async function sendEmail(input: { to: string | string[]; content: EmailContent }): Promise<SendResult> {
  const to = Array.isArray(input.to) ? input.to : [input.to];
  const from = parseFrom(process.env.SMTP_FROM);

  try {
    const settings = await loadAppSettings();
    providerHint = settings.resend_api_key ? "resend" : "smtp";

    if (settings.resend_api_key) {
      return await sendViaResend(to, settings.smtp_from ?? from, input.content, settings.resend_api_key);
    }
    if (settings.smtp_host && settings.smtp_port) {
      return await sendViaSmtp(to, settings.smtp_from ?? from, input.content, {
        host: settings.smtp_host,
        port: settings.smtp_port,
        user: settings.smtp_user,
        pass: settings.smtp_pass,
      });
    }

    if (process.env.RESEND_API_KEY) {
      return await sendViaResend(to, from, input.content, process.env.RESEND_API_KEY);
    }
    if (process.env.SMTP_HOST) {
      return await sendViaSmtp(to, from, input.content, {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        user: process.env.SMTP_USER ?? null,
        pass: process.env.SMTP_PASS ?? null,
      });
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
    return { ok: false, provider: providerHint, error: message };
  }
}
