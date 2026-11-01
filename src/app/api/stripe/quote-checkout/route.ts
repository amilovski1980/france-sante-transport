import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAppSettings } from "@/lib/app-settings";
import type { Invoice, Quote } from "@/lib/types";

export const dynamic = "force-dynamic";

const STRIPE_API = "https://api.stripe.com/v1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

async function ensureInvoice(quote: Quote): Promise<Invoice> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("invoices")
    .select("*")
    .eq("quote_id", quote.id)
    .maybeSingle();
  if (existing) return existing as Invoice;

  const { data: rpcInvoice } = await supabase.rpc("create_invoice_from_quote", {
    p_quote_id: quote.id,
  });
  if (rpcInvoice) return rpcInvoice as Invoice;

  const { data: lines } = await admin
    .from("quote_lines")
    .select("quantity, unit_price")
    .eq("quote_id", quote.id);
  const amount =
    lines && lines.length > 0
      ? lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unit_price), 0)
      : Number(quote.amount);

  const year = new Date().getFullYear().toString();
  const { data: last } = await admin
    .from("invoices")
    .select("invoice_number")
    .like("invoice_number", `FST-${year}-%`)
    .order("invoice_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const parts = last?.invoice_number ? last.invoice_number.split("-") : [];
  const next = parts.length > 0 ? Number(parts[parts.length - 1]) + 1 : 1;
  const invoiceNumber = `FST-${year}-${String(next).padStart(4, "0")}`;

  const { data: request } = await admin
    .from("transport_requests")
    .select("client_id")
    .eq("id", quote.transport_request_id)
    .single();
  if (!request) throw new Error("Demande introuvable");

  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 30);

  const { data: inserted, error } = await admin
    .from("invoices")
    .insert({
      quote_id: quote.id,
      invoice_number: invoiceNumber,
      client_id: request.client_id,
      amount,
      currency: quote.currency,
      vat_rate: 0,
      status: "issued",
      due_at: dueAt.toISOString().slice(0, 10),
    })
    .select("*")
    .single();
  if (error || !inserted) throw new Error(error?.message ?? "Facture non créée");
  return inserted as Invoice;
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentification requise" }, { status: 401 });

  let body: { quote_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corps JSON invalide" }, { status: 400 });
  }
  const quoteId = body.quote_id ?? "";
  if (!UUID_RE.test(quoteId)) {
    return NextResponse.json({ ok: false, error: "Devis invalide" }, { status: 400 });
  }

  const { data: quote } = await supabase.from("quotes").select("*").eq("id", quoteId).single();
  if (!quote) return NextResponse.json({ ok: false, error: "Devis introuvable" }, { status: 404 });

  const { data: requestRow } = await supabase
    .from("transport_requests")
    .select("client_id")
    .eq("id", quote.transport_request_id)
    .single();
  if (!requestRow) return NextResponse.json({ ok: false, error: "Demande introuvable" }, { status: 404 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isStaff = me?.role === "admin" || me?.role === "dispatcher";
  if (!isStaff && requestRow.client_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Devis non accessible" }, { status: 403 });
  }
  if (quote.status !== "accepted") {
    return NextResponse.json({ ok: false, error: "Acceptez le devis avant de régler." }, { status: 400 });
  }

  let invoice: Invoice;
  try {
    invoice = await ensureInvoice(quote as Quote);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Facture non créée" },
      { status: 500 },
    );
  }

  if (invoice.status === "paid") {
    return NextResponse.json({
      ok: true,
      already: true,
      invoice_id: invoice.id,
      url: `/dashboard/invoices/${invoice.id}`,
    });
  }
  if (invoice.status === "cancelled") {
    return NextResponse.json({ ok: false, error: "Facture annulée" }, { status: 400 });
  }

  const settings = await loadAppSettings();
  if (!settings.stripe_secret_key) {
    return NextResponse.json(
      { ok: false, error: "Paiement en ligne indisponible : Stripe n'est pas configuré." },
      { status: 503 },
    );
  }

  const amountTtc = Math.round(Number(invoice.amount) * (1 + Number(invoice.vat_rate) / 100) * 100);
  const origin = appUrl();
  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": (invoice.currency ?? "eur").toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(amountTtc),
    "line_items[0][price_data][product_data][name]": `Devis V${quote.version} — France Santé Transport`,
    client_reference_id: invoice.id,
    "metadata[invoice_id]": invoice.id,
    "metadata[quote_id]": quote.id,
    "metadata[client_id]": requestRow.client_id,
    success_url: `${origin}/dashboard/invoices/${invoice.id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/requests?payment=canceled`,
  });
  if (invoice.stripe_session_id) form.set("session", invoice.stripe_session_id);

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

  if (invoice.stripe_session_id !== data.id) {
    await createAdminClient()
      .from("invoices")
      .update({ stripe_session_id: data.id })
      .eq("id", invoice.id);
  }

  return NextResponse.json({ ok: true, url: data.url, invoice_id: invoice.id });
}
