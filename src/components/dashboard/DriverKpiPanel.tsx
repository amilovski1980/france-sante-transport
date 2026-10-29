"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/I18nProvider";
import type { DriverAssignment, Profile, Shipment } from "@/lib/types";

interface DriverAgg {
  driver: Profile;
  total: number;
  accepted: number;
  declined: number;
  completed: number;
  upcoming: number;
}

function Kpi({ label, value, hint, tone = "navy" }: { label: string; value: string; hint?: string; tone?: "navy" | "green" | "red" | "amber" }) {
  const toneClass =
    tone === "green" ? "text-emerald-700" : tone === "red" ? "text-flagred-700" : tone === "amber" ? "text-amber-700" : "text-navy-900";
  return (
    <div className="surface p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-navy-500">{label}</p>
      <p className={`mt-2 font-display text-3xl font-semibold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-navy-500">{hint}</p>}
    </div>
  );
}

export default function DriverKpiPanel({
  drivers,
  assignments,
  shipments,
}: {
  drivers: Profile[];
  assignments: DriverAssignment[];
  shipments: Shipment[];
}) {
  const { t } = useI18n();

  const shipmentById = useMemo(() => new Map(shipments.map((s) => [s.id, s])), [shipments]);

  const rows = useMemo<DriverAgg[]>(() => {
    const now = Date.now();
    const byDriver = new Map<string, DriverAgg>();
    for (const d of drivers) {
      byDriver.set(d.id, { driver: d, total: 0, accepted: 0, declined: 0, completed: 0, upcoming: 0 });
    }
    for (const a of assignments) {
      const row = byDriver.get(a.driver_id);
      if (!row) continue;
      if (a.status === "cancelled") continue;
      row.total += 1;
      if (a.status === "accepted" || a.status === "completed") row.accepted += 1;
      if (a.status === "declined") row.declined += 1;
      const s = shipmentById.get(a.shipment_id);
      if (s) {
        if (s.status === "completed") row.completed += 1;
        else if (new Date(s.scheduled_at).getTime() >= now) row.upcoming += 1;
      }
    }
    return Array.from(byDriver.values()).sort((x, y) => y.completed - x.completed || y.total - x.total);
  }, [drivers, assignments, shipmentById]);

  const totals = useMemo(() => {
    const t0 = { total: 0, accepted: 0, declined: 0, completed: 0, upcoming: 0 };
    for (const r of rows) {
      t0.total += r.total;
      t0.accepted += r.accepted;
      t0.declined += r.declined;
      t0.completed += r.completed;
      t0.upcoming += r.upcoming;
    }
    return t0;
  }, [rows]);

  const acceptRate = totals.total === 0 ? 0 : Math.round(((totals.accepted + totals.completed) / totals.total) * 100);
  const maxCompleted = rows.reduce((m, r) => Math.max(m, r.completed), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={t("dkpi.drivers")} value={String(drivers.length)} />
        <Kpi label={t("dkpi.completed")} value={String(totals.completed)} tone="green" />
        <Kpi label={t("dkpi.upcoming")} value={String(totals.upcoming)} tone="amber" />
        <Kpi label={t("dkpi.acceptRate")} value={`${acceptRate}%`} hint={t("dkpi.acceptHint")} tone={acceptRate >= 70 ? "green" : "red"} />
      </div>

      <div className="surface overflow-hidden">
        <div className="border-b border-navy-100 bg-navy-50/50 px-5 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-navy-500">{t("dkpi.ranking")}</h3>
        </div>
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-navy-500">{t("dkpi.empty")}</p>
        ) : (
          <ul className="divide-y divide-navy-100">
            {rows.map((r) => {
              const pct = maxCompleted === 0 ? 0 : Math.round((r.completed / maxCompleted) * 100);
              return (
                <li key={r.driver.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-navy-900">{r.driver.full_name || r.driver.email}</span>
                    <span className="text-xs text-navy-500">{t("dkpi.rowStats", { done: r.completed, upcoming: r.upcoming, total: r.total })}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-navy-50">
                    <div className="h-full rounded-full bg-emerald-600 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  {r.declined > 0 && <p className="mt-1 text-xs text-flagred-600">{t("dkpi.declined", { n: r.declined })}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
