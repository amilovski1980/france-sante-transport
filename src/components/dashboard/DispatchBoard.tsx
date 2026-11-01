"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { assignDriver, cancelAssignment } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import { ShipmentStatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/components/dashboard/ClientDashboard";
import type {
  DriverAssignment,
  Profile,
  Shipment,
  TransportRequest,
  Vehicle,
} from "@/lib/types";

const ASSIGNABLE: Shipment["status"][] = ["pending_confirmation", "confirmed", "in_progress"];
const ACTIVE_ASSIGNMENT: DriverAssignment["status"][] = ["proposed", "accepted"];

function isActiveAssignment(assignment: DriverAssignment): boolean {
  return ACTIVE_ASSIGNMENT.includes(assignment.status);
}

export default function DispatchBoard({
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
  const router = useRouter();
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [draggingDriver, setDraggingDriver] = useState<string | null>(null);
  const [hoverShipment, setHoverShipment] = useState<string | null>(null);
  const [dialogShipment, setDialogShipment] = useState<string | null>(null);
  const [dialogDriver, setDialogDriver] = useState("");
  const [dialogVehicle, setDialogVehicle] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeVehicles = useMemo(() => vehicles.filter((vehicle) => vehicle.active), [vehicles]);

  const openShipments = useMemo(
    () =>
      shipments
        .filter((shipment) => ASSIGNABLE.includes(shipment.status))
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    [shipments],
  );

  const assignmentFor = (shipmentId: string) =>
    assignments.find((a) => a.shipment_id === shipmentId && isActiveAssignment(a)) ?? null;

  const busyDrivers = useMemo(() => {
    const set = new Set<string>();
    const liveShipmentIds = new Set(
      shipments
        .filter((s) => s.status === "in_progress")
        .map((s) => s.id),
    );
    for (const assignment of assignments) {
      if (isActiveAssignment(assignment) && liveShipmentIds.has(assignment.shipment_id)) {
        set.add(assignment.driver_id);
      }
    }
    return set;
  }, [assignments, shipments]);

  function openDialog(shipmentId: string, driverId?: string) {
    setDialogShipment(shipmentId);
    setDialogDriver(driverId || selectedDriver || "");
    setDialogVehicle("");
    setError(null);
  }

  function closeDialog() {
    setDialogShipment(null);
    setDialogDriver("");
    setDialogVehicle("");
  }

  async function submit(shipmentId: string, driverId: string, vehicleId: string) {
    if (!driverId || !vehicleId) {
      setError("Sélectionnez un chauffeur et un véhicule.");
      return;
    }
    setPending(shipmentId);
    setError(null);
    try {
      await assignDriver(shipmentId, driverId, vehicleId);
      closeDialog();
      setSelectedDriver(null);
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPending(null);
    }
  }

  async function removeAssignment(assignment: DriverAssignment) {
    setPending(assignment.shipment_id);
    setError(null);
    try {
      await cancelAssignment(assignment.id);
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-navy-400">Dispatch</p>
          <h2 className="mt-1 font-display text-xl font-bold text-navy-900 dark:text-white">
            Affectation chauffeur
          </h2>
          <p className="mt-1 text-sm text-navy-500 dark:text-slate-400">
            Glissez un chauffeur sur une mission, ou touchez un chauffeur puis une mission.
          </p>
        </div>
        <span className="rounded-full bg-navy-50 px-3 py-1.5 text-xs font-semibold text-navy-700 dark:bg-white/10 dark:text-slate-200">
          {openShipments.length} mission{openShipments.length > 1 ? "s" : ""} active{openShipments.length > 1 ? "s" : ""}
        </span>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-flagred-600/30 bg-flagred-50 px-4 py-3 text-sm font-semibold text-flagred-700">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-navy-100 bg-white/80 p-3 shadow-sm dark:border-white/10 dark:bg-white/5">
          <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-navy-400">
            Chauffeurs
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:max-h-[520px] lg:flex-col lg:overflow-y-auto lg:overflow-x-visible lg:pb-0">
            {drivers.length === 0 && (
              <p className="px-1 py-3 text-sm text-navy-500">Aucun chauffeur enregistré.</p>
            )}
            {drivers.map((driver) => {
              const selected = selectedDriver === driver.id;
              const busy = busyDrivers.has(driver.id);
              return (
                <button
                  key={driver.id}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    setDraggingDriver(driver.id);
                    event.dataTransfer.setData("text/plain", driver.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => setDraggingDriver(null)}
                  onClick={() => setSelectedDriver(selected ? null : driver.id)}
                  aria-pressed={selected}
                  className={`min-w-[190px] shrink-0 cursor-grab rounded-xl border px-3 py-2.5 text-left transition active:cursor-grabbing lg:min-w-0 ${
                    selected
                      ? "border-navy-700 bg-navy-800 text-white shadow-md"
                      : "border-navy-100 bg-white text-navy-900 hover:border-navy-300 hover:bg-navy-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
                  } ${draggingDriver === driver.id ? "opacity-50" : ""}`}
                >
                  <span className="block truncate text-sm font-semibold">
                    {driver.full_name || driver.email}
                  </span>
                  <span className={`mt-0.5 flex items-center gap-1.5 text-[11px] ${selected ? "text-white/70" : "text-navy-500 dark:text-slate-400"}`}>
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 rounded-full ${busy ? "bg-amber-400" : "bg-emerald-500"}`}
                    />
                    {busy ? "En mission" : "Disponible"}
                  </span>
                </button>
              );
            })}
          </div>
          {selectedDriver && (
            <p className="mt-2 rounded-lg bg-navy-50 px-3 py-2 text-[11px] font-medium text-navy-700 dark:bg-white/10 dark:text-slate-300">
              Chauffeur sélectionné : touchez une mission pour l&apos;affecter.
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {openShipments.length === 0 && (
            <div className="rounded-2xl border border-dashed border-navy-200 bg-white/60 p-8 text-center text-sm text-navy-500 sm:col-span-2 dark:border-white/15 dark:bg-white/5">
              Aucune mission en attente d&apos;affectation.
            </div>
          )}

          {openShipments.map((shipment) => {
            const request = requests.find((r) => r.id === shipment.transport_request_id);
            const assignment = assignmentFor(shipment.id);
            const driver = assignment ? drivers.find((d) => d.id === assignment.driver_id) : null;
            const vehicle = assignment ? vehicles.find((v) => v.id === assignment.vehicle_id) : null;
            const isHover = hoverShipment === shipment.id && Boolean(draggingDriver || selectedDriver);
            const isPending = pending === shipment.id;

            return (
              <article
                key={shipment.id}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setHoverShipment(shipment.id);
                }}
                onDragLeave={() => setHoverShipment((current) => (current === shipment.id ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  const driverId = event.dataTransfer.getData("text/plain") || draggingDriver;
                  setHoverShipment(null);
                  setDraggingDriver(null);
                  if (driverId) openDialog(shipment.id, driverId);
                }}
                onClick={() => {
                  if (assignment || isPending) return;
                  openDialog(shipment.id);
                }}
                className={`rounded-2xl border p-4 transition ${
                  isHover
                    ? "border-emerald-400 bg-emerald-50 shadow-lg ring-2 ring-emerald-300 dark:bg-emerald-500/10"
                    : assignment
                      ? "border-navy-100 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
                      : "cursor-pointer border-navy-100 bg-white shadow-sm hover:border-navy-300 hover:shadow-md dark:border-white/10 dark:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy-900 dark:text-white">
                      {formatDateTime(shipment.scheduled_at)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-navy-500 dark:text-slate-400">
                      {request
                        ? `${request.pickup_address} → ${request.dropoff_address}`
                        : "Demande associée"}
                    </p>
                  </div>
                  <ShipmentStatusBadge status={shipment.status} />
                </div>

                <div className="mt-3 rounded-xl bg-navy-50/80 px-3 py-2.5 dark:bg-white/5">
                  {assignment ? (
                    <>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                        Affecté
                      </p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-navy-900 dark:text-white">
                        {driver?.full_name || driver?.email || "Chauffeur"}
                      </p>
                      <p className="text-xs text-navy-500 dark:text-slate-400">
                        {vehicle ? `${vehicle.registration_plate} · ${vehicle.vehicle_type}` : "Véhicule"}
                        {" · "}
                        {assignment.status === "accepted" ? "accepté" : "en attente"}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs font-medium text-navy-500 dark:text-slate-400">
                      {isHover
                        ? "Déposez le chauffeur ici"
                        : selectedDriver
                          ? "Touchez pour affecter le chauffeur sélectionné"
                          : "Glissez un chauffeur ici ou touchez la carte"}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {!assignment ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={(event) => {
                        event.stopPropagation();
                        openDialog(shipment.id);
                      }}
                      className="rounded-full bg-navy-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
                    >
                      {isPending ? "Affectation…" : "Affecter"}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          openDialog(shipment.id, assignment.driver_id);
                        }}
                        className="rounded-full border border-navy-200 px-4 py-1.5 text-xs font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                      >
                        Réaffecter
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          void removeAssignment(assignment);
                        }}
                        className="rounded-full border border-flagred-600/40 px-4 py-1.5 text-xs font-semibold text-flagred-700 hover:bg-flagred-50 disabled:opacity-50"
                      >
                        Retirer
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {dialogShipment && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/50 p-3 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Affecter un chauffeur"
          onClick={closeDialog}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-[#151a23]"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="font-display text-lg font-bold text-navy-900 dark:text-white">
              Affecter un chauffeur
            </h3>
            <p className="mt-1 text-sm text-navy-500 dark:text-slate-400">
              {(() => {
                const shipment = shipments.find((s) => s.id === dialogShipment);
                return shipment ? formatDateTime(shipment.scheduled_at) : "";
              })()}
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-navy-700 dark:text-slate-300">
                Chauffeur
                <select
                  value={dialogDriver}
                  onChange={(event) => setDialogDriver(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-900 focus:border-navy-500 focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-slate-100"
                >
                  <option value="">Sélectionner…</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.full_name || driver.email}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-semibold text-navy-700 dark:text-slate-300">
                Véhicule
                <select
                  value={dialogVehicle}
                  onChange={(event) => setDialogVehicle(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-900 focus:border-navy-500 focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-slate-100"
                >
                  <option value="">Sélectionner…</option>
                  {activeVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.registration_plate} · {vehicle.vehicle_type}
                    </option>
                  ))}
                </select>
              </label>

              {error && (
                <p role="alert" className="rounded-lg bg-flagred-50 px-3 py-2 text-xs font-semibold text-flagred-700">
                  {error}
                </p>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={pending === dialogShipment}
                onClick={() => void submit(dialogShipment, dialogDriver, dialogVehicle)}
                className="flex-1 rounded-xl bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
              >
                {pending === dialogShipment ? "Affectation…" : "Valider l'affectation"}
              </button>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-xl border border-navy-200 px-4 py-2.5 text-sm font-semibold text-navy-700 hover:bg-navy-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
