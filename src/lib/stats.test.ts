import { describe, expect, it } from "vitest";
import { buildActivity, computeStats, dayKey } from "@/lib/stats";
import type {
  DriverAssignment,
  Profile,
  Quote,
  Shipment,
  TransportRequest,
  Vehicle,
} from "@/lib/types";

const NOW = new Date("2026-06-15T12:00:00");

function request(overrides: Partial<TransportRequest> = {}): TransportRequest {
  return {
    id: crypto.randomUUID(),
    client_id: "c1",
    organization_id: null,
    status: "submitted",
    service_type: "medical_transport",
    pickup_address: "A",
    dropoff_address: "B",
    pickup_datetime: "2026-06-20T10:00:00",
    patient_name: null,
    mobility_notes: null,
    contact_phone: null,
    notes: null,
    created_at: "2026-06-15T09:00:00",
    updated_at: "2026-06-15T09:00:00",
    ...overrides,
  };
}

function quote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: crypto.randomUUID(),
    transport_request_id: "r1",
    version: 1,
    status: "sent",
    amount: 100,
    currency: "EUR",
    valid_until: null,
    notes: null,
    created_by: "u1",
    sent_at: "2026-06-14T10:00:00",
    accepted_at: null,
    accepted_by: null,
    declined_at: null,
    created_at: "2026-06-14T10:00:00",
    updated_at: "2026-06-14T10:00:00",
    ...overrides,
  };
}

function shipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    id: crypto.randomUUID(),
    transport_request_id: "r1",
    quote_id: "q1",
    organization_id: null,
    status: "confirmed",
    scheduled_at: "2026-06-15T14:00:00",
    confirmed_at: "2026-06-14T10:00:00",
    confirmed_by: "u1",
    completed_at: null,
    cancelled_at: null,
    notes: null,
    created_at: "2026-06-14T10:00:00",
    updated_at: "2026-06-14T10:00:00",
    ...overrides,
  };
}

function driver(id: string): Profile {
  return {
    id,
    email: `${id}@test.local`,
    full_name: id,
    phone: null,
    avatar_url: null,
    address: null,
    role: "driver",
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
  };
}

function assignment(overrides: Partial<DriverAssignment> = {}): DriverAssignment {
  return {
    id: crypto.randomUUID(),
    shipment_id: "s1",
    driver_id: "d1",
    vehicle_id: "v1",
    status: "accepted",
    assigned_by: "u1",
    assigned_at: "2026-06-14T10:00:00",
    responded_at: "2026-06-14T10:05:00",
    created_at: "2026-06-14T10:00:00",
    updated_at: "2026-06-14T10:05:00",
    ...overrides,
  };
}

function vehicle(id: string, active = true): Vehicle {
  return {
    id,
    organization_id: null,
    registration_plate: `FT-${id.toUpperCase().slice(0, 3)}`,
    vehicle_type: "van",
    label: null,
    capacity: 4,
    has_wheelchair_lift: false,
    active,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
  };
}

describe("dayKey", () => {
  it("formatte une date locale en YYYY-MM-DD", () => {
    expect(dayKey(new Date(2026, 5, 3, 23, 59))).toBe("2026-06-03");
    expect(dayKey(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
  });
});

describe("buildActivity", () => {
  it("retourne 14 points, zéros inclus", () => {
    const points = buildActivity([], NOW);
    expect(points).toHaveLength(14);
    expect(points.every((p) => p.count === 0)).toBe(true);
    expect(points[13].day).toBe("2026-06-15");
    expect(points[0].day).toBe("2026-06-02");
  });

  it("compte les créations par jour", () => {
    const points = buildActivity(["2026-06-15T08:00:00", "2026-06-15T18:00:00", "2026-06-10T10:00:00"], NOW);
    expect(points.find((p) => p.day === "2026-06-15")?.count).toBe(2);
    expect(points.find((p) => p.day === "2026-06-10")?.count).toBe(1);
    expect(points.find((p) => p.day === "2026-06-11")?.count).toBe(0);
  });
});

describe("computeStats", () => {
  it("totaux nuls sur tableau vide", () => {
    const stats = computeStats({
      requests: [],
      quotes: [],
      shipments: [],
      assignments: [],
      drivers: [],
      vehicles: [],
      now: NOW,
    });
    expect(stats.requests.total).toBe(0);
    expect(stats.quotes.acceptanceRate).toBe(0);
    expect(stats.shipments.active).toBe(0);
    expect(stats.fleet.vehiclesInUse).toBe(0);
    expect(stats.drivers.available).toBe(0);
  });

  it("répartit les demandes par statut et compte aujourd'hui / 7 jours", () => {
    const stats = computeStats({
      requests: [
        request({ status: "submitted", created_at: "2026-06-15T09:00:00" }),
        request({ status: "submitted", created_at: "2026-06-14T09:00:00" }),
        request({ status: "accepted", created_at: "2026-06-01T09:00:00" }),
        request({ status: "completed", pickup_datetime: "2026-06-17T10:00:00" }),
        request({ status: "cancelled", pickup_datetime: "2026-06-16T10:00:00" }),
      ],
      quotes: [],
      shipments: [],
      assignments: [],
      drivers: [],
      vehicles: [],
      now: NOW,
    });
    expect(stats.requests.total).toBe(5);
    expect(stats.requests.byStatus.submitted).toBe(2);
    expect(stats.requests.byStatus.accepted).toBe(1);
    expect(stats.requests.byStatus.cancelled).toBe(1);
    // r1, r4 et r5 héritent du created_at par défaut (jour de NOW)
    expect(stats.requests.today).toBe(3);
    // r1/r2/r3 au 20/06 (dans les 7 jours) ; completed et cancelled exclues
    expect(stats.requests.upcoming7Days).toBe(3);
  });

  it("calcule le taux d'acceptation sur les devis tranchés uniquement", () => {
    const stats = computeStats({
      requests: [],
      quotes: [
        quote({ status: "accepted", amount: 120 }),
        quote({ status: "accepted", amount: 80.5 }),
        quote({ status: "declined" }),
        quote({ status: "sent" }),
        quote({ status: "draft" }),
        quote({ status: "superseded" }),
      ],
      shipments: [],
      assignments: [],
      drivers: [],
      vehicles: [],
      now: NOW,
    });
    // sent + accepted + declined (tout ce qui a été exposé au client)
    expect(stats.quotes.sent).toBe(4);
    expect(stats.quotes.accepted).toBe(2);
    expect(stats.quotes.declined).toBe(1);
    expect(stats.quotes.acceptanceRate).toBe(67);
    expect(stats.quotes.acceptedAmount).toBeCloseTo(200.5);
    expect(stats.quotes.currency).toBe("EUR");
  });

  it("classe les missions actives et celles du jour", () => {
    const stats = computeStats({
      requests: [],
      quotes: [],
      shipments: [
        shipment({ status: "pending_confirmation", scheduled_at: "2026-06-16T14:00:00" }),
        shipment({ status: "confirmed", scheduled_at: "2026-06-16T14:00:00" }),
        shipment({ status: "confirmed", scheduled_at: "2026-06-15T18:00:00" }),
        shipment({ status: "completed", scheduled_at: "2026-06-10T14:00:00" }),
        shipment({ status: "cancelled", scheduled_at: "2026-06-10T14:00:00" }),
      ],
      assignments: [],
      drivers: [],
      vehicles: [],
      now: NOW,
    });
    expect(stats.shipments.total).toBe(5);
    expect(stats.shipments.active).toBe(3);
    expect(stats.shipments.byStatus.completed).toBe(1);
    expect(stats.shipments.scheduledToday).toBe(1);
  });

  it("répartit chauffeurs (occupés / en attente / libres) et véhicules en usage", () => {
    const s1 = shipment({ id: "s1", status: "confirmed" });
    const s2 = shipment({ id: "s2", status: "completed" });
    const stats = computeStats({
      requests: [],
      quotes: [],
      shipments: [s1, s2],
      assignments: [
        assignment({ shipment_id: "s1", driver_id: "d1", vehicle_id: "v1", status: "accepted" }),
        assignment({ shipment_id: "s1", driver_id: "d2", vehicle_id: "v2", status: "proposed" }),
        // affectation sur mission terminée : plus occupé
        assignment({ shipment_id: "s2", driver_id: "d3", vehicle_id: "v3", status: "accepted" }),
      ],
      drivers: [driver("d1"), driver("d2"), driver("d3"), driver("d4")],
      vehicles: [vehicle("v1"), vehicle("v2"), vehicle("v3"), vehicle("v4", false)],
      now: NOW,
    });
    expect(stats.drivers.total).toBe(4);
    expect(stats.drivers.busy).toBe(2);
    expect(stats.drivers.available).toBe(2);
    expect(stats.drivers.pending).toBe(1);
    expect(stats.fleet.vehiclesTotal).toBe(4);
    expect(stats.fleet.vehiclesActive).toBe(3);
    expect(stats.fleet.vehiclesInUse).toBe(2);
  });

  it("acceptanceRate = 0 sans devis tranché", () => {
    const stats = computeStats({
      requests: [],
      quotes: [quote({ status: "sent" }), quote({ status: "draft" })],
      shipments: [],
      assignments: [],
      drivers: [],
      vehicles: [],
      now: NOW,
    });
    expect(stats.quotes.acceptanceRate).toBe(0);
  });
});
