import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import type { EmailContent } from "@/lib/email/templates";

export const dynamic = "force-dynamic";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function composeHtml(subject: string, body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>"))
    .map((p) => `<p style="margin:0 0 14px; color:#1f2937; font-size:15px; line-height:1.6;">${p}</p>`);
  return `<!doctype html><html lang="fr"><body style="margin:0; background:#f4f6fb; padding:24px;">
  <div style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #e8ebf0; border-radius:16px; overflow:hidden;">
    <div style="background:#061a33; padding:18px 24px;">
      <p style="margin:0; color:#ffffff; font-family:Cambria,Georgia,serif; font-size:16px; font-weight:700; letter-spacing:0.06em;">
        FRANCE SANTÉ <span style="color:#c1272d;">TRANSPORT</span>
      </p>
      <p style="margin:2px 0 0; color:#b9cbe6; font-size:11px; font-style:italic;">Le transport qui fait avancer la santé</p>
    </div>
    <div style="padding:24px;">
      <h1 style="margin:0 0 16px; font-size:18px; color:#061a33;">${subject.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</h1>
      ${paragraphs.join("\n      ")}
    </div>
    <div style="padding:16px 24px; background:#f0f4fa; border-top:1px solid #dbe5f3;">
      <p style="margin:0; font-size:11px; color:#64748b;">France Santé Transport — message automatique du module Mailing de l'administration.</p>
    </div>
  </div>
</body></html>`;
}

/**
 * POST /api/admin/mailing
 * Envoi d'un e-mail à une liste de destinataires (profils existants) puis
 * journalisation ligne par ligne dans email_log (statut réel du transporteur).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentification requise" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin" && me?.role !== "dispatcher") {
    return NextResponse.json({ ok: false, error: "Accès réservé au staff" }, { status: 403 });
  }

  let input: { recipient_ids?: string[]; subject?: string; body?: string };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corps JSON invalide" }, { status: 400 });
  }
  const recipientIds = (input.recipient_ids ?? []).filter((id) => typeof id === "string" && id.length === 36);
  if (recipientIds.length === 0) {
    return NextResponse.json({ ok: false, error: "Aucun destinataire sélectionné" }, { status: 400 });
  }
  if (!isNonEmptyString(input.subject) || input.subject.length > 200) {
    return NextResponse.json({ ok: false, error: "Objet requis (200 caractères max)" }, { status: 400 });
  }
  if (!isNonEmptyString(input.body) || input.body.length > 5000) {
    return NextResponse.json({ ok: false, error: "Message requis (5000 caractères max)" }, { status: 400 });
  }

  const { data: recipients } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", recipientIds);
  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ ok: false, error: "Destinataires introuvables" }, { status: 404 });
  }

  const preview = input.body.trim().slice(0, 400);
  const results: Array<{ id: string; email: string; ok: boolean; error?: string }> = [];
  const logRows: Array<{
    recipient_id: string;
    to_email: string;
    subject: string;
    body_preview: string;
    status: "sent" | "failed";
    provider: string | null;
    error: string | null;
    sent_by: string;
  }> = [];

  for (const r of recipients) {
    const content: EmailContent = {
      subject: input.subject,
      html: composeHtml(input.subject, input.body),
      text: input.body,
    };
    const result = await sendEmail({ to: r.email, content });
    results.push({ id: r.id, email: r.email, ok: result.ok, error: result.error });
    logRows.push({
      recipient_id: r.id,
      to_email: r.email,
      subject: input.subject,
      body_preview: preview,
      status: result.ok ? "sent" : "failed",
      provider: result.provider,
      error: result.error ?? null,
      sent_by: user.id,
    });
  }

  const { error: logError } = await supabase.from("email_log").insert(logRows);
  const sent = results.filter((r) => r.ok).length;
  const consoleCount = logRows.filter((row) => row.provider === "console").length;
  return NextResponse.json(
    {
      ok: true,
      sent,
      failed: results.length - sent,
      results,
      logged: !logError,
      provider: consoleCount > 0 ? "console" : null,
      warning:
        consoleCount > 0
          ? "Aucun serveur SMTP/Resend configuré : les e-mails ont été simulés (consignés, mais jamais réellement envoyés). Renseignez SMTP ou Resend dans Services & intégrations."
          : null,
    },
    { status: 200 },
  );
}
