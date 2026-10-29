// Utilitaires geo pour le suivi temps reel (Tracki). Fonctions pures, testables.

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

/** Distance en km entre deux points (formule de Haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Estimation du temps de trajet (minutes) a partir d'une distance. */
export function estimateEtaMinutes(distanceKm: number, avgSpeedKmh = 40): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;
  if (!Number.isFinite(avgSpeedKmh) || avgSpeedKmh <= 0) return 0;
  return Math.max(1, Math.round((distanceKm / avgSpeedKmh) * 60));
}

export type PositionFreshness = "live" | "stale" | "offline";

/**
 * Fraicheur d'une position GPS d'apres son updated_at.
 * - live : < liveMs (defaut 90 s)
 * - stale : < offlineMs (defaut 5 min)
 * - offline : au-dela
 */
export function positionFreshness(
  updatedAt: string | null | undefined,
  now: number = Date.now(),
  liveMs = 90000,
  offlineMs = 300000,
): PositionFreshness {
  if (!updatedAt) return "offline";
  const ts = new Date(updatedAt).getTime();
  if (!Number.isFinite(ts)) return "offline";
  const age = now - ts;
  if (age <= liveMs) return "live";
  if (age <= offlineMs) return "stale";
  return "offline";
}
