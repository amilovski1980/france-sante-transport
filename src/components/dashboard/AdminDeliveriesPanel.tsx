"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { assignDeliveryMission } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import type {
  Delivery,
  DeliveryItem,
  DeliverySchedule,
  DeliveryStatus,
  DriverAssignment,
  Lot,
  Product,
  ProductReference,
  Profile,
  Recipient,
  Shipment,
  Vehicle,
} from "@/lib/types";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const df = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: "En attente",
  scheduled: "Planifiée",
  in_progress: "En cours",
  delivered: "Livrée",
  failed: "Échouée",
  cancelled: "Annulée",
};

const STATUS_TONES: Record<DeliveryStatus, string> = {
  pending: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  scheduled: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  in_progress: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  delivered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  failed: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400",
};

const select =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-navy-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100";

export default function AdminDeliveriesPanel({
  deliveries,
  items,
  schedules,
  recipients,
  lots,
  references,
  products,
  drivers,
  vehicles,
  assignments,
  shipments,
}: {
  deliveries: Delivery[];
  items: DeliveryItem[];
  schedules: DeliverySchedule[];
  recipients: Recipient[];
  lots: Lot[];
  references: ProductReference[];
  products: Product[];
  drivers: Profile[];
  vehicles: Vehicle[];
  assignments: DriverAssignment[];
  shipments: Shipment[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<DeliveryStatus | "all">("all");
  const [drafts, setDrafts] = useState<Record<string, { driver_id: string; vehicle_id: string }>>({});

  const scheduleById = useMemo(() => new Map(schedules.map((schedule) => [schedule.id, schedule])), [schedules]);
  const recipientById = useMemo(() => new Map(recipients.map((recipient) => [recipient.id, recipient])), [recipients]);
  const lotById = useMemo(() => new Map(lots.map((lot) => [lot.id, lot])), [lots]);
  const referenceById = useMemo(() => new Map(references.map((reference) => [reference.id, reference])), [references]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const driverById = useMemo(() => new Map(drivers.map((driver) => [driver.id, driver])), [drivers]);
  const vehicleById = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);
  const shipmentById = useMemo(() => new Map(shipments.map((shipment) => [shipment.id, shipment])), [shipments]);
  const assignmentByShipment = useMemo(() => {
    const map = new Map<string, DriverAssignment>();
    for (const assignment of [...assignments].sort((a, b) => a.assigned_at.localeCompare(b.assigned_at))) {
      map.set(assignment.shipment_id, assignment);
    }
    return map;
  }, [assignments]);

  const counts = useMemo(() => {
    const result: Record<DeliveryStatus, number> = {
      pending: 0,
      scheduled: 0,
      in_progress: 0,
      delivered: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const delivery of deliveries) result[delivery.status] += 1;
    return result;
  }, [deliveries]);

  const filtered = filter === "all" ? deliveries : deliveries.filter((delivery) => delivery.status === filter);

  function draftFor(delivery: Delivery) {
    const current = delivery.shipment_id ? assignmentByShipment.get(delivery.shipment_id) : undefined;
    return (
      drafts[delivery.id] ?? {
        driver_id: current?.driver_id ?? "",
        vehicle_id: current?.vehicle_id ?? "",
      }
    );
  }

  async function assign(delivery: Delivery) {
    const draft = draftFor(delivery);
    if (!draft.driver_id || !draft.vehicle_id) {
      setError("Sélectionnez un chauffeur et un véhicule.");
      return;
    }
    setBusyId(delivery.id);
    setError(null);
    try {
      await assignDeliveryMission(delivery.id, draft.driver_id, draft.vehicle_id);
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card-pro p-5">
        <h1 className="font-display text-xl font-bold text-navy-900 dark:text-white">Livraisons & dispatch</h1>
        <p className="mt-1 text-sm text-slate-400">
          Affectez un chauffeur et un véhicule à chaque livraison issue d&apos;un planning validé.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["pending", "scheduled", "in_progress", "delivered"] as DeliveryStatus[]).map((status) => (
          <div key={status} className="card-pro px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{STATUS_LABELS[status]}</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-navy-900 dark:text-white">{counts[status]}</p>
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === "all" ? "bg-navy-800 text-white" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"}`}
        >
          Toutes ({deliveries.length})
        </button>
        {(Object.keys(STATUS_LABELS) as DeliveryStatus[]).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === status ? "bg-navy-800 text-white" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"}`}
          >
            {STATUS_LABELS[status]} ({counts[status]})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((delivery) => {
          const schedule = scheduleById.get(delivery.delivery_schedule_id);
          const recipient = recipientById.get(delivery.recipient_id);
          const deliveryItems = items.filter((item) => item.delivery_id === delivery.id);
          const totalQuantity = deliveryItems.reduce((sum, item) => sum + item.quantity, 0);
          const shipment = delivery.shipment_id ? shipmentById.get(delivery.shipment_id) : undefined;
          const currentAssignment = delivery.shipment_id ? assignmentByShipment.get(delivery.shipment_id) : undefined;
          const draft = draftFor(delivery);
          const canAssign = delivery.status !== "delivered" && delivery.status !== "cancelled";
          return (
            <section key={delivery.id} className="card-pro overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-base font-semibold text-navy-900 dark:text-white">
                      {recipient?.name ?? "Destinataire"}
                    </h2>
                    <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS_TONES[delivery.status]}`}>
                      {STATUS_LABELS[delivery.status]}
                    </span>
                    {shipment && (
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-300">
                        Mission {shipment.status}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {schedule?.label ?? "Planning"} · {delivery.scheduled_at ? df.format(new Date(delivery.scheduled_at)) : "Non planifiée"} ·{" "}
                    {deliveryItems.length} ligne(s) · {nf.format(totalQuantity)} unité(s)
                  </p>
                  {currentAssignment && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Chauffeur : {driverById.get(currentAssignment.driver_id)?.full_name ?? "—"} · Véhicule :{" "}
                      {vehicleById.get(currentAssignment.vehicle_id)?.registration_plate ?? "—"} ({currentAssignment.status})
                    </p>
                  )}
                </div>

                {canAssign && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className={select}
                      value={draft.driver_id}
                      onChange={(e) =>
                        setDrafts((current) => ({
                          ...current,
                          [delivery.id]: { ...draft, driver_id: e.target.value },
                        }))
                      }
                    >
                      <option value="">Chauffeur…</option>
                      {drivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>{driver.full_name || driver.email}</option>
                      ))}
                    </select>
                    <select
                      className={select}
                      value={draft.vehicle_id}
                      onChange={(e) =>
                        setDrafts((current) => ({
                          ...current,
                          [delivery.id]: { ...draft, vehicle_id: e.target.value },
                        }))
                      }
                    >
                      <option value="">Véhicule…</option>
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>{vehicle.registration_plate}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busyId === delivery.id}
                      onClick={() => assign(delivery)}
                      className="rounded-xl bg-navy-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
                    >
                      Affecter
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/10 dark:bg-white/5">
                    <tr>
                      <th className="px-4 py-2">Produit</th>
                      <th className="px-4 py-2">Lot</th>
                      <th className="px-4 py-2 text-right">Quantité</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    {deliveryItems.map((item) => {
                      const lot = lotById.get(item.lot_id);
                      const reference = lot ? referenceById.get(lot.product_reference_id) : undefined;
                      const product = reference ? productById.get(reference.product_id) : undefined;
                      return (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300">{product?.name ?? "Produit"}</td>
                          <td className="px-4 py-2 font-mono text-xs text-slate-500">{lot?.lot_number ?? "—"}</td>
                          <td className="px-4 py-2 text-right text-xs tabular-nums">{nf.format(item.quantity)} {item.unit ?? ""}</td>
                        </tr>
                      );
                    })}
                    {deliveryItems.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-4 text-center text-xs text-slate-400">Aucune ligne.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
        {filtered.length === 0 && (
          <div className="card-pro p-8 text-center text-sm text-slate-400">Aucune livraison pour ce filtre.</div>
        )}
      </div>
    </div>
  );
}
