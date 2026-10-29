"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { ShipmentStatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/components/dashboard/ClientDashboard";
import type { DriverAssignment, Profile, Shipment, TransportRequest } from "@/lib/types";

type ViewMode = "week" | "list";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function DispatchCalendar({
  shipments,
  requests,
  assignments,
  drivers,
}: {
  shipments: Shipment[];
  requests: TransportRequest[];
  assignments: DriverAssignment[];
  drivers: Profile[];
}) {
  const { t, locale } = useI18n();
  const [view, setView] = useState<ViewMode>("week");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));

  const requestById = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests]);
  const driverById = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);
  const assignmentByShipment = useMemo(() => {
    const m = new Map<string, DriverAssignment>();
    for (const a of assignments) {
      if (a.status === "declined" || a.status === "cancelled") continue;
      if (!m.has(a.shipment_id)) m.set(a.shipment_id, a);
    }
    return m;
  }, [assignments]);

  const weekStart = useMemo(() => {
    const d = startOfDay(cursor);
    const dow = (d.getDay() + 6) % 7;
    return addDays(d, -dow);
  }, [cursor]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const sorted = useMemo(
    () => [...shipments].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    [shipments],
  );

  function renderShipment(shipment: Shipment) {
    const request = requestById.get(shipment.transport_request_id);
    const assignment = assignmentByShipment.get(shipment.id);
    const driver = assignment ? driverById.get(assignment.driver_id) : undefined;
    return (
      <li key={shipment.id} className="rounded-lg border border-navy-100 bg-white p-2 text-xs shadow-sm">
        <div className="flex items-center justify-between gap-1">
          <span className="font-semibold text-navy-900">
            {new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(
              new Date(shipment.scheduled_at),
            )}
          </span>
          <ShipmentStatusBadge status={shipment.status} />
        </div>
        <p className="mt-1 truncate text-navy-600">
          {request ? request.pickup_address : t("cal.noRequest")}
        </p>
        <p className="truncate text-navy-400">
          {driver ? driver.full_name || driver.email : t("cal.unassigned")}
        </p>
      </li>
    );
  }

  return (
    <div className="surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-100 bg-navy-50/50 px-5 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-navy-500">
          {t("cal.title")}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCursor((c) => addDays(c, -7))}
            className="rounded-full border border-navy-200 px-3 py-1 text-xs font-semibold text-navy-700 hover:bg-white"
          >
            {t("cal.prev")}
          </button>
          <button
            type="button"
            onClick={() => setCursor(startOfDay(new Date()))}
            className="rounded-full border border-navy-200 px-3 py-1 text-xs font-semibold text-navy-700 hover:bg-white"
          >
            {t("cal.today")}
          </button>
          <button
            type="button"
            onClick={() => setCursor((c) => addDays(c, 7))}
            className="rounded-full border border-navy-200 px-3 py-1 text-xs font-semibold text-navy-700 hover:bg-white"
          >
            {t("cal.next")}
          </button>
          <div className="ml-2 flex overflow-hidden rounded-full border border-navy-200">
            <button
              type="button"
              onClick={() => setView("week")}
              className={`px-3 py-1 text-xs font-semibold ${view === "week" ? "bg-navy-800 text-white" : "text-navy-700"}`}
            >
              {t("cal.viewWeek")}
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`px-3 py-1 text-xs font-semibold ${view === "list" ? "bg-navy-800 text-white" : "text-navy-700"}`}
            >
              {t("cal.viewList")}
            </button>
          </div>
        </div>
      </div>

      {view === "week" ? (
        <div className="grid grid-cols-1 divide-y divide-navy-100 sm:grid-cols-7 sm:divide-x sm:divide-y-0">
          {days.map((day) => {
            const dayItems = sorted.filter((s) => sameDay(new Date(s.scheduled_at), day));
            const isToday = sameDay(day, new Date());
            return (
              <div key={day.toISOString()} className={`min-h-[120px] p-2 ${isToday ? "bg-flagred-50/40" : ""}`}>
                <p className="mb-2 text-center text-xs font-semibold text-navy-500">
                  {new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric" }).format(day)}
                </p>
                <ul className="space-y-1.5">
                  {dayItems.length === 0 ? (
                    <li className="text-center text-[10px] text-navy-300">—</li>
                  ) : (
                    dayItems.map(renderShipment)
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <ul className="divide-y divide-navy-100">
          {sorted.length === 0 ? (
            <li className="p-8 text-center text-sm text-navy-500">{t("cal.empty")}</li>
          ) : (
            sorted.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="text-sm text-navy-800">{formatDateTime(s.scheduled_at, locale)}</span>
                <ShipmentStatusBadge status={s.status} />
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
