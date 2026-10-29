"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type LiveMode = "connecting" | "realtime" | "polling";

export interface LiveRefreshState {
  mode: LiveMode;
  lastSyncAt: Date;
}

const DEFAULT_POLL_MS = 8000;
const REALTIME_TIMEOUT_MS = 4000;
const DEBOUNCE_MS = 400;

/**
 * Suivi temps réel des tables métier.
 *
 * Tente un canal Supabase Realtime (postgres_changes) ; si le service n'est pas
 * disponible ou n'aboutit pas dans les ~4 s, bascule sur un polling de
 * `router.refresh()` (défaut 8 s). Dans les deux cas le rendu serveur est
 * revalidé, donc les politiques RLS restent appliquées à chaque rafraîchissement.
 */
export function useLiveRefresh(
  tables: string[],
  options?: { pollMs?: number; enabled?: boolean },
): LiveRefreshState & { refresh: () => void } {
  const router = useRouter();
  const pollMs = options?.pollMs ?? DEFAULT_POLL_MS;
  const enabled = options?.enabled ?? true;

  const [mode, setMode] = useState<LiveMode>("connecting");
  const [lastSyncAt, setLastSyncAt] = useState<Date>(() => new Date());

  const refresh = useCallback(() => {
    setLastSyncAt(new Date());
    router.refresh();
  }, [router]);

  // Refs pour garder les mêmes closures dans les timers/callbacks async
  const tablesKey = tables.join(",");
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled || tables.length === 0) {
      setMode("polling");
      return;
    }

    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const debouncedRefresh = () => {
      if (cancelled) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => refreshRef.current(), DEBOUNCE_MS);
    };

    const startPolling = () => {
      if (cancelled || pollTimer) return;
      setMode("polling");
      pollTimer = setInterval(() => refreshRef.current(), pollMs);
    };

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const supabase = createClient();
    channel = supabase.channel(`live:${tablesKey}`);

    for (const table of tablesKey.split(",")) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        debouncedRefresh,
      );
    }

    channel.subscribe((status) => {
      if (cancelled) return;
      if (status === "SUBSCRIBED") {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        setMode("realtime");
        stopPolling();
        refreshRef.current();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        startPolling();
      }
    });

    // Filet de sécurité : sans SUBSCRIBED dans le délai, on poll (service
    // Realtime absent ou inaccessible).
    timeoutTimer = setTimeout(() => {
      if (cancelled) return;
      if (channel?.state !== "joined") startPolling();
    }, REALTIME_TIMEOUT_MS);

    return () => {
      cancelled = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (debounceTimer) clearTimeout(debounceTimer);
      stopPolling();
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [tablesKey, pollMs, enabled]);

  return { mode, lastSyncAt, refresh };
}
