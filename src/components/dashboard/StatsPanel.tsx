"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/I18nProvider";
import { computeStats, type DashboardStats } from "@/lib/stats";
import { formatMoney } from "@/components/dashboard/ClientDashboard";
import type {
  DriverAssignment,
  Profile,
  Quote,
  RequestStatus,
  Shipment,
  ShipmentStatus,
  TransportRequest,
  Vehicle,
} from "@/lib/types";

const REQUEST_STATUS_ORDER: RequestStatus[] = [
  "submitted",
  "under_review",
  "quoted",
  "accepted",
  "completed",
  "rejected",
  "cancelled",
  "draft",
];

const SHIPMENT_STATUS_ORDER: ShipmentStatus[] = [
  "pending_confirmation",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
];

const REQUEST_TONE: Record<RequestStatus, string> = {
  draft: "bg-slate-400",
  submitted: "bg-navy-500",
  under_review: "bg-amber-500",
  quoted: "bg-navy-400",
  accepted: "bg-emerald-500",
  rejected: "bg-flagred-500",
  cancelled: "bg-slate-300",
  completed: "bg-emerald-700",
};

const SHIPMENT_TONE: Record<ShipmentStatus, string> = {
  pending_confirmation: "bg-amber-500",
  confirmed: "bg-navy-500",
  in_progress: "bg-navy-400",
  completed: "bg-emerald-600",
  cancelled: "bg-flagred-500",
};

function KpiCard({
  label,
  value,
  hint,
  tone = "navy",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "navy" | "green" | "red" | "amber";
}) {
  const toneClass =
    tone === "green"
      ? "text-emerald-700"
      : tone === "red"
        ? "text-flagred-700"
        : tone === "amber"
          ? "text-amber-700"
          : "text-navy-900";
  return (
    <div className="surface p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-navy-500">{label}</p>
      <p className={`mt-2 font-display text-3xl font-semibold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-navy-500">{hint}</p>}
    </div>
  );
}

function BarRow({ label, count, total, tone }: { label: string; count: number; total: number; tone: string }) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-navy-800">{label}</span>
        <span className="tabular-nums text-navy-500">
          {count} · {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-navy-50">
        <div
          className={`h-full rounded-full ${tone} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function StatsPanel({
  requests,
  quotes,
  shipments,
  assignments,
  drivers,
  vehicles,
}: {
  requests: TransportRequest[];
  quotes: Quote[];
  shipments: Shipment[];
  assignments: DriverAssignment[];
  drivers: Profile[];
  vehicles: Vehicle[];
}) {
  const { t, labels, locale } = useI18n();

  const stats: DashboardStats = useMemo(
    () => computeStats({ requests, quotes, shipments, assignments, drivers, vehicles }),
    [requests, quotes, shipments, assignments, drivers, vehicles],
  );

  const maxDay = Math.max(1, ...stats.requests.last14Days.map((p) => p.count));
  const serviceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of requests) counts.set(r.service_type, (counts.get(r.service_type) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [requests]);

  return (
    <div className="space-y-6">
      {/* KPI principaux */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t("stats.requests")}
          value={String(stats.requests.total)}
          hint={t(stats.requests.today === 1 ? "stats.todayOne" : "stats.todayOther", {
            n: stats.requests.today,
          })}
        />
        <KpiCard
          label={t("stats.toReview")}
          value={String(stats.requests.byStatus.submitted + stats.requests.byStatus.under_review)}
          hint={t("stats.submittedReview")}
          tone="amber"
        />
        <KpiCard
          label={t("stats.departures7")}
          value={String(stats.requests.upcoming7Days)}
          hint={t("stats.plannedNotCancelled")}
        />
        <KpiCard
          label={t("stats.activeMissions")}
          value={String(stats.shipments.active)}
          hint={t("stats.scheduledToday", { n: stats.shipments.scheduledToday })}
          tone={stats.shipments.scheduledToday > 0 ? "green" : "navy"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t("stats.acceptanceRate")}
          value={`${stats.quotes.acceptanceRate}%`}
          hint={t("stats.acceptedDeclined", {
            a: stats.quotes.accepted,
            d: stats.quotes.declined,
          })}
          tone={stats.quotes.acceptanceRate >= 50 ? "green" : "amber"}
        />
        <KpiCard
          label={t("stats.quotesAccepted")}
          value={formatMoney(stats.quotes.acceptedAmount, stats.quotes.currency, locale)}
          hint={t("stats.quotesShown", { n: stats.quotes.sent })}
          tone="green"
        />
        <KpiCard
          label={t("stats.drivers")}
          value={`${stats.drivers.busy} / ${stats.drivers.total}`}
          hint={`${t("stats.busyPrefix")}${t(
            stats.drivers.available === 1 ? "stats.availOne" : "stats.availOther",
            { n: stats.drivers.available },
          )}${
            stats.drivers.pending > 0
              ? t("stats.pendingSuffix", { n: stats.drivers.pending })
              : ""
          }`}
          tone={stats.drivers.available === 0 && stats.drivers.total > 0 ? "red" : "navy"}
        />
        <KpiCard
          label={t("stats.fleet")}
          value={`${stats.fleet.vehiclesInUse} / ${stats.fleet.vehiclesActive}`}
          hint={t("stats.vehiclesTotal", { n: stats.fleet.vehiclesTotal })}
        />
      </div>

      {/* Activité 14 jours + statistut des demandes */}
      <div className="grid gap-6 lg:grid-cols-2">
        <article className="surface p-5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-navy-500">
            {t("stats.activity14")}
          </h3>
          <div className="mt-5 flex h-36 items-end gap-1.5">
            {stats.requests.last14Days.map((p) => (
              <div key={p.day} className="group relative flex-1">
                <div
                  className={`w-full rounded-t transition-all duration-500 ${
                    p.count > 0 ? "bg-navy-600" : "bg-navy-100"
                  }`}
                  style={{ height: `${Math.max(4, (p.count / maxDay) * 132)}px` }}
                  title={t(p.count === 1 ? "stats.dayOne" : "stats.dayOther", {
                    d: p.day,
                    c: p.count,
                  })}
                />
                <span className="absolute inset-x-0 -top-6 hidden text-center text-[10px] font-semibold text-navy-700 group-hover:block">
                  {p.count}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-navy-400">
            <span>{stats.requests.last14Days[0]?.day.slice(8)}/{stats.requests.last14Days[0]?.day.slice(5, 7)}</span>
            <span>{t("stats.todayWord")}</span>
          </div>
        </article>

        <article className="surface p-5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-navy-500">
            {t("stats.requestsByStatus")}
          </h3>
          <div className="mt-4 space-y-3">
            {REQUEST_STATUS_ORDER.filter((s) => stats.requests.byStatus[s] > 0).map((s) => (
              <BarRow
                key={s}
                label={labels.request[s]}
                count={stats.requests.byStatus[s]}
                total={stats.requests.total}
                tone={REQUEST_TONE[s]}
              />
            ))}
            {stats.requests.total === 0 && (
              <p className="py-6 text-center text-sm text-navy-500">{t("stats.noRequests")}</p>
            )}
          </div>
        </article>
      </div>

      {/* Missions + services */}
      <div className="grid gap-6 lg:grid-cols-2">
        <article className="surface p-5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-navy-500">
            {t("stats.missionsByStatus")}
          </h3>
          <div className="mt-4 space-y-3">
            {SHIPMENT_STATUS_ORDER.filter((s) => stats.shipments.byStatus[s] > 0).map((s) => (
              <BarRow
                key={s}
                label={labels.shipment[s]}
                count={stats.shipments.byStatus[s]}
                total={stats.shipments.total}
                tone={SHIPMENT_TONE[s]}
              />
            ))}
            {stats.shipments.total === 0 && (
              <p className="py-6 text-center text-sm text-navy-500">{t("stats.noMissions")}</p>
            )}
          </div>
        </article>

        <article className="surface p-5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-navy-500">
            {t("stats.byService")}
          </h3>
          <div className="mt-4 space-y-3">
            {serviceCounts.map(([type, count]) => (
              <BarRow
                key={type}
                label={labels.service[type as keyof typeof labels.service] ?? type}
                count={count}
                total={stats.requests.total}
                tone="bg-navy-500"
              />
            ))}
            {serviceCounts.length === 0 && (
              <p className="py-6 text-center text-sm text-navy-500">{t("stats.noData")}</p>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
