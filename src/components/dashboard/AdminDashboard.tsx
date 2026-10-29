"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/I18nProvider";
import StatCard from "@/components/dashboard/StatCard";
import PanelCard from "@/components/dashboard/PanelCard"; import MarginCalculator from "@/components/dashboard/MarginCalculator";
import { RequestStatusBadge } from "@/components/StatusBadge";
import { formatDateTime, formatMoney } from "@/components/dashboard/ClientDashboard";
import type { Quote, Shipment, TransportRequest } from "@/lib/types";

export default function AdminDashboard({
  requests,
  quotes,
  shipments,
}: {
  requests: TransportRequest[];
  quotes: Quote[];
  shipments: Shipment[];
}) {
  const { t, locale } = useI18n();

  const stats = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const pending = requests.filter((r) => r.status === "submitted" || r.status === "under_review").length;
    const active = shipments.filter((s) => s.status === "confirmed" || s.status === "in_progress").length;
    const acceptedQuotes = quotes.filter((q) => q.status === "accepted");
    const revenueToday = acceptedQuotes
      .filter((q) => q.accepted_at && new Date(q.accepted_at).toDateString() === today)
      .reduce((sum, q) => sum + Number(q.amount), 0);
    const revenueTotal = acceptedQuotes.reduce((sum, q) => sum + Number(q.amount), 0);
    const margin = Math.round(revenueTotal * 0.26);
    return { pending, active, revenueToday, revenueTotal, margin };
  }, [requests, quotes, shipments]);

  const recentRequests = useMemo(
    () => [...requests].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6),
    [requests],
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("adm.kpiPending")} value={String(stats.pending)} tone="blue" icon={<span>📄</span>} />
        <StatCard label={t("adm.kpiRevenue")} value={formatMoney(stats.revenueToday, "EUR", locale)} trend="+12%" tone="green" icon={<span>💶</span>} />
        <StatCard label={t("adm.kpiMargin")} value={formatMoney(stats.margin, "EUR", locale)} trend="+14%" tone="purple" icon={<span>📈</span>} />
        <StatCard label={t("adm.kpiActive")} value={String(stats.active)} tone="orange" icon={<span>🚐</span>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2"><PanelCard title={t("mc.advised")}><MarginCalculator /></PanelCard><PanelCard title={t("adm.requestsTitle")} action={<span className="text-xs text-slate-400">{requests.length}</span>}>
        <ul className="divide-y divide-slate-100">
          {recentRequests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{r.pickup_address} → {r.dropoff_address}</p>
                <p className="text-xs text-slate-400">{formatDateTime(r.created_at, locale)}</p>
              </div>
              <RequestStatusBadge status={r.status} />
            </li>
          ))}
          {recentRequests.length === 0 && (
            <li className="py-6 text-center text-sm text-slate-500">{t("adm.noRequests")}</li>
          )}
        </ul>
      </PanelCard></div>
    </div>
  );
}

