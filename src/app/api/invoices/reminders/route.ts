import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { invoiceReminderEmail } from "@/lib/email/templates";
import { sendWebPush } from "@/lib/webpush/send";

export const dynamic = "force-dynamic";

const REMINDER_SPACING_DAYS = 3;

/**
 * POST /api/invoices/reminders — relance les factures échues
 * (statut issued/sent, échéance dépassée, dernière relance > 3 jours).
 * Auth : session staff, ou X-Cron-Secret (env CRON_SECRET) pour un cron.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (me?.role !== "admin" && me?.role !== "dispatcher") {
      return NextResponse.json({ ok: false, error: "Réservé au staff" }, { status: 403 });
    }
  } else {
    const secret = request.headers.get("x-cron-secret");
    if (!secret || !process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ ok: false, error: "Authentification requise (session staff ou X-Cron-Secret)" }, { status: 401 });
    }
  }

  const { data: invoices, error: fetchErr } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, currency, due_at, client_id, last_reminder_at")
    .in("status", ["issued", "sent"])
    .lt("due_at", new Date().toISOString().slice(0, 10));
  if (fetchErr) return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 });

  const domain = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const due = (invoices ?? []).filter((i) => {
    if (!i.due_at) return false;
    const reminded = i.last_reminder_at ? new Date(i.last_reminder_at).getTime() : 0;
    return Date.now() - reminded >= REMINDER_SPACING_DAYS * 86_400_000;
  });

  let sent = 0;
  const failures: string[] = [];
  for (const inv of due) {
    const invoiceId = String(inv.id);
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", String(inv.client_id))
      .single();
    if (!profile?.email) continue;
    const daysLate = Math.max(0, Math.round((Date.now() - new Date(String(inv.due_at)).getTime()) / 86_400_000));
    const result = await sendEmail({
      to: profile.email,
      content: invoiceReminderEmail({
        clientName: profile.full_name || profile.email,
        invoiceNumber: String(inv.invoice_number ?? "—"),
        amount: Number(inv.amount),
        currency: String(inv.currency),
        dueAt: String(inv.due_at),
        daysLate,
        domain: `${domain}/dashboard/invoices/${invoiceId}`,
      }),
    });
    if (result.ok) {
      sent += 1;
      await supabase.from("invoices").update({ last_reminder_at: new Date().toISOString() }).eq("id", invoiceId);
      void sendWebPush(String(inv.client_id), {
        title: "Rappel : facture en attente 💳",
        body: `Facture ${String(inv.invoice_number)} — ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: String(inv.currency) }).format(Number(inv.amount))}`,
        url: `/dashboard/invoices/${invoiceId}`,
        tag: `invoice-reminder-${invoiceId}`,
      });
    } else if (result.error) {
      failures.push(`${String(inv.invoice_number)} : ${result.error}`);
    }
  }

  return NextResponse.json({
    ok: true,
    overdue: due.length,
    sent,
    skipped: due.length - sent,
    failures,
  });
}
