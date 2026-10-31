import type {
  AssignmentStatus,
  DriverAssignment,
  Profile,
  Quote,
  RequestStatus,
  Shipment,
  ShipmentStatus,
  TransportRequest,
  Vehicle,
} from "@/lib/types";

export interface ActivityPoint {
  /** Jour au format YYYY-MM-DD (heure locale). */
  day: string;
  count: number;
}

export interface DashboardStats {
  requests: {
    total: number;
    byStatus: Record<RequestStatus, number>;
    last14Days: ActivityPoint[];
    today: number;
    upcoming7Days: number;
  };
  quotes: {
    sent: number;
    accepted: number;
    declined: number;
    /** Taux d'acceptation des devis tranchés, 0–100 (0 si aucun tranché). */
    acceptanceRate: number;
    /** Montant total des devis acceptés (encaissé / en cours). */
    acceptedAmount: number;
    currency: string;
  };
  shipments: {
    total: number;
    active: number;
    byStatus: Record<ShipmentStatus, number>;
    scheduledToday: number;
  };
  fleet: {
    vehiclesTotal: number;
    vehiclesActive: number;
    vehiclesInUse: number;
  };
  drivers: {
    total: number;
    busy: number;
    available: number;
    pending: number;
  };
}

export const EMPTY_REQUEST_STATUS: Record<RequestStatus, number> = {
  draft: 0,
  submitted: 0,
  under_review: 0,
  quoted: 0,
  accepted: 0,
  rejected: 0,
  cancelled: 0,
  completed: 0,
};

export const EMPTY_SHIPMENT_STATUS: Record<ShipmentStatus, number> = {
  pending_confirmation: 0,
  confirmed: 0,
  in_progress: 0,
  completed: 0,
  cancelled: 0,
};

const ACTIVE_SHIPMENT_STATUSES: ShipmentStatus[] = ["pending_confirmation", "confirmed", "in_progress"];
const BUSY_ASSIGNMENT_STATUSES: AssignmentStatus[] = ["proposed", "accepted"];

export function dayKey(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

/** Activité des `days` derniers jours (bornes incluses), jours sans demande inclus à 0. */
export function buildActivity(
  createdDates: string[],
  now: Date,
  days = 14,
): ActivityPoint[] {
  const counts = new Map<string, number>();
  for (const raw of createdDates) {
    const key = dayKey(new Date(raw));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const points: ActivityPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = dayKey(d);
    points.push({ day: key, count: counts.get(key) ?? 0 });
  }
  return points;
}

export function computeStats(input: {
  requests: TransportRequest[];
  quotes: Quote[];
  shipments: Shipment[];
  assignments: DriverAssignment[];
  drivers: Profile[];
  vehicles: Vehicle[];
  now?: Date;
}): DashboardStats {
  const now = input.now ?? new Date();

  const byStatus = { ...EMPTY_REQUEST_STATUS };
  for (const r of input.requests) byStatus[r.status] += 1;

  const shipmentByStatus = { ...EMPTY_SHIPMENT_STATUS };
  for (const s of input.shipments) shipmentByStatus[s.status] += 1;

  const sentQuotes = input.quotes.filter((q) =>
    ["sent", "accepted", "declined"].includes(q.status),
  );
  const acceptedQuotes = input.quotes.filter((q) => q.status === "accepted");
  const declinedQuotes = input.quotes.filter((q) => q.status === "declined");
  const decided = acceptedQuotes.length + declinedQuotes.length;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(startOfToday.getDate() + 1);
  const in7Days = new Date(now);
  in7Days.setDate(now.getDate() + 7);

  const activeShipments = input.shipments.filter((s) =>
    ACTIVE_SHIPMENT_STATUSES.includes(s.status),
  );

  const activeVehicleIds = new Set(
    input.assignments
      .filter(
        (a) =>
          BUSY_ASSIGNMENT_STATUSES.includes(a.status) &&
          activeShipments.some((s) => s.id === a.shipment_id),
      )
      .map((a) => a.vehicle_id),
  );

  const busyDriverIds = new Set(
    input.assignments
      .filter(
        (a) =>
          BUSY_ASSIGNMENT_STATUSES.includes(a.status) &&
          activeShipments.some((s) => s.id === a.shipment_id),
      )
      .map((a) => a.driver_id),
  );
  const pendingDriverIds = new Set(
    input.assignments.filter((a) => a.status === "proposed").map((a) => a.driver_id),
  );
  const busy = new Set([...busyDriverIds, ...pendingDriverIds]);

  const acceptedAmount = acceptedQuotes.reduce((sum, q) => sum + Number(q.amount), 0);

  return {
    requests: {
      total: input.requests.length,
      byStatus,
      last14Days: buildActivity(
        input.requests.map((r) => r.created_at),
        now,
      ),
      today: input.requests.filter((r) => {
        const d = new Date(r.created_at);
        return d >= startOfToday && d < endOfToday;
      }).length,
      upcoming7Days: input.requests.filter((r) => {
        const d = new Date(r.pickup_datetime);
        return d >= now && d < in7Days && !["cancelled", "rejected", "completed"].includes(r.status);
      }).length,
    },
    quotes: {
      sent: sentQuotes.length,
      accepted: acceptedQuotes.length,
      declined: declinedQuotes.length,
      acceptanceRate: decided === 0 ? 0 : Math.round((acceptedQuotes.length / decided) * 100),
      acceptedAmount,
      currency: acceptedQuotes[0]?.currency ?? "EUR",
    },
    shipments: {
      total: input.shipments.length,
      active: activeShipments.length,
      byStatus: shipmentByStatus,
      scheduledToday: input.shipments.filter((s) => {
        const d = new Date(s.scheduled_at);
        return d >= startOfToday && d < endOfToday;
      }).length,
    },
    fleet: {
      vehiclesTotal: input.vehicles.length,
      vehiclesActive: input.vehicles.filter((v) => v.active).length,
      vehiclesInUse: activeVehicleIds.size,
    },
    drivers: {
      total: input.drivers.length,
      busy: busy.size,
      available: Math.max(0, input.drivers.length - busy.size),
      pending: pendingDriverIds.size,
    },
  };
}
