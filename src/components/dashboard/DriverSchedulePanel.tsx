"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { AssignmentStatusBadge, ShipmentStatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/components/dashboard/ClientDashboard";
import type {
  DriverAssignment,
  Profile,
  Shipment,
  TransportRequest,
} from "@/lib/types";

type Bucket = "upcoming" | "past";

export default function DriverSchedulePanel({
  drivers,
  shipments,
  assignments,
  requests,
}: {
  drivers: Profile[];
  shipments: Shipment[];
  assignments: DriverAssignment[];
  requests: TransportRequest[];
}) {
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const [bucket, setBucket] = useState<Bucket>("upcoming");

  const requestById = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests]);
  const shipmentById = useMemo(() => new Map(shipments.map((s) => [s.id, s])), [shipments]);

  const assignmentsByDriver = useMemo(() => {
    const m = new Map<string, DriverAssignment[]>();
    for (const a of assignments) {
      const list = m.get(a.driver_id) ?? [];
      list.push(a);
      m.set(a.driver_id, list);
    }
    return m;
  }, [assignments]);

  const now = Date.now();

  function driverStats(driverId: string) {
    const list = assignmentsByDriver.get(driverId) ?? [];
    let total = 0;
    let done = 0;
    let upcoming = 0;
    for (const a of list) {
      if (a.status === "declined" || a.status === "cancelled") continue;
      total += 1;
      const shipment = shipmentById.get(a.shipment_id);
      if (!shipment) continue;
      const ts = new Date(shipment.scheduled_at).getTime();
      if (shipment.status === "completed") done += 1;
      else if (ts >= now) upcoming += 1;
    }
    return { total, done, upcoming };
  }

  const selectedDriver = selected ? drivers.find((d) => d.id === selected) : undefined;

  const selectedAssignments = useMemo(() => {
    if (!selected) return [];
    const list = (assignmentsByDriver.get(selected) ?? []).filter(
      (a) => a.status !== "declined" && a.status !== "cancelled",
    );
    const withShipment = list
      .map((a) => ({ a, s: shipmentById.get(a.shipment_id) }))
      .filter((x): x is { a: DriverAssignment; s: Shipment } => Boolean(x.s));
    withShipment.sort((x, y) => x.s.scheduled_at.localeCompare(y.s.scheduled_at));
    const filtered = withShipment.filter(({ s }) => {
      const isPast = new Date(s.scheduled_at).getTime() < now || s.status === "completed";
      return bucket === "past" ? isPast : !isPast;
    });
    return bucket === "past" ? filtered.reverse() : filtered;
  }, [selected, assignmentsByDriver, shipmentById, bucket, now]);

  return (
    <div className="surface overflow-hidden">
      <div className="border-b border-navy-100 bg-navy-50/50 px-5 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-navy-500">
          {t("dsp.title")}
        </h3>
      </div>
      <div className="grid gap-0 md:grid-cols-[280px_1fr]">
        <ul className="divide-y divide-navy-100 border-b border-navy-100 md:border-b-0 md:border-r">
          {drivers.length === 0 ? (
            <li className="p-5 text-sm text-navy-500">{t("dsp.noDrivers")}</li>
          ) : (
            drivers.map((driver) => {
              const stats = driverStats(driver.id);
              const active = selected === driver.id;
              return (
                <li key={driver.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(driver.id)}
                    className={`w-full px-4 py-3 text-left transition-colors ${active ? "bg-navy-800 text-white" : "hover:bg-navy-50"}`}
                  >
                    <p className={`text-sm font-semibold ${active ? "text-white" : "text-navy-900"}`}>
                      {driver.full_name || driver.email}
                    </p>
                    <p className={`mt-0.5 text-xs ${active ? "text-navy-200" : "text-navy-500"}`}>
                      {t("dsp.stats", { done: stats.done, upcoming: stats.upcoming, total: stats.total })}
                    </p>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="p-5">
          {!selectedDriver ? (
            <p className="py-12 text-center text-sm text-navy-500">{t("dsp.pickDriver")}</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-navy-900">
                  {selectedDriver.full_name || selectedDriver.email}
                </p>
                <div className="flex overflow-hidden rounded-full border border-navy-200">
                  <button
                    type="button"
                    onClick={() => setBucket("upcoming")}
                    className={`px-3 py-1 text-xs font-semibold ${bucket === "upcoming" ? "bg-navy-800 text-white" : "text-navy-700"}`}
                  >
                    {t("dsp.upcoming")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBucket("past")}
                    className={`px-3 py-1 text-xs font-semibold ${bucket === "past" ? "bg-navy-800 text-white" : "text-navy-700"}`}
                  >
                    {t("dsp.past")}
                  </button>
                </div>
              </div>

              {selectedAssignments.length === 0 ? (
                <p className="py-8 text-center text-sm text-navy-500">
                  {bucket === "past" ? t("dsp.noPast") : t("dsp.noUpcoming")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {selectedAssignments.map(({ a, s }) => {
                    const request = requestById.get(s.transport_request_id);
                    return (
                      <li key={a.id} className="rounded-xl border border-navy-100 bg-white p-3 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-navy-900">
                            {formatDateTime(s.scheduled_at, locale)}
                          </span>
                          <div className="flex items-center gap-2">
                            <ShipmentStatusBadge status={s.status} />
                            <AssignmentStatusBadge status={a.status} />
                          </div>
                        </div>
                        {request && (
                          <p className="mt-1 text-xs text-navy-600">
                            {request.pickup_address} → {request.dropoff_address}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
