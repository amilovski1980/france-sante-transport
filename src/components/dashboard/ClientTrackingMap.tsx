"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import {
  getShipmentDriverPosition,
  getShipmentTrack,
  type ShipmentDriverPosition,
  type ShipmentTrackPoint,
} from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import { useLiveRefresh } from "@/lib/useLiveRefresh";

/**
 * Carte de suivi côté client : affiche uniquement la position partagée du
 * chauffeur affecté à une mission donnée. L'accès est contrôlé côté serveur
 * par la RPC `shipment_driver_position` ; si le chauffeur n'a pas activé le
 * partage, la carte affiche un message d'attente.
 */
export default function ClientTrackingMap({
  shipmentId,
  pickupAddress,
  dropoffAddress,
}: {
  shipmentId: string;
  pickupAddress: string;
  dropoffAddress: string;
}) {
  const { t, locale } = useI18n();
  const { mode } = useLiveRefresh(["driver_positions"], { pollMs: 10000 });

  const [position, setPosition] = useState<ShipmentDriverPosition | null>(null);
  const [track, setTrack] = useState<ShipmentTrackPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const readyRef = useRef<Promise<void> | null>(null);

  // Chargement de la position du chauffeur pour cette mission
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [pos, pts] = await Promise.all([
          getShipmentDriverPosition(shipmentId),
          getShipmentTrack(shipmentId),
        ]);
        if (!cancelled) {
          setPosition(pos);
          setTrack(pts);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(toUserMessage(err));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [shipmentId, mode]);

  // Création unique de la carte
  useEffect(() => {
    let cancelled = false;
    const init = (async () => {
      const container = containerRef.current;
      if (!container) return;
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
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

  // Mise à jour du marqueur quand la position change
  useEffect(() => {
    const ready = readyRef.current;
    if (!ready) return;
    void ready.then(() => {
      const L = LRef.current;
      const layer = layerRef.current;
      const map = mapRef.current;
      if (!L || !layer || !map) return;

      layer.clearLayers();

      if (!position || position.lat == null || position.lng == null || !position.shared) {
        map.setView([48.8566, 2.3522], 6);
        return;
      }

      const icon = L.divIcon({
        className: "",
        html: `<div class="relative flex h-4 w-4 items-center justify-center">
                 <span class="absolute inline-flex h-4 w-4 animate-ping rounded-full bg-flagred-400 opacity-60"></span>
                 <span class="relative h-3 w-3 rounded-full border-2 border-white bg-flagred-600 shadow"></span>
               </div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      if (track.length >= 2) {
        const latlngs = track.map((p) => [p.lat, p.lng] as [number, number]);
        L.polyline(latlngs, {
          color: "#c81e3a",
          weight: 4,
          opacity: 0.75,
          lineJoin: "round",
        }).addTo(layer);
      }

      const updated = position.updated_at
        ? new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(
            new Date(position.updated_at),
          )
        : null;
      const detail =
        position.accuracy != null
          ? t("map.accuracy", { n: Math.round(position.accuracy) })
          : t("map.shared");
      const popup = `<strong>${t("ctm.vehicle")}</strong><br/>${detail}${
        updated ? `<br/>${t("map.updated", { t: updated })}` : ""
      }`;

      L.marker([position.lat, position.lng], { icon }).bindPopup(popup).addTo(layer);
      map.setView([position.lat, position.lng], 13);
    });
  }, [position, track, locale, t]);

  const hasPosition =
    position != null && position.lat != null && position.lng != null && position.shared;

  return (
    <div className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-navy-500">
          {t("ctm.title")}
        </p>
        <span className="text-xs text-navy-400">
          {t("ctm.route", { from: pickupAddress, to: dropoffAddress })}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-lg">
        <div
          ref={containerRef}
          className="h-64 w-full bg-navy-100"
          role="application"
          aria-label={t("map.aria")}
        />
        {!hasPosition && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/90 px-6 text-center">
            <p className="max-w-sm text-sm text-navy-500">
              {position && !position.shared ? t("ctm.notSharing") : t("ctm.waiting")}
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs font-medium text-flagred-700">{error}</p>
      )}
      {hasPosition && position?.updated_at && (
        <p className="mt-2 text-xs text-navy-500">
          {t("map.updated", {
            t: new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(
              new Date(position.updated_at),
            ),
          })}
        </p>
      )}
    </div>
  );
}
