"use client";

import { useEffect, useRef, useState } from "react";
import { shareDriverPosition } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";

const MIN_INTERVAL_MS = 5000;
const MIN_DISTANCE_DEG = 0.00015; // ≈ 15 m

interface Fix {
  lat: number;
  lng: number;
  acc: number | null;
  t: number;
}

function distanceDeg(a: Fix, lat: number, lng: number): number {
  const dLat = a.lat - lat;
  const dLng = (a.lng - lng) * Math.cos((lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Partage de position GPS du chauffeur (RLS : sa propre ligne uniquement,
 * via la RPC share_driver_position). Le dispatch ne voit que les positions
 * partagées ; l'arrêt masque la dernière position sans la supprimer.
 */
export default function PositionShareToggle() {
  const { t, locale } = useI18n();
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const watchIdRef = useRef<number | null>(null);
  const lastFixRef = useRef<Fix | null>(null);
  const sendingRef = useRef(false);

  const stopWatch = () => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  async function pushFix(lat: number, lng: number, acc: number | null, shared: boolean) {
    if (sendingRef.current) return;
    sendingRef.current = true;
    try {
      await shareDriverPosition(lat, lng, acc, shared);
      if (shared && typeof document !== "undefined") {
        setLastSentAt(new Date().toISOString());
      }
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      sendingRef.current = false;
    }
  }

  function startWatch() {
    if (!navigator.geolocation) {
      setError(t("gps.noApi"));
      setSharing(false);
      return;
    }
    setError(null);
    setSharing(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const now = Date.now();
        const last = lastFixRef.current;
        if (last && now - last.t < MIN_INTERVAL_MS && distanceDeg(last, latitude, longitude) < MIN_DISTANCE_DEG) {
          return;
        }
        const fix: Fix = { lat: latitude, lng: longitude, acc: accuracy ?? null, t: now };
        lastFixRef.current = fix;
        void pushFix(fix.lat, fix.lng, fix.acc, true);
      },
      (err) => {
        stopWatch();
        setSharing(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? t("gps.denied")
            : t("gps.unavailable"),
        );
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 },
    );
  }

  function stopSharing() {
    stopWatch();
    setSharing(false);
    const last = lastFixRef.current;
    if (last) {
      void pushFix(last.lat, last.lng, last.acc, false);
    }
    setLastSentAt(null);
  }

  // À l'ouverture : on reprend l'état partagé précédent s'il existe.
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const supabase = createClient();
        const { data: row } = await supabase
          .from("driver_positions")
          .select("lat, lng, accuracy, shared, updated_at")
          .maybeSingle();
        if (cancelled) return;
        if (row && row.shared) {
          lastFixRef.current = {
            lat: row.lat,
            lng: row.lng,
            acc: row.accuracy,
            t: new Date(row.updated_at).getTime(),
          };
          setLastSentAt(row.updated_at);
          startWatch();
        }
      } catch {
        // démarrage à froid : l'utilisateur pourra activer manuellement
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
      stopWatch();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastSentLabel = lastSentAt
    ? new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(new Date(lastSentAt))
    : null;

  return (
    <div className="surface flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div>
        <p className="text-sm font-semibold text-navy-900">Position GPS</p>
        <p className="mt-0.5 text-xs text-navy-500">
          {sharing
            ? `${t("gps.active")}${lastSentLabel ? t("gps.lastSent", { t: lastSentLabel }) : ""}${t("gps.visibleDispatch")}`
            : t("gps.notVisible")}
        </p>
        {error && <p className="mt-1 text-xs font-medium text-flagred-700">{error}</p>}
      </div>
      <div className="flex items-center gap-3">
        {sharing && (
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {t("gps.onAir")}
          </span>
        )}
        <button
          type="button"
          disabled={initializing}
          onClick={() => (sharing ? stopSharing() : startWatch())}
          className={`rounded-full px-5 py-2 text-xs font-semibold transition disabled:opacity-60 ${
            sharing
              ? "border border-navy-200 text-navy-700 hover:bg-navy-50"
              : "bg-flagred-600 text-white hover:bg-flagred-700"
          }`}
        >
          {initializing ? t("common.loading") : sharing ? t("gps.stop") : t("gps.start")}
        </button>
      </div>
    </div>
  );
}
