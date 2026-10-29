import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QUOTE_STATUS_LABELS, SERVICE_TYPE_LABELS } from "@/lib/labels";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Devis — France Santé Transport",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function fmtMoney(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
}

export default async function QuotePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  // Les politiques RLS garantissent que seuls le client propriétaire et le
  // personnel (admin/dispatcher) accèdent à ce devis — et donc à la page.
  const { data: quote } = await supabase.from("quotes").select("*").eq("id", id).single();
  if (!quote) notFound();

  const [{ data: request }, { data: lines }, { data: settings }] = await Promise.all([
    supabase.from("transport_requests").select("*").eq("id", quote.transport_request_id).single(),
    supabase
      .from("quote_lines")
      .select("*")
      .eq("quote_id", quote.id)
      .order("position", { ascending: true }),
    supabase.from("site_settings").select("slogan, logo_url, logo_alt").maybeSingle(),
  ]);

  if (!request) notFound();

  const [{ data: client }, { data: author }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, phone")
      .eq("id", request.client_id)
      .single(),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", quote.created_by)
      .maybeSingle(),
  ]);

  const total = Number(quote.amount);
  const hasLines = (lines?.length ?? 0) > 0;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PrintButton />

      <article className="surface p-8 print:border-0 print:p-0 print:shadow-none sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-navy-900 pb-6">
          <div className="flex items-start gap-4">
            {settings?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logo_url}
                alt={settings.logo_alt || "Logo"}
                className="h-14 w-auto print:h-12"
              />
            )}
            <div>
              <p className="font-display text-2xl font-bold tracking-tight text-navy-900">
                France Santé Transport
              </p>
              {settings?.slogan && (
                <p className="mt-1 text-sm italic text-navy-600">{settings.slogan}</p>
              )}
              <p className="mt-2 text-xs leading-relaxed text-navy-500">
                Transport médical &amp; sanitaire — VSL, brancards, fauteuils
                <br />
                Devis : devis@france-sante-transport.fr · 01 84 80 00 00
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-flagred-600">
              Devis
            </p>
            <p className="mt-1 font-display text-3xl font-bold text-navy-900">
              V{quote.version}
            </p>
            <p className="mt-1 text-xs text-navy-600">
              Statut : {QUOTE_STATUS_LABELS[quote.status as keyof typeof QUOTE_STATUS_LABELS]}
            </p>
            <p className="text-xs text-navy-600">Émis le {fmtDate(quote.created_at)}</p>
            {quote.valid_until && (
              <p className="text-xs text-navy-600">
                Valable jusqu&apos;au {fmtDate(quote.valid_until)}
              </p>
            )}
          </div>
        </header>

        <section className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl bg-navy-50 p-4 print:bg-transparent print:p-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-navy-500">
              Client
            </p>
            <p className="mt-1.5 text-sm font-semibold text-navy-900">
              {client?.full_name || client?.email || "—"}
            </p>
            <p className="text-xs text-navy-600">{client?.email}</p>
            {client?.phone && <p className="text-xs text-navy-600">{client.phone}</p>}
          </div>
          <div className="rounded-xl bg-navy-50 p-4 print:bg-transparent print:p-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-navy-500">
              Prestation
            </p>
            <p className="mt-1.5 text-sm text-navy-800">
              <span className="font-semibold">{request.pickup_address}</span>
              <span className="mx-2 text-navy-400">→</span>
              <span className="font-semibold">{request.dropoff_address}</span>
            </p>
            <p className="mt-1 text-xs text-navy-600">
              {fmtDate(request.pickup_datetime)} ·{" "}
              {SERVICE_TYPE_LABELS[request.service_type as keyof typeof SERVICE_TYPE_LABELS]}
            </p>
            {request.patient_name && (
              <p className="mt-1 text-xs text-navy-600">Patient : {request.patient_name}</p>
            )}
            {request.mobility_notes && (
              <p className="mt-1 text-xs leading-relaxed text-navy-600">
                précisions : {request.mobility_notes}
              </p>
            )}
          </div>
        </section>

        <section className="mt-8">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-navy-900 text-[11px] uppercase tracking-wider text-navy-600">
                <th className="py-2 pr-3">Désignation</th>
                <th className="py-2 pr-3 text-right">Quantité</th>
                <th className="py-2 pr-3 text-right">Prix unitaire</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {hasLines ? (
                lines?.map((line) => (
                  <tr key={line.id} className="border-b border-navy-100">
                    <td className="py-2.5 pr-3 text-navy-800">{line.description}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-navy-700">
                      {Number(line.quantity)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-navy-700">
                      {fmtMoney(Number(line.unit_price), quote.currency)}
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular-nums text-navy-900">
                      {fmtMoney(Number(line.quantity) * Number(line.unit_price), quote.currency)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-navy-100">
                  <td className="py-2.5 pr-3 text-navy-800">
                    Transport médical conforme à la demande
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-navy-700">1</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-navy-700">
                    {fmtMoney(total, quote.currency)}
                  </td>
                  <td className="py-2.5 text-right font-semibold tabular-nums text-navy-900">
                    {fmtMoney(total, quote.currency)}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-navy-900">
                <td colSpan={3} className="py-3 pr-3 text-right text-xs font-semibold uppercase tracking-wider text-navy-600">
                  Total TTC
                </td>
                <td className="py-3 text-right font-display text-xl font-bold text-navy-900">
                  {fmtMoney(total, quote.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        {quote.notes && (
          <p className="mt-6 rounded-xl bg-navy-50 px-4 py-3 text-xs leading-relaxed text-navy-700 print:bg-transparent">
            Note : {quote.notes}
          </p>
        )}

        <section className="mt-8 grid gap-6 border-t border-navy-200 pt-6 sm:grid-cols-2 print:break-inside-avoid">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-navy-500">
              Conditions
            </p>
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-navy-600">
              <li>Devis valable {quote.valid_until ? `jusqu'au ${fmtDate(quote.valid_until)}` : "30 jours à compter de son émission"}.</li>
              <li>Acceptation par retour d&apos;e-mail ou signature du client.</li>
              <li>Facturation après réalisation de la mission.</li>
            </ul>
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-navy-500">
              Pour France Santé Transport
            </p>
            <p className="mt-2 text-sm font-semibold text-navy-900">
              {author?.full_name || "Service commercial"}
            </p>
            <p className="mt-6 border-t border-navy-300 pt-1 text-[11px] text-navy-400">
              Cachet &amp; signature
            </p>
          </div>
        </section>

        <footer className="mt-8 border-t border-navy-200 pt-4 text-center text-[11px] leading-relaxed text-navy-500">
          France Santé Transport — transport médical et sanitaire
          {settings?.slogan ? ` · ${settings.slogan}` : ""}
          <br />
          Document généré le {fmtDate(new Date().toISOString())} · Devis V{quote.version} ·{" "}
          {QUOTE_STATUS_LABELS[quote.status as keyof typeof QUOTE_STATUS_LABELS]}
        </footer>
      </article>
    </div>
  );
}
