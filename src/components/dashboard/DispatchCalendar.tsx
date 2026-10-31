"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { ShipmentStatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/components/dashboard/ClientDashboard";
import DriverAvatar from "@/components/dashboard/DriverAvatar";
import { toUserMessage } from "@/lib/errors";
import {
  SERVICE_TYPE_LABELS,
} from "@/lib/labels";
import {
  adminCancelShipment,
  adminCompleteShipment,
  adminConfirmShipment,
  adminStartShipment,
  assignDriver,
} from "@/lib/api";
import type {
  DriverAssignment,
  Profile,
  Shipment,
  TransportRequest,
  Vehicle,
} from "@/lib/types";

type ViewMode = "week" | "month" | "list";

const VEHICLE_SHORT: Record<string, string> = {
  van: "Frigo 2–8 °C",
  stretcher_van: "Carboglace -78,5 °C",
  minibus: "Enlèvement",
  ambulance: "UN 3373",
  sedan: "Messagerie",
  moto: "Moto",
};

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

/** Lundi de la semaine courant le jour donné. */
function mondayOf(d: Date): Date {
  const dow = (d.getDay() + 6) % 7;
  return addDays(d, -dow);
}

export default function DispatchCalendar({
  shipments,
  requests,
  assignments,
  drivers,
  vehicles = [],
}: {
  shipments: Shipment[];
  requests: TransportRequest[];
  assignments: DriverAssignment[];
  drivers: Profile[];
  vehicles?: Vehicle[];
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [assign, setAssign] = useState<{ driver_id: string; vehicle_id: string }>({ driver_id: "", vehicle_id: "" });

  const requestById = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests]);
  const driverById = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const assignmentByShipment = useMemo(() => {
    const m = new Map<string, DriverAssignment>();
    for (const a of assignments) {
      if (a.status === "declined" || a.status === "cancelled") continue;
      if (!m.has(a.shipment_id)) m.set(a.shipment_id, a);
    }
    return m;
  }, [assignments]);

  const weekStart = useMemo(() => mondayOf(startOfDay(cursor)), [cursor]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  /** Grille du mois : 6 semaines complètes, lundi → dimanche. */
  const monthCells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = mondayOf(startOfDay(first));
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [cursor]);

  const sorted = useMemo(
    () => [...shipments].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    [shipments],
  );

  const byDay = useMemo(() => {
    const m = new Map<string, Shipment[]>();
    for (const s of sorted) {
      const key = new Date(s.scheduled_at).toDateString();
      const list = m.get(key);
      if (list) list.push(s);
      else m.set(key, [s]);
    }
    return m;
  }, [sorted]);

  const openShipment = openId ? shipments.find((s) => s.id === openId) ?? null : null;
  const openRequest = openShipment ? requestById.get(openShipment.transport_request_id) : undefined;
  const openAssignment = openShipment ? assignmentByShipment.get(openShipment.id) : undefined;
  const openDriver = openAssignment ? driverById.get(openAssignment.driver_id) : undefined;
  const openVehicle = openAssignment ? vehicleById.get(openAssignment.vehicle_id) : undefined;

  function goPrev() {
    setCursor((c) => {
      if (view === "month") {
        const x = new Date(c);
        x.setDate(1);
        x.setMonth(x.getMonth() - 1);
        return x;
      }
      return addDays(c, -7);
    });
  }

  function goNext() {
    setCursor((c) => {
      if (view === "month") {
        const x = new Date(c);
        x.setDate(1);
        x.setMonth(x.getMonth() + 1);
        return x;
      }
      return addDays(c, 7);
    });
  }

  function openDetails(id: string) {
    setActionError(null);
    setAssign({ driver_id: "", vehicle_id: "" });
    setOpenId(id);
  }

  async function runAction(shipment: Shipment, action: () => Promise<unknown>) {
    if (pendingAction) return;
    setPendingAction(true);
    setActionError(null);
    try {
      await action();
      if (openId === shipment.id) {
        setOpenId(null);
      }
      router.refresh();
    } catch (err) {
      setActionError(toUserMessage(err));
    } finally {
      setPendingAction(false);
    }
  }

  async function handleAssign(shipment: Shipment) {
    if (!assign.driver_id || !assign.vehicle_id) {
      setActionError(locale === "fr" ? "Sélectionnez un chauffeur et un véhicule." : "Select a driver and a vehicle.");
      return;
    }
    await runAction(shipment, () => assignDriver(shipment.id, assign.driver_id, assign.vehicle_id));
  }

  /** Actions de statut pertinentes selon l'état de la mission. */
  function statusActions(shipment: Shipment): { key: string; label: string; kind: "primary" | "danger"; run: () => Promise<unknown> }[] {
    switch (shipment.status) {
      case "pending_confirmation":
        return [
          { key: "confirm", label: t("cal.confirm"), kind: "primary", run: () => adminConfirmShipment(shipment.id) },
          { key: "cancel", label: t("cal.cancel"), kind: "danger", run: () => adminCancelShipment(shipment.id) },
        ];
      case "confirmed":
        return [
          { key: "start", label: t("cal.start"), kind: "primary", run: () => adminStartShipment(shipment.id) },
          { key: "cancel", label: t("cal.cancel"), kind: "danger", run: () => adminCancelShipment(shipment.id) },
        ];
      case "in_progress":
        return [
          { key: "complete", label: t("cal.complete"), kind: "primary", run: () => adminCompleteShipment(shipment.id) },
          { key: "cancel", label: t("cal.cancel"), kind: "danger", run: () => adminCancelShipment(shipment.id) },
        ];
      default:
        return [];
    }
  }

  function renderShipment(shipment: Shipment, compact: boolean) {
    const request = requestById.get(shipment.transport_request_id);
    const assignment = assignmentByShipment.get(shipment.id);
    const driver = assignment ? driverById.get(assignment.driver_id) : undefined;
    const vehicle = assignment ? vehicleById.get(assignment.vehicle_id) : undefined;
    const cancelled = shipment.status === "cancelled" || shipment.status === "completed";
    return (
      <button
        key={shipment.id}
        type="button"
        onClick={() => openDetails(shipment.id)}
        className={`block w-full rounded-lg border p-2 text-left text-xs shadow-sm transition hover:border-navy-400 hover:shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-navy-500 ${
          cancelled ? "border-navy-100 bg-navy-50/60 opacity-70" : "border-navy-100 bg-white"
        }`}
      >
        <span className="flex items-center justify-between gap-1">
          <span className="font-semibold text-navy-900">
            {new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(
              new Date(shipment.scheduled_at),
            )}
          </span>
          <ShipmentStatusBadge status={shipment.status} />
        </span>
        <span className={`mt-1 block truncate text-navy-600 ${compact ? "text-[10px]" : ""}`}>
          {request ? request.pickup_address : t("cal.noRequest")}
        </span>
        <span className="block truncate text-navy-400">
          {driver
            ? `${driver.full_name || driver.email} · ${vehicle ? vehicle.registration_plate : "?"}`
            : t("cal.unassigned")}
        </span>
      </button>
    );
  }

  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(cursor);
  const weekLabel = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).formatRange(weekStart, addDays(weekStart, 6));
  const weekdayShort = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) => fmt.format(addDays(mondayOf(new Date()), i)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  return (
    <div className="surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-100 bg-navy-50/50 px-5 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-navy-500">
          {t("cal.title")}
          <span className="ml-2 normal-case text-navy-400">
            {view === "month" ? monthLabel : view === "week" ? weekLabel : ""}
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="rounded-full border border-navy-200 px-3 py-1 text-xs font-semibold text-navy-700 hover:bg-white"
          >
            {view === "month" ? t("cal.prevMonth") : t("cal.prev")}
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
            onClick={goNext}
            className="rounded-full border border-navy-200 px-3 py-1 text-xs font-semibold text-navy-700 hover:bg-white"
          >
            {view === "month" ? t("cal.nextMonth") : t("cal.next")}
          </button>
          <div className="ml-2 flex overflow-hidden rounded-full border border-navy-200">
            {(["month", "week", "list"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`px-3 py-1 text-xs font-semibold ${view === mode ? "bg-navy-800 text-white" : "text-navy-700"}`}
              >
                {mode === "month" ? t("cal.viewMonth") : mode === "week" ? t("cal.viewWeek") : t("cal.viewList")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "month" ? (
        <div>
          <div className="grid grid-cols-7 border-b border-navy-100 bg-navy-50/40 text-center text-[10px] font-semibold uppercase tracking-widest text-navy-500">
            {weekdayShort.map((d) => (
              <span key={d} className="py-1.5">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map((day) => {
              const dayItems = byDay.get(day.toDateString()) ?? [];
              const inMonth = day.getMonth() === cursor.getMonth();
              const isToday = sameDay(day, new Date());
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[84px] border-r border-b border-navy-100 p-1.5 last:border-r-0 ${
                    isToday ? "bg-flagred-50/50" : inMonth ? "bg-white" : "bg-navy-50/30"
                  }`}
                >
                  <p
                    className={`mb-1 inline-grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${
                      isToday
                        ? "bg-flagred-600 text-white"
                        : inMonth
                          ? "text-navy-700"
                          : "text-navy-300"
                    }`}
                  >
                    {day.getDate()}
                  </p>
                  {dayItems.length === 0 ? (
                    <span className="block text-center text-[10px] text-navy-200/80">·</span>
                  ) : (
                    <div className="space-y-1">
                      {dayItems.slice(0, 3).map((s) => {
                        const request = requestById.get(s.transport_request_id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            title={`${new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(s.scheduled_at))} · ${request ? request.pickup_address : ""}`}
                            onClick={() => openDetails(s.id)}
                            className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium cursor-pointer ${
                              s.status === "completed"
                                ? "bg-emerald-100/70 text-emerald-800 hover:bg-emerald-100"
                                : s.status === "cancelled"
                                  ? "bg-navy-100 text-navy-500 line-through hover:bg-navy-100"
                                  : s.status === "in_progress"
                                    ? "bg-amber-100/80 text-amber-900 hover:bg-amber-100"
                                    : s.status === "confirmed"
                                      ? "bg-blue-100/80 text-blue-900 hover:bg-blue-100"
                                      : "bg-flagred-100/80 text-flagred-800 hover:bg-flagred-100"
                            }`}
                          >
                            <span className="font-bold">
                              {new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(
                                new Date(s.scheduled_at),
                              )}{" "}
                            </span>
                            {request ? SERVICE_TYPE_LABELS[request.service_type] : t("cal.noRequest")}
                          </button>
                        );
                      })}
                      {dayItems.length > 3 && (
                        <span className="block text-[10px] font-semibold text-navy-500">
                          {t("cal.andMore", { n: dayItems.length - 3 })}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : view === "week" ? (
        <div className="flex overflow-x-auto divide-x divide-navy-100">
          {weekDays.map((day) => {
            const dayItems = byDay.get(day.toDateString()) ?? [];
            const isToday = sameDay(day, new Date());
            return (
              <div key={day.toISOString()} className={`min-h-[140px] w-28 shrink-0 p-2 ${isToday ? "bg-flagred-50/40" : ""}`}>
                <p className="mb-2 text-center text-xs font-semibold text-navy-500">
                  {new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric" }).format(day)}
                </p>
                <ul className="space-y-1.5">
                  {dayItems.length === 0 ? (
                    <li className="text-center text-[10px] text-navy-300">—</li>
                  ) : (
                    dayItems.map((s) => <li key={s.id}>{renderShipment(s, false)}</li>)
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
            sorted.map((s) => {
              const request = requestById.get(s.transport_request_id);
              const assignment = assignmentByShipment.get(s.id);
              const driver = assignment ? driverById.get(assignment.driver_id) : undefined;
              return (
                <li key={s.id} className="px-5 py-3">
                  <button
                    type="button"
                    onClick={() => openDetails(s.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg py-1 text-left cursor-pointer hover:bg-navy-50/60"
                  >
                    <span className="text-sm text-navy-800">
                      {formatDateTime(s.scheduled_at, locale)}
                      <span className="ml-2 truncate text-navy-500">
                        {request ? SERVICE_TYPE_LABELS[request.service_type] : t("cal.noRequest")}
                        {driver && (
                          <span className="text-navy-400"> · {driver.full_name || driver.email}</span>
                        )}
                      </span>
                    </span>
                    <ShipmentStatusBadge status={s.status} />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}

      {openShipment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenId(null)}
        >
          <div
            className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-navy-400">
                  {t("cal.details")}
                </p>
                <h3 className="mt-0.5 font-display text-xl font-semibold text-navy-900">
                  {t("cal.missionOn", {
                    n: formatDateTime(openShipment.scheduled_at, locale),
                  })}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <ShipmentStatusBadge status={openShipment.status} />
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  className="grid h-8 w-8 place-items-center rounded-full border border-navy-200 text-navy-500 hover:bg-navy-50"
                  aria-label={t("cal.close")}
                >
                  ✕
                </button>
              </div>
            </div>

            <dl className="mt-4 space-y-2.5 text-sm">
              {openRequest && (
                <>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-navy-400">
                      {t("cal.service")}
                    </dt>
                    <dd className="text-navy-800">{SERVICE_TYPE_LABELS[openRequest.service_type]}</dd>
                  </div>
                  {openRequest.patient_name && (
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-navy-400">
                        {t("cal.product")}
                      </dt>
                      <dd className="text-navy-800">{openRequest.patient_name}</dd>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-navy-400">
                      {t("cal.route")}
                    </dt>
                    <dd className="min-w-0 text-navy-800">
                      <p className="break-words">
                        <span aria-hidden="true" className="font-semibold text-emerald-700">A · </span>
                        {openRequest.pickup_address}
                      </p>
                      <p className="break-words">
                        <span aria-hidden="true" className="font-semibold text-navy-800">B · </span>
                        {openRequest.dropoff_address}
                      </p>
                    </dd>
                  </div>
                  {openRequest.contact_phone && (
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-navy-400">
                        {t("cal.phone")}
                      </dt>
                      <dd className="text-navy-800">{openRequest.contact_phone}</dd>
                    </div>
                  )}
                  {openRequest.notes && (
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-navy-400">
                        {t("cal.notes")}
                      </dt>
                      <dd className="break-words text-navy-700">{openRequest.notes}</dd>
                    </div>
                  )}
                </>
              )}
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-navy-400">
                  {t("cal.driver")}
                </dt>
                <dd className="flex min-w-0 items-center gap-2 text-navy-800">
                  <DriverAvatar
                    name={openDriver ? openDriver.full_name || openDriver.email : "—"}
                    url={openDriver?.avatar_url}
                    size={28}
                  />
                  <span className="min-w-0 break-words">
                    {openDriver ? openDriver.full_name || openDriver.email : t("cal.unassigned")}
                    {openVehicle ? ` · ${openVehicle.registration_plate} (${VEHICLE_SHORT[openVehicle.vehicle_type] ?? openVehicle.vehicle_type})` : ""}
                  </span>
                </dd>
              </div>
            </dl>

            {(statusActions(openShipment).length > 0 || openShipment.status === "pending_confirmation") && (
              <div className="mt-5 space-y-4 border-t border-navy-100 pt-4">
                {statusActions(openShipment).length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-navy-400">
                      {t("cal.statusEdit")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {statusActions(openShipment).map((action) => (
                        <button
                          key={action.key}
                          type="button"
                          disabled={pendingAction}
                          onClick={() => runAction(openShipment, action.run)}
                          className={
                            action.kind === "primary"
                              ? "rounded-full bg-navy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-60"
                              : "rounded-full border border-flagred-600/40 px-4 py-2 text-xs font-semibold text-flagred-700 hover:bg-flagred-50 disabled:opacity-60"
                          }
                        >
                          {pendingAction ? t("cal.working") : action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {openShipment.status === "pending_confirmation" && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-navy-400">
                      {t("cal.assignTitle")}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select
                        value={assign.driver_id}
                        onChange={(e) => setAssign((p) => ({ ...p, driver_id: e.target.value }))}
                        className="rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-800"
                      >
                        <option value="">{t("cal.selectDriver")}</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.full_name || d.email}
                          </option>
                        ))}
                      </select>
                      <select
                        value={assign.vehicle_id}
                        onChange={(e) => setAssign((p) => ({ ...p, vehicle_id: e.target.value }))}
                        className="rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-800"
                      >
                        <option value="">{t("cal.selectVehicle")}</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.registration_plate} · {VEHICLE_SHORT[v.vehicle_type] ?? v.vehicle_type}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={pendingAction}
                      onClick={() => handleAssign(openShipment)}
                      className="mt-2 rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                    >
                      {pendingAction ? t("cal.working") : t("cal.assign")}
                    </button>
                  </div>
                )}

                {actionError && (
                  <p className="rounded-lg bg-flagred-50 px-3 py-2 text-xs font-medium text-flagred-700">
                    {actionError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
