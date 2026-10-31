import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const STATUS_FR: Record<string, string> = {
  issued: "émise",
  sent: "envoyée",
  paid: "payée",
  cancelled: "annulée",
};

function csvEscape(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

/**
 * GET /api/invoices/export — export comptable CSV (staff uniquement) de
 * toutes les factures : identifiants, montants HT/TVA/TTC, statut, règlement.
 */
export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentification requise" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin" && me?.role !== "dispatcher") {
    return NextResponse.json({ ok: false, error: "Réservé au staff" }, { status: 403 });
  }

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, client_id, amount, currency, vat_rate, status, issued_at, due_at, paid_at, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Noms des clients en une seule requête
  const clientIds = Array.from(new Set((invoices ?? []).map((i) => String(i.client_id))));
  const names = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data: clients } = await supabase.from("profiles").select("id, full_name, email").in("id", clientIds);
    for (const c of clients ?? []) names.set(c.id, c.full_name || c.email || c.id);
  }

  const header = [
    "Numéro",
    "Client",
    "Statut",
    "Montant HT",
    "TVA %",
    "TVA montant",
    "Montant TTC",
    "Devise",
    "Date émission",
    "Échéance",
    "Date encaissement",
    "Référence interne",
  ];
  const lines = [header.map(csvEscape).join(";")];
  for (const inv of invoices ?? []) {
    const ht = Number(inv.amount);
    const vat = (ht * Number(inv.vat_rate)) / 100;
    lines.push(
      [
        inv.invoice_number ?? "",
        names.get(String(inv.client_id)) ?? "",
        STATUS_FR[String(inv.status)] ?? String(inv.status),
        ht.toFixed(2).replace(".", ","),
        Number(inv.vat_rate).toFixed(2).replace(".", ","),
        vat.toFixed(2).replace(".", ","),
        (ht + vat).toFixed(2).replace(".", ","),
        inv.currency,
        inv.issued_at ?? "",
        inv.due_at ?? "",
        inv.paid_at ? String(inv.paid_at).slice(0, 10) : "",
        String(inv.id),
      ]
        .map(csvEscape)
        .join(";"),
    );
  }

  const csv = `\uFEFF${lines.join("\r\n")}`; // BOM pour Excel FR
  const filename = `factures-fst-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
