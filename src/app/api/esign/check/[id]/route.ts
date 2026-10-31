import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getEnvelopeStatus, loadDocusignConfig, DocusignError } from "@/lib/docusign";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/esign/check/[id] — rafraîchit le statut d'une enveloppe
 * (id = ligne esign_documents). Si l'enveloppe est completed, le PDF
 * signé est téléchargé et archivé dans le bucket privé « esign ».
 * Accès : staff ou client propriétaire du devis.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentification requise" }, { status: 401 });

  const { data: row } = await supabase.from("esign_documents").select("*").eq("id", id).single();
  if (!row) return NextResponse.json({ ok: false, error: "Signature introuvable" }, { status: 404 });

  const cfg = await loadDocusignConfig();
  if (!cfg) return NextResponse.json({ ok: false, error: "DocuSign non configuré" }, { status: 400 });

  if (!row.envelope_id || row.status === "completed" || row.status === "voided") {
    return NextResponse.json({ ok: true, status: row.status, signed_at: row.signed_at });
  }

  try {
    const status = await getEnvelopeStatus(cfg, row.envelope_id);

    let signedPdfPath: string | null = row.signed_pdf_path;
    let signedAt: string | null = row.signed_at;

    if (status === "completed" && !signedPdfPath) {
      const pdf = await import("@/lib/docusign/index").then((m) => m.downloadCompletedDocument(cfg, row.envelope_id!));
      const admin = createAdminClient();
      const path = `esign/signed/${row.id}.pdf`;
      const buffer = Buffer.from(await pdf.arrayBuffer());
      const { error: uploadErr } = await admin.storage.from("esign").upload(path, buffer, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (!uploadErr) {
        signedPdfPath = path;
        signedAt = new Date().toISOString();
      }
    }

    const { data: updated } = await supabase
      .from("esign_documents")
      .update({ status, signed_pdf_path: signedPdfPath, signed_at: signedAt })
      .eq("id", row.id)
      .select("status, signed_at, signed_pdf_path")
      .single();

    return NextResponse.json({ ok: true, status, signed_at: updated?.signed_at ?? signedAt, archived: !!signedPdfPath });
  } catch (err) {
    if (err instanceof DocusignError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Vérification impossible : " + (err instanceof Error ? err.message : "?") }, { status: 500 });
  }
}
