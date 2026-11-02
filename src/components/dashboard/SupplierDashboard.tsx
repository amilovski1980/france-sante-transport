import Link from "next/link";
import type { SupplierWorkspace } from "@/lib/supplier-data";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const df = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

function date(value: string | null | undefined) {
  if (!value) return "—";
  return df.format(new Date(value));
}

const QUICK_LINKS = [
  { href: "/dashboard/supplier/stock", label: "Stock & catalogue", hint: "Lots, niveaux, réceptions" },
  { href: "/dashboard/supplier/planning", label: "Plannings", hint: "Préparer et transmettre" },
  { href: "/dashboard/supplier/deliveries", label: "Livraisons", hint: "Suivi et preuves" },
  { href: "/dashboard/supplier/invoices", label: "Factures d'achat", hint: "Import et lignes" },
  { href: "/dashboard/supplier/recipients", label: "Destinataires", hint: "Laboratoires, hôpitaux…" },
];

export default function SupplierDashboard({ workspace }: { workspace: SupplierWorkspace }) {
  const { supplier, warehouses, products, lots, stockLevels, schedules, deliveries, recipients, invoices } = workspace;

  if (!supplier) {
    return (
      <div className="surface p-8 text-center">
        <h1 className="font-display text-xl font-semibold text-navy-900 dark:text-white">Espace fournisseur</h1>
        <p className="mt-2 text-sm text-slate-500">
          Aucun fournisseur n&apos;est rattaché à votre compte. Contactez l&apos;administration.
        </p>
      </div>
    );
  }

  const available = stockLevels.reduce(
    (sum, level) => sum + Math.max(0, level.qty_on_hand - level.qty_reserved - level.qty_shipped),
    0,
  );
  const reserved = stockLevels.reduce((sum, level) => sum + level.qty_reserved, 0);
  const lowStock = stockLevels.filter(
    (level) => level.qty_on_hand - level.qty_reserved - level.qty_shipped <= 5,
  ).length;
  const now = Date.now();
  const expiring = lots.filter((lot) => {
    if (!lot.expiry_date) return false;
    const delta = new Date(lot.expiry_date).getTime() - now;
    return delta >= 0 && delta <= 30 * 24 * 60 * 60 * 1000;
  }).length;
  const toValidate = schedules.filter((s) => s.status === "draft").length;
  const toTransmit = schedules.filter((s) => s.status === "validated").length;
  const activeDeliveries = deliveries.filter((d) =>
    ["pending", "scheduled", "in_progress"].includes(d.status),
  );
  const upcoming = [...activeDeliveries]
    .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))
    .slice(0, 5);
  const recentInvoices = invoices.slice(0, 3);

  return (
    <div className="space-y-5">
      <div className="card-pro overflow-hidden">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-flagred-600">Espace fournisseur</p>
            <h1 className="mt-0.5 font-display text-2xl font-bold text-navy-900 dark:text-white">{supplier.code}</h1>
            <p className="mt-1 text-xs text-slate-400">
              {warehouses.length} entrepôt{warehouses.length > 1 ? "s" : ""} · {products.length} produit
              {products.length > 1 ? "s" : ""} · {recipients.length} destinataire{recipients.length > 1 ? "s" : ""}
            </p>
          </div>
          <span className="w-fit rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            {supplier.active ? "Fournisseur actif" : "Inactif"}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Disponible" value={`${nf.format(available)} u.`} hint={`${nf.format(reserved)} réservées`} />
        <Stat label="Lots" value={String(lots.length)} hint={`${expiring} périment sous 30 j`} tone={expiring > 0 ? "warn" : undefined} />
        <Stat label="À traiter" value={String(toValidate + toTransmit)} hint={`${toValidate} à valider · ${toTransmit} à transmettre`} />
        <Stat label="Livraisons" value={String(activeDeliveries.length)} hint={`${lowStock} lot(s) en stock faible`} tone={lowStock > 0 ? "warn" : undefined} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {QUICK_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="card-pro group p-4 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <p className="font-display text-sm font-semibold text-navy-900 group-hover:text-flagred-700 dark:text-white">
              {item.label}
            </p>
            <p className="mt-1 text-xs text-slate-400">{item.hint}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-pro overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/10">
            <h2 className="font-display text-sm font-semibold text-navy-900 dark:text-white">Prochaines livraisons</h2>
            <Link href="/dashboard/supplier/deliveries" className="text-xs font-semibold text-navy-600 hover:underline dark:text-slate-300">
              Tout voir
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">Aucune livraison active.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/10">
              {upcoming.map((delivery) => {
                const recipient = recipients.find((r) => r.id === delivery.recipient_id);
                const schedule = schedules.find((s) => s.id === delivery.delivery_schedule_id);
                return (
                  <li key={delivery.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">
                        {recipient?.name ?? "Destinataire"}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {schedule?.label || `Planning du ${date(schedule?.requested_date)}`} · {date(delivery.scheduled_at)}
                      </p>
                    </div>
                    <StatusPill status={delivery.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card-pro overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/10">
            <h2 className="font-display text-sm font-semibold text-navy-900 dark:text-white">Dernières factures</h2>
            <Link href="/dashboard/supplier/invoices" className="text-xs font-semibold text-navy-600 hover:underline dark:text-slate-300">
              Tout voir
            </Link>
          </div>
          {recentInvoices.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">Aucune facture d&apos;achat importée.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/10">
              {recentInvoices.map((invoice) => (
                <li key={invoice.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">
                      {invoice.invoice_number}
                    </p>
                    <p className="text-xs text-slate-400">{date(invoice.invoice_date ?? invoice.created_at)}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {invoice.total_amount != null ? `${nf.format(invoice.total_amount)} €` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "warn";
}) {
  return (
    <div className="card-pro p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-navy-900 dark:text-white">{value}</p>
      <p className={`mt-1 text-xs ${tone === "warn" ? "font-semibold text-amber-600 dark:text-amber-400" : "text-slate-400"}`}>
        {hint}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
    scheduled: "bg-navy-50 text-navy-700 dark:bg-white/10 dark:text-slate-200",
    in_progress: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    delivered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    failed: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    cancelled: "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400",
  };
  const labels: Record<string, string> = {
    pending: "En attente",
    scheduled: "Planifiée",
    in_progress: "En cours",
    delivered: "Livrée",
    failed: "Échec",
    cancelled: "Annulée",
  };
  return (
    <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${map[status] ?? map.pending}`}>
      {labels[status] ?? status}
    </span>
  );
}
