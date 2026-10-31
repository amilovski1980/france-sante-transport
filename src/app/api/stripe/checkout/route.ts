import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadAppSettings } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

const STRIPE_API = "https://api.stripe.com/v1";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * POST /api/stripe/checkout — crée une session Stripe Checkout pour une
 * facture (client propriétaire ou staff) puis enregistre la référence.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentification requise" }, { status: 401 });

  let body: { invoice_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corps JSON invalide" }, { status: 400 });
  }
  if (!body.invoice_id || typeof body.invoice_id !== "string") {
    return NextResponse.json({ ok: false, error: "Identifiant facture requis" }, { status: 400 });
  }

  const { data: inv } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, currency, vat_rate, status, client_id, stripe_session_id")
    .eq("id", body.invoice_id)
    .single();
  if (!inv) return NextResponse.json({ ok: false, error: "Facture introuvable" }, { status: 404 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isStaff = me?.role === "admin" || me?.role === "dispatcher";
  if (!isStaff && inv.client_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Facture non accessible" }, { status: 403 });
  }
  if (inv.status === "paid") return NextResponse.json({ ok: false, error: "Facture déjà réglée" }, { status: 400 });
  if (inv.status === "cancelled") return NextResponse.json({ ok: false, error: "Facture annulée" }, { status: 400 });

  const settings = await loadAppSettings();
  if (!settings.stripe_secret_key) {
    return NextResponse.json(
      { ok: false, error: "Paiement en ligne indisponible : la clé Stripe n'est pas configurée (Services & API)." },
      { status: 503 },
    );
  }

  const amountTtc = Math.round(Number(inv.amount) * (1 + Number(inv.vat_rate) / 100) * 100);
  const origin = appUrl();
  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": (inv.currency ?? "eur").toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(amountTtc),
    "line_items[0][price_data][product_data][name]": `Facture ${inv.invoice_number ?? inv.id} — France Santé Transport`,
    client_reference_id: inv.id,
    "metadata[invoice_id]": inv.id,
    "metadata[client_id]": inv.client_id,
    success_url: `${origin}/dashboard/invoices/${inv.id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/invoices/${inv.id}?payment=canceled`,
  });
  if (inv.stripe_session_id) form.set("session", inv.stripe_session_id);

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.stripe_secret_key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const data = (await res.json()) as { url?: string; id?: string; error?: { message?: string } };
  if (!res.ok || !data.url || !data.id) {
    return NextResponse.json(
      { ok: false, error: `Stripe : ${data.error?.message ?? "création de session impossible"}` },
      { status: 502 },
    );
  }

  if (inv.stripe_session_id !== data.id) {
    await supabase.from("invoices").update({ stripe_session_id: data.id }).eq("id", inv.id);
  }
  return NextResponse.json({ ok: true, url: data.url, session_id: data.id });
}
