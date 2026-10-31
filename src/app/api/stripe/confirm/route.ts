import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadAppSettings } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

const STRIPE_API = "https://api.stripe.com/v1";

type CheckoutSession = {
  id: string;
  payment_status?: "paid" | "unpaid" | "no_payment_required";
  amount_total?: number;
  currency?: string;
  metadata?: { invoice_id?: string; client_id?: string };
};

/**
 * POST /api/stripe/confirm — vérifie une session de paiement Stripe après le
 * retour du client et marque la facture payée si le règlement est acquis.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentification requise" }, { status: 401 });

  let body: { invoice_id?: string; session_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corps JSON invalide" }, { status: 400 });
  }
  if (!body.invoice_id || !body.session_id) {
    return NextResponse.json({ ok: false, error: "Facture et session requises" }, { status: 400 });
  }

  const { data: inv } = await supabase
    .from("invoices")
    .select("id, status, client_id, stripe_session_id, amount, currency, vat_rate")
    .eq("id", body.invoice_id)
    .single();
  if (!inv) return NextResponse.json({ ok: false, error: "Facture introuvable" }, { status: 404 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isStaff = me?.role === "admin" || me?.role === "dispatcher";
  if (!isStaff && inv.client_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Facture non accessible" }, { status: 403 });
  }
  if (inv.status === "paid") return NextResponse.json({ ok: true, already: true });

  const settings = await loadAppSettings();
  if (!settings.stripe_secret_key) {
    return NextResponse.json({ ok: false, error: "Paiement indisponible : Stripe non configuré." }, { status: 503 });
  }

  const sessionId = body.session_id;
  const res = await fetch(`${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${settings.stripe_secret_key}` },
  });
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: `Stripe : récupération de la session impossible (${res.status})` }, { status: 502 });
  }
  const session = (await res.json()) as CheckoutSession;

  const expectedInvoice = session.metadata?.invoice_id;
  if (expectedInvoice && expectedInvoice !== inv.id) {
    return NextResponse.json({ ok: false, error: "Coefficient de session incohérent avec la facture." }, { status: 400 });
  }
  if (inv.stripe_session_id && inv.stripe_session_id !== session.id) {
    return NextResponse.json({ ok: false, error: "Session incohérente avec la facture." }, { status: 400 });
  }

  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return NextResponse.json({ ok: false, error: "Paiement non finalisé." }, { status: 400 });
  }

  const stamp = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: stamp, stripe_session_id: session.id })
    .eq("id", inv.id);
  if (updErr) {
    return NextResponse.json({ ok: false, error: "Mise à jour impossible : " + updErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, paid: true });
}
