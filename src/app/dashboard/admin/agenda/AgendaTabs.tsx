"use client";

import { useState } from "react";
import DispatchCalendar from "@/components/dashboard/DispatchCalendar";
import DriverSchedulePanel from "@/components/dashboard/DriverSchedulePanel";
import DriverKpiPanel from "@/components/dashboard/DriverKpiPanel";
import type { DriverAssignment, Profile, Shipment, TransportRequest, Vehicle } from "@/lib/types";

type Tab = "calendar" | "schedule" | "performance";

const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: "calendar", label: "Calendrier", icon: "🗓️" },
  { key: "schedule", label: "Planning chauffeurs", icon: "🕒" },
  { key: "performance", label: "Performance", icon: "📈" },
];

export default function AgendaTabs({
  shipments,
  requests,
  assignments,
  drivers,
  vehicles,
}: {
  shipments: Shipment[];
  requests: TransportRequest[];
  assignments: DriverAssignment[];
  drivers: Profile[];
  vehicles: Vehicle[];
}) {
  const [tab, setTab] = useState<Tab>("calendar");

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-2xl border border-slate-200/80 bg-white/80 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? "page" : undefined}
            className={
              tab === t.key
                ? "flex items-center gap-2 rounded-xl bg-navy-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition"
                : "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100"
            }
          >
            <span aria-hidden="true">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "calendar" && (
        <DispatchCalendar shipments={shipments} requests={requests} assignments={assignments} drivers={drivers} />
      )}
      {tab === "schedule" && (
        <DriverSchedulePanel drivers={drivers} shipments={shipments} assignments={assignments} requests={requests} />
      )}
      {tab === "performance" && <DriverKpiPanel drivers={drivers} assignments={assignments} shipments={shipments} />}
    </div>
  );
}
