"use client";

import { useMemo } from "react";
import { useLiveRefresh } from "@/lib/useLiveRefresh";
import { useI18n } from "@/components/I18nProvider";
import {
  AssignmentStatusBadge,
  RequestStatusBadge,
  ShipmentStatusBadge,
} from "@/components/StatusBadge";
import { formatDateTime } from "@/components/dashboard/ClientDashboard";
import LiveMap from "@/components/dashboard/LiveMap";
import type {
  DriverAssignment,
  DriverLocation,
  Profile,
  Quote,
  Shipment,
  ShipmentEvent,
  TransportRequest,
  Vehicle,
} from "@/lib/types";

const ACTIVE_STATUSES = ["pending_confirmation", "confirmed", "in_progress"] as const;

const LIVE_TABLES = [
  "transport_requests",
  "shipments",
  "driver_assignments",
  "shipment_events",
  "quotes",
  "driver_positions",
];

function LivePill({ mode }: { mode: "connecting" | "realtime" | "polling" }) {
  const { t } = useI18n();
  if (mode === "realtime") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        {t("dlb.realtime")}
      </span>
    );
  }
  if (mode === "connecting") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-navy-200 bg-navy-50 px-3 py-1 text-xs font-semibold text-navy-600">
        <span className="h-2 w-2 animate-pulse rounded-full bg-navy-400" />
        {t("dlb.connecting")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
      <span className="h-2 w-2 rounded-full bg-amber-500" />
      {t("dlb.polling")}
    </span>
  );
}

export default function DispatchLiveBoard({
  requests,
  quotes,
  shipments,
  assignments,
  drivers,
  vehicles,
  events,
  positions = [],
}: {
  requests: TransportRequest[];
  quotes: Quote[];
  shipments: Shipment[];
  assignments: DriverAssignment[];
  drivers: Profile[];
  vehicles: Vehicle[];
  events: ShipmentEvent[];
  positions?: DriverLocation[];
}) {
  const { t, labels, locale } = useI18n();
  const { mode, lastSyncAt } = useLiveRefresh(LIVE_TABLES);

  const activeMissions = useMemo(
    () =>
      shipments
        .filter((s) => (ACTIVE_STATUSES as readonly string[]).includes(s.status))
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    [shipments],
  );

  const driverById = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const requestById = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests]);
  const quoteById = useMemo(() => new Map(quotes.map((q) => [q.id, q])), [quotes]);
  const assignmentByShipment = useMemo(
    () => new Map(assignments.filter((a) => a.status !== "declined" && a.status !== "cancelled").map((a) => [a.shipment_id, a])),
    [assignments],
  );

  // Disponibilité chauffeurs : occupé si affectation active, sinon libre
  const driverStatus = useMemo(() => {
    const map = new Map<string, { assignment?: DriverAssignment; shipment?: Shipment }>();
    const activeShipmentIds = new Set(activeMissions.map((s) => s.id));
    for (const a of assignments) {
      if ((a.status === "proposed" || a.status === "accepted") && activeShipmentIds.has(a.shipment_id)) {
        const existing = map.get(a.driver_id);
        if (!existing || a.status === "accepted") {
          map.set(a.driver_id, {
            assignment: a,
            shipment: shipments.find((s) => s.id === a.shipment_id),
          });
        }
      }
    }
    return map;
  }, [assignments, activeMissions, shipments]);

  const recentEvents = useMemo(
    () => [...events].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 12),
    [events],
  );

  return (
    <div className="space-y-6">
      {/* Bandeau de statut live */}
      <div className="surface flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <LivePill mode={mode} />
          <span className="text-xs text-navy-500">
            {t("dlb.lastUpdate", { t: formatDateTime(lastSyncAt.toISOString(), locale) })}
          </span>
        </div>
        <p className="text-xs text-navy-500">
          {t(activeMissions.length === 1 ? "dlb.missionOne" : "dlb.missionOther", {
            n: activeMissions.length,
          })}{" "}
          · {t(driverStatus.size === 1 ? "dlb.assignedOne" : "dlb.assignedOther", {
            a: driverStatus.size,
            b: drivers.length,
          })}{" "}
          · {t(positions.length === 1 ? "dlb.positionsOne" : "dlb.positionsOther", {
            n: positions.length,
          })}
        </p>
      </div>

      <LiveMap positions={positions} drivers={drivers} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Missions actives (colonne principale) */}
        <article className="surface overflow-hidden lg:col-span-2">
          <div className="border-b border-navy-100 bg-navy-50/50 px-5 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-navy-500">
              {t("dlb.missionsTitle")}
            </h3>
          </div>
          {activeMissions.length === 0 ? (
            <p className="p-8 text-center text-sm text-navy-500">
              {t("dlb.noMissions")}
            </p>
          ) : (
            <ul className="divide-y divide-navy-100">
              {activeMissions.map((shipment) => {
                const request = requestById.get(shipment.transport_request_id);
                const quote = quoteById.get(shipment.quote_id);
                const assignment = assignmentByShipment.get(shipment.id);
                const driver = assignment ? driverById.get(assignment.driver_id) : undefined;
                const vehicle = assignment ? vehicleById.get(assignment.vehicle_id) : undefined;

                return (
                  <li key={shipment.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-navy-900">
                          {formatDateTime(shipment.scheduled_at, locale)}
                        </span>
                        <ShipmentStatusBadge status={shipment.status} />
                        {request && <RequestStatusBadge status={request.status} />}
                      </div>
                      {assignment && <AssignmentStatusBadge status={assignment.status} />}
                    </div>

                    <p className="mt-1 text-sm text-navy-700/80">
                      {request
                        ? `${labels.service[request.service_type]} · ${request.pickup_address} → ${request.dropoff_address}`
                        : t("dlb.requestLinked")}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-500">
                      <span className={driver ? "font-semibold text-navy-800" : "text-amber-700"}>
                        {driver
                          ? `${t("dlb.driver")} : ${driver.full_name || driver.email}`
                          : t("dlb.driverUnassigned")}
                      </span>
                      {vehicle && (
                        <span>
                          {t("dlb.vehicle")}: {vehicle.registration_plate} ({vehicle.vehicle_type})
                        </span>
                      )}
                      {quote && <span>{t("dlb.quoteAccepted", { v: quote.version })}</span>}
                      {request?.patient_name && (
                        <span>{t("dlb.patient", { n: request.patient_name })}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        {/* Chauffeurs */}
        <article className="surface overflow-hidden">
          <div className="border-b border-navy-100 bg-navy-50/50 px-5 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-navy-500">
              {t("dlb.driversTitle")}
            </h3>
          </div>
          {drivers.length === 0 ? (
            <p className="p-6 text-center text-sm text-navy-500">
              {t("dlb.driversUnavailable")}
            </p>
          ) : (
            <ul className="divide-y divide-navy-100">
              {drivers.map((driver) => {
                const engaged = driverStatus.get(driver.id);
                const shipment = engaged?.shipment;
                const request = shipment ? requestById.get(shipment.transport_request_id) : undefined;

                return (
                  <li key={driver.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-navy-900">
                        {driver.full_name || driver.email}
                      </span>
                      {engaged ? (
                        <AssignmentStatusBadge status={engaged.assignment!.status} />
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {t("dlb.available")}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-navy-500">
                      {engaged && shipment
                        ? `${formatDateTime(shipment.scheduled_at, locale)}${
                            request ? ` · ${request.pickup_address}` : ""
                          }`
                        : t("dlb.pendingAssign")}
                    </p>
                    {engaged?.assignment && (
                      <p className="text-xs text-navy-400">
                        {t("dlb.assignment")} {labels.assignment[engaged.assignment.status]}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      </div>

      {/* Flux d'activité en direct */}
      <article className="surface overflow-hidden">
        <div className="border-b border-navy-100 bg-navy-50/50 px-5 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-navy-500">
            {t("dlb.feedTitle")}
          </h3>
        </div>
        {recentEvents.length === 0 ? (
          <p className="p-6 text-center text-sm text-navy-500">
            {t("dlb.feedEmpty")}
          </p>
        ) : (
          <ul className="divide-y divide-navy-100">
            {recentEvents.map((event) => (
              <li key={event.id} className="flex items-start justify-between gap-4 px-5 py-3">
                <div>
                  <p className="text-sm text-navy-800">
                    {labels.event[event.event_type] ?? event.event_type}
                  </p>
                  {event.payload && Object.keys(event.payload).length > 0 && (
                    <p className="mt-0.5 text-xs text-navy-500">
                      {Object.entries(event.payload)
                        .map(([k, v]) => `${k}: ${String(v)}`)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <time className="shrink-0 text-xs tabular-nums text-navy-400" dateTime={event.created_at}>
                  {formatDateTime(event.created_at, locale)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  );
}
