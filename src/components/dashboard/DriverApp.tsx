"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { respondToAssignment } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import { useLiveRefresh } from "@/lib/useLiveRefresh";
import PositionShareToggle from "@/components/dashboard/PositionShareToggle";
import MissionCard, { type DriverDeliveryInfo } from "@/components/dashboard/MissionCard";
import type {
  Delivery,
  DeliveryItem,
  DeliverySchedule,
  DriverAssignment,
  Lot,
  Product,
  ProductReference,
  Profile,
  Recipient,
  Shipment,
  TransportRequest,
  Vehicle,
  Warehouse,
} from "@/lib/types";

/**
 * Écran missions du chauffeur. La navigation (Missions · Alertes · Messages ·
 * Compte) est assurée par la BottomNav du layout : ce composant se concentre
 * sur les missions actives + le partage GPS.
 */
export default function DriverApp({
  driver,
  assignments,
  shipments,
  requests,
  vehicles,
  deliveries,
  schedules,
  recipients,
  deliveryItems,
  lots,
  references,
  products,
  warehouses,
}: {
  driver: Profile;
  assignments: DriverAssignment[];
  shipments: Shipment[];
  requests: TransportRequest[];
  vehicles: Vehicle[];
  deliveries: Delivery[];
  schedules: DeliverySchedule[];
  recipients: Recipient[];
  deliveryItems: DeliveryItem[];
  lots: Lot[];
  references: ProductReference[];
  products: Product[];
  warehouses: Warehouse[];
}) {
  const driverName = driver.full_name || driver.email;
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { mode } = useLiveRefresh(["driver_assignments", "shipments", "deliveries"]);
  const requestById = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests]);
  const shipmentById = useMemo(() => new Map(shipments.map((s) => [s.id, s])), [shipments]);
  const deliveryByShipment = useMemo(() => {
    const scheduleById = new Map(schedules.map((schedule) => [schedule.id, schedule]));
    const recipientById = new Map(recipients.map((recipient) => [recipient.id, recipient]));
    const lotById = new Map(lots.map((lot) => [lot.id, lot]));
    const referenceById = new Map(references.map((reference) => [reference.id, reference]));
    const productById = new Map(products.map((product) => [product.id, product]));
    const warehouseById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
    const itemsByDelivery = new Map<string, DeliveryItem[]>();
    for (const item of deliveryItems) {
      const list = itemsByDelivery.get(item.delivery_id) ?? [];
      list.push(item);
      itemsByDelivery.set(item.delivery_id, list);
    }

    const map = new Map<string, DriverDeliveryInfo>();
    for (const delivery of deliveries) {
      if (!delivery.shipment_id) continue;
      const schedule = scheduleById.get(delivery.delivery_schedule_id) ?? null;
      const recipient = recipientById.get(delivery.recipient_id) ?? null;
      const warehouse = schedule ? warehouseById.get(schedule.warehouse_id) ?? null : null;
      const items = (itemsByDelivery.get(delivery.id) ?? []).map((item) => {
        const lot = lotById.get(item.lot_id);
        const reference = lot ? referenceById.get(lot.product_reference_id) : undefined;
        const product = reference ? productById.get(reference.product_id) : undefined;
        return {
          id: item.id,
          productName: product?.name ?? "Produit",
          lotNumber: lot?.lot_number ?? "—",
          quantity: item.quantity,
          unit: item.unit,
        };
      });
      map.set(delivery.shipment_id, { delivery, schedule, recipient, warehouse, items });
    }
    return map;
  }, [deliveries, schedules, recipients, deliveryItems, lots, references, products, warehouses]);
  const active = useMemo(() => assignments.filter((a) => a.status === "proposed" || a.status === "accepted").sort((a, b) => {
    const sa = shipmentById.get(a.shipment_id);
    const sb = shipmentById.get(b.shipment_id);
    return (sa?.scheduled_at ?? "").localeCompare(sb?.scheduled_at ?? "");
  }), [assignments, shipmentById]);
  const proposed = active.filter((a) => a.status === "proposed").length;

  async function respond(id: string, accept: boolean) {
    setPendingId(id);
    setError(null);
    try {
      await respondToAssignment(id, accept);
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Résumé du chauffeur */}
      <div className="card-pro overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-flagred-600">Espace chauffeur</p>
            <h1 className="mt-0.5 font-display text-xl font-bold text-navy-900 dark:text-white">{driverName}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
              <span
                className={`h-2 w-2 rounded-full ${
                  mode === "realtime" ? "animate-pulse bg-emerald-500" : mode === "connecting" ? "animate-pulse bg-navy-400" : "bg-amber-500"
                }`}
              />
              {mode === "realtime" ? "Synchro temps réel" : mode === "connecting" ? "Connexion…" : "Mise à jour périodique"}
            </p>
          </div>
          {proposed > 0 ? (
            <span className="shrink-0 rounded-xl bg-flagred-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm">
              {proposed} {proposed > 1 ? "propositions" : "proposition"}
            </span>
          ) : (
            <span className="shrink-0 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              À jour
            </span>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      <PositionShareToggle />

      {active.length === 0 ? (
        <div className="card-pro p-10 text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600"><rect x="1" y="4" width="14" height="11" rx="1"/><path d="M15 8h4l3 3v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          <p className="mt-3 font-display text-lg font-semibold text-navy-900 dark:text-slate-100">Aucune mission active</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-slate-400">
            Les nouvelles missions proposées par le dispatch apparaîtront ici en temps réel, avec une notification push.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {active.map((a) => (
            <MissionCard
              key={a.id}
              a={a}
              requestById={requestById}
              shipmentById={shipmentById}
              pendingId={pendingId}
              respond={respond}
              vehicles={vehicles}
              deliveryByShipment={deliveryByShipment}
            />
          ))}
        </div>
      )}
    </div>
  );
}
