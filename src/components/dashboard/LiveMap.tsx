"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/components/I18nProvider";
import { positionFreshness, type PositionFreshness } from "@/lib/geo";
import type { DriverLocation, Profile } from "@/lib/types";

/**
 * Carte des positions chauffeurs (OpenStreetMap + Leaflet).
 * Leaflet est importé dynamiquement côté client uniquement (effet) : aucun
 * accès à `window` au moment du rendu serveur. Marqueurs en divIcon (pas
 * d'assets d'images à résoudre côté bundler).
 */
export default function LiveMap({
  positions,
  drivers,
}: {
  positions: DriverLocation[];
  drivers: Profile[];
}) {
  const { t, locale } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const readyRef = useRef<Promise<void> | null>(null);

  // Création unique de la carte
  useEffect(() => {
    let cancelled = false;

    const init = (async () => {
      const container = containerRef.current;
      if (!container) return;
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;
      LRef.current = L;

      const map = L.map(container, { zoomControl: true }).setView([48.8566, 2.3522], 6);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
    })();

    readyRef.current = init;

    return () => {
      cancelled = true;
      void init.then(() => {
        mapRef.current?.remove();
        mapRef.current = null;
        layerRef.current = null;
        LRef.current = null;
      });
    };
  }, []);

  // Mise à jour des marqueurs à chaque changement de positions
  useEffect(() => {
    const ready = readyRef.current;
    if (!ready) return;
    void ready.then(() => {
      const L = LRef.current;
      const layer = layerRef.current;
      const map = mapRef.current;
      if (!L || !layer || !map) return;

      layer.clearLayers();
      const bounds: [number, number][] = [];
      const driverById = new Map(drivers.map((d) => [d.id, d]));

      const freshnessStyles: Record<PositionFreshness, { ping: string; dot: string }> = {
        live: { ping: "bg-flagred-400 opacity-60", dot: "bg-flagred-600" },
        stale: { ping: "bg-amber-400 opacity-50", dot: "bg-amber-500" },
        offline: { ping: "bg-navy-300 opacity-40", dot: "bg-navy-400" },
      };

      for (const p of positions) {
        bounds.push([p.lat, p.lng]);
        const driver = driverById.get(p.driver_id);
        const name = driver?.full_name || driver?.email || "Chauffeur";
        const fresh = positionFreshness(p.updated_at);
        const style = freshnessStyles[fresh];
        const icon = L.divIcon({
          className: "",
          html: `<div class="relative flex h-4 w-4 items-center justify-center">
                   <span class="absolute inline-flex h-4 w-4 animate-ping rounded-full ${style.ping}"></span>
                   <span class="relative h-3 w-3 rounded-full border-2 border-white ${style.dot} shadow"></span>
                 </div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        const updated = new Intl.DateTimeFormat(locale, {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(p.updated_at));
        const detail =
          p.accuracy != null
            ? t("map.accuracy", { n: Math.round(p.accuracy) })
            : t("map.shared");
        const freshnessLabel = t(`map.fresh.${fresh}`);
        const safeName = name.replace(/[<>&]/g, "");
        L.marker([p.lat, p.lng], { icon })
          .bindPopup(
            `<strong>${safeName}</strong><br/>${detail}<br/>${freshnessLabel}<br/>${t("map.updated", { t: updated })}`,
          )
          .addTo(layer);
      }

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      } else {
        map.setView([48.8566, 2.3522], 6);
      }
    });
  }, [positions, drivers, locale, t]);

  const hasMarkers = positions.length > 0;

  return (
    <article className="surface overflow-hidden">
      <div className="border-b border-navy-100 bg-navy-50/50 px-5 py-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-navy-500">
          {t("map.title")}
        </h3>
      </div>
      <div className="relative">
        <div
          ref={containerRef}
          className="relative z-0 h-80 w-full bg-navy-100 print:hidden"
          role="application"
          aria-label={t("map.aria")}
        />
        {!hasMarkers && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/90 px-6 text-center">
            <p className="max-w-md text-sm text-navy-500">
              {t("map.empty")}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
