import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildQuotePdf } from "@/lib/pdf/quote";
import { createQuoteEnvelope, getEmbeddedSigningUrl, loadDocusignConfig, DocusignError } from "@/lib/docusign";
import type { EsignStatus, Quote, QuoteClient, QuoteLine, TransportRequest } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    .select("*")
    .eq("id", quote.transport_request_id)
    .single();
  if (!requestRow) return NextResponse.json({ ok: false, error: "Demande introuvable" }, { status: 404 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isStaff = me?.role === "admin" || me?.role === "dispatcher";
  if (!isStaff && requestRow.client_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Devis non accessible" }, { status: 403 });
  }
  if (!isStaff && quote.status !== "sent" && quote.status !== "accepted") {
    return NextResponse.json({ ok: false, error: "Ce devis n'est pas disponible à la signature." }, { status: 400 });
  }

  const [{ data: lines }, clientRes] = await Promise.all([
    supabase.from("quote_lines").select("*").eq("quote_id", quote.id).order("position", { ascending: true }),
    supabase.from("profiles").select("full_name, email, phone").eq("id", requestRow.client_id).single(),
  ]);
  if (!clientRes.data) return NextResponse.json({ ok: false, error: "Données incomplètes" }, { status: 404 });

  const signerEmail = (clientRes.data as QuoteClient).email;
  const signerName = (clientRes.data as QuoteClient).full_name || signerEmail;

  const cfg = await loadDocusignConfig();
  if (!cfg) {
    return NextResponse.json(
      { ok: false, error: "DocuSign non configuré : renseignez identifiants + clé privée dans « Services & API »." },
      { status: 400 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const { data: existing } = await supabase
    .from("esign_documents")
    .select("id, status, envelope_id")
    .eq("scope", "quote")
    .eq("reference_id", quoteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.status === "completed") {
    return NextResponse.json({ ok: false, error: "Ce devis est déjà signé." }, { status: 400 });
  }

  if (existing?.envelope_id && ["created", "sent", "delivered"].includes(existing.status)) {
    try {
      const { url } = await getEmbeddedSigningUrl(cfg, existing.envelope_id, {
        email: signerEmail,
        name: signerName,
        returnUrl: `${appUrl}/dashboard/esign/done?esign=${existing.id}&quote=${quoteId}`,
      });
      return NextResponse.json({
        ok: true,
        esign_id: existing.id,
        envelope_id: existing.envelope_id,
        signing_url: url,
        status: existing.status as EsignStatus,
      });
    } catch {
    }
  }

  try {
    const pdf = await buildQuotePdf({
      quote: quote as Quote,
      lines: (lines ?? []) as QuoteLine[],
      request: requestRow as TransportRequest,
      client: clientRes.data as QuoteClient,
    });
    const pdfBase64 = Buffer.from(pdf as Uint8Array).toString("base64");

    const { envelopeId } = await createQuoteEnvelope(cfg, {
      pdfBase64,
      signerEmail,
      signerName,
      documentName: `Devis V${quote.version} France Santé Transport.pdf`,
      emailSubject: `Devis V${quote.version} à signer — France Santé Transport`,
      emailBlurb:
        `Bonjour ${signerName},\n\nVotre devis V${quote.version} de transport médical vous est soumis à signature électronique. ` +
        `Cliquez sur le bouton ci-dessous ou ouvrez le lien de signature. Le PDF signé vous sera transmis automatiquement.\n\nFrance Santé Transport`,
    });

    const admin = createAdminClient();
    const { data: esign, error: esignErr } = await admin
      .from("esign_documents")
      .insert({
        scope: "quote",
        reference_id: quoteId,
        envelope_id: envelopeId,
        status: "sent",
        signer_email: signerEmail,
        signer_name: signerName,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (esignErr || !esign) {
      return NextResponse.json(
        { ok: false, error: "Enveloppe créée mais non enregistrée : " + (esignErr?.message ?? "?") },
        { status: 500 },
      );
    }

    const { url } = await getEmbeddedSigningUrl(cfg, envelopeId, {
      email: signerEmail,
      name: signerName,
      returnUrl: `${appUrl}/dashboard/esign/done?esign=${esign.id}&quote=${quoteId}`,
    });

    return NextResponse.json({
      ok: true,
      esign_id: esign.id,
      envelope_id: envelopeId,
      signing_url: url,
      status: "sent",
    });
  } catch (err) {
    if (err instanceof DocusignError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { ok: false, error: "Erreur DocuSign : " + (err instanceof Error ? err.message : "?") },
      { status: 500 },
    );
  }
}
