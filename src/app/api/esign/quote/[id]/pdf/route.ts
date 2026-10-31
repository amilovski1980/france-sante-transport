import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildQuotePdf } from "@/lib/pdf/quote";
import type { Quote, QuoteClient, QuoteLine, TransportRequest } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/esign/quote/[id]/pdf — télécharge le devis en PDF
 * (le même document que DocuSign envoie à signer).
 * Accès : staff ou client propriétaire (RLS quotes).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, error: "Identifiant invalide" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentification requise" }, { status: 401 });

  const { data: quote } = await supabase.from("quotes").select("*").eq("id", id).single();
  if (!quote) return NextResponse.json({ ok: false, error: "Devis introuvable" }, { status: 404 });

  const [requestRes, linesRes, clientRes] = await Promise.all([
    supabase.from("transport_requests").select("*").eq("id", quote.transport_request_id).single(),
    supabase.from("quote_lines").select("*").eq("quote_id", quote.id).order("position", { ascending: true }),
    supabase.from("profiles").select("full_name, email, phone").eq("id", quote.client_id).single(),
  ]);
  if (!requestRes.data) return NextResponse.json({ ok: false, error: "Demande introuvable" }, { status: 404 });

  try {
    const pdf = await buildQuotePdf({
      quote: quote as Quote,
      lines: (linesRes.data ?? []) as QuoteLine[],
      request: requestRes.data as TransportRequest,
      client: clientRes.data as QuoteClient,
    });
    const bytes = pdf as Uint8Array;
    const source = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const ref = `devis-V${quote.version}-${id.slice(0, 8)}.pdf`;
    return new NextResponse(source as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${ref}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Génération PDF impossible : " + (err instanceof Error ? err.message : "?") }, { status: 500 });
  }
}
