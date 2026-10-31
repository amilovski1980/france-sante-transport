import { describe, expect, it } from "vitest";

import { estimateEtaMinutes, haversineKm, positionFreshness } from "@/lib/geo";

describe("haversineKm", () => {
  it("renvoie 0 pour un meme point", () => {
    expect(haversineKm({ lat: 48.8566, lng: 2.3522 }, { lat: 48.8566, lng: 2.3522 })).toBe(0);
  });

  it("calcule Paris - Lyon (~392 km)", () => {
    const d = haversineKm({ lat: 48.8566, lng: 2.3522 }, { lat: 45.764, lng: 4.8357 });
    expect(d).toBeGreaterThan(380);
    expect(d).toBeLessThan(400);
  });

  it("est symetrique", () => {
    const a = { lat: 43.6, lng: 1.44 };
    const b = { lat: 44.8, lng: 1.2 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 6);
  });
});

describe("estimateEtaMinutes", () => {
  it("renvoie 0 pour une distance nulle ou negative", () => {
    expect(estimateEtaMinutes(0)).toBe(0);
    expect(estimateEtaMinutes(-5)).toBe(0);
  });

  it("estime 60 minutes pour 40 km a 40 km/h", () => {
    expect(estimateEtaMinutes(40, 40)).toBe(60);
  });

  it("renvoie au moins 1 minute", () => {
    expect(estimateEtaMinutes(0.1, 40)).toBe(1);
  });

  it("renvoie 0 si la vitesse est invalide", () => {
    expect(estimateEtaMinutes(10, 0)).toBe(0);
  });
});

describe("positionFreshness", () => {
  const now = new Date("2026-01-01T12:00:00Z").getTime();

  it("offline sans date", () => {
    expect(positionFreshness(null, now)).toBe("offline");
    expect(positionFreshness(undefined, now)).toBe("offline");
    expect(positionFreshness("nope", now)).toBe("offline");
  });

  it("live sous 90 s", () => {
    const t = new Date(now - 30000).toISOString();
    expect(positionFreshness(t, now)).toBe("live");
  });

  it("stale entre 90 s et 5 min", () => {
    const t = new Date(now - 120000).toISOString();
    expect(positionFreshness(t, now)).toBe("stale");
  });

  it("offline au-dela de 5 min", () => {
    const t = new Date(now - 360000).toISOString();
    expect(positionFreshness(t, now)).toBe("offline");
  });
});
