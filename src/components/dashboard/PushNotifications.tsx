"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PushState = "unsupported" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Notifications push navigateur (mobile d'abord). Enregistre /sw.js,
 * demande la permission système, chiffre l'abonnement VAPID et l'envoie
 * au serveur. Test et désactivation inclus.
 */
export default function PushNotifications() {
  const [state, setState] = useState<PushState>("off");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const detect = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      // Web Push fonctionne sur Safari (16.4+) : Notification existe toujours.
      if (!("Notification" in window)) {
        setSupported(false);
        setState("unsupported");
        return;
      }
    }
    setSupported(true);
    try {
      const permission = Notification.permission;
      if (permission === "denied") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub && permission === "granted") {
        setState("on");
        setEndpoint(sub.endpoint);
      } else {
        setState("off");
        setEndpoint(null);
      }
    } catch {
      setState("off");
    }
  }, []);

  useEffect(() => {
    void detect();
  }, [detect]);

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        setMessage("Permission refusée — autorisez les notifications dans les réglages du navigateur.");
        return;
      }
      // Chiffrement + enregistrement du service worker
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
      if (!publicKey) {
        setMessage("Clés VAPID absentes côté client — contactez l'administrateur.");
        return;
      }
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const res = await fetch("/api/push/subscribe", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      if (!data.ok) {
        setMessage(data.error ?? "Enregistrement impossible");
        return;
      }
      setEndpoint(sub.endpoint);
      setState("on");
      setMessage("Notifications activées sur cet appareil ✓");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erreur d'enregistrement");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!endpoint) return;
    setBusy(true);
    try {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      await sub?.unsubscribe();
      setState("off");
      setEndpoint(null);
      setMessage("Notifications désactivées sur cet appareil.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json();
      setMessage(data.ok ? "Notification de test envoyée 🎉" : data.error ?? "Test échoué");
    } catch {
      setMessage("Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-pro overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700 dark:text-slate-200">
          Notifications du navigateur (mobile)
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Devis, factures et missions poussés directement sur cet appareil — même en arrière-plan.
        </p>
      </div>
      <div className="px-5 py-4">
        {message && (
          <p className={`mb-3 text-xs font-semibold ${message.includes("refus") ? "text-amber-600" : "text-slate-500 dark:text-slate-300"}`}>
            {message}
          </p>
        )}
        {!supported ? (
          <p className="text-sm text-slate-400">
            Votre navigateur ne prend pas en charge les notifications push. Essayez Chrome (Android) ou Safari 16.4+ (iPhone).
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {state === "on" ? (
              <>
                <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  ACTIVÉES SUR CET APPAREIL
                </span>
                <button
                  type="button"
                  onClick={() => void test()}
                  disabled={busy}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-navy-700 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  🔔 Envoyer un test
                </button>
                <button
                  type="button"
                  onClick={() => void disable()}
                  disabled={busy}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10"
                >
                  Désactiver
                </button>
              </>
            ) : state === "denied" ? (
              <p className="text-sm text-amber-600">
                Refusé : réactivez les notifications dans les réglages du site (constante 🔒 dans la barre d'adresse).
              </p>
            ) : (
              <button
                type="button"
                onClick={() => void enable()}
                disabled={busy}
                className="rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-40"
              >
                {busy ? "Activation…" : "🔔 Activer les notifications"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
