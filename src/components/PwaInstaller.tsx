"use client";

import { useEffect, useRef, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "fst-pwa-install-dismissed";
const DISMISS_DAYS = 30;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const touchMac = /macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || touchMac;
}

function wasDismissed(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

export default function PwaInstaller() {
  const promptRef = useRef<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    if (isStandalone() || wasDismissed()) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as InstallPromptEvent;
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      promptRef.current = null;
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIos()) {
      setIos(true);
      timer = setTimeout(() => {
        if (!isStandalone() && !wasDismissed()) setVisible(true);
      }, 2500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      return;
    }
  }

  async function install() {
    const prompt = promptRef.current;
    if (!prompt) return;
    setInstalling(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setVisible(false);
      else dismiss();
    } finally {
      setInstalling(false);
      promptRef.current = null;
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md print:hidden md:bottom-6">
      <div className="rounded-2xl border border-navy-100 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-[#151a23]">
        <div className="flex items-start gap-3">
          <img src="/logo.png" alt="" className="h-11 w-11 rounded-xl bg-navy-50 object-contain p-1" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-navy-900 dark:text-white">
              Installer France Santé Transport
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-navy-500 dark:text-slate-400">
              {ios
                ? "Sur Safari, touchez Partager puis « Sur l'écran d'accueil » pour retrouver l'application en un geste."
                : "Accédez à votre espace en plein écran, comme une application, sans passer par le navigateur."}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fermer"
            className="rounded-full p-1.5 text-navy-400 hover:bg-navy-50 hover:text-navy-700 dark:hover:bg-white/10"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {ios ? (
          <ol className="mt-3 space-y-1 rounded-xl bg-navy-50 px-3 py-2.5 text-xs text-navy-700 dark:bg-white/5 dark:text-slate-300">
            <li>1. Touchez l&apos;icône Partager en bas de Safari.</li>
            <li>2. Choisissez « Sur l&apos;écran d&apos;accueil ».</li>
            <li>3. Validez avec « Ajouter ».</li>
          </ol>
        ) : (
          <button
            type="button"
            onClick={() => void install()}
            disabled={installing}
            className="mt-3 w-full rounded-xl bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-700 disabled:opacity-50"
          >
            {installing ? "Installation…" : "Ajouter à l'écran d'accueil"}
          </button>
        )}
      </div>
    </div>
  );
}
