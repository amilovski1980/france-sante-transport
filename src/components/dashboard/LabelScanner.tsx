"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (image: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};

/**
 * Scanner d'étiquette mission : camera arrière + BarcodeDetector quand
 * disponible, sinon saisie manuelle du code FST-XXXXXXXX de l'étiquette.
 */
export default function LabelScanner({
  expectedRef,
  onClose,
  onValidate,
}: {
  expectedRef: string;
  onClose: () => void;
  onValidate: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const accept = useCallback(() => {
    stopScan();
    onValidate();
    onClose();
  }, [onClose, onValidate]);

  const stopScan = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        if (!Detector) {
          setStatus("Scanneur natif indisponible : saisissez le code manuellement.");
          return;
        }
        const detector = new Detector({ formats: ["qr_code"] });
        setScanning(true);
        timerRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue ?? "";
            if (value.includes(expectedRef)) {
              accept();
            }
          } catch {
            // image pas encore exploitable, on retente au prochain cycle
          }
        }, 500);
      } catch {
        setStatus("Caméra indisponible : saisissez le code manuellement.");
      }
    }

    void start();
    return () => {
      cancelled = true;
      stopScan();
    };
  }, [expectedRef, accept, stopScan]);

  function submitManual() {
    if (manual.trim().toUpperCase().includes(expectedRef)) accept();
    else setStatus(`Code attendu : ${expectedRef} (imprimé sous le QR de l'étiquette).`);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-navy-900/90 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Scanner l'étiquette"
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Scanner l&apos;étiquette</p>
          <button
            type="button"
            onClick={() => {
              stopScan();
              onClose();
            }}
            aria-label="Fermer"
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <video
          ref={videoRef}
          playsInline
          muted
          className="h-64 w-full rounded-2xl bg-black object-cover md:h-80"
        />
        {scanning && (
          <p className="text-center text-xs font-medium text-slate-300">
            Cadrez le QR de l&apos;étiquette ({expectedRef}) dans la caméra.
          </p>
        )}

        {status && (
          <p role="status" className="rounded-xl bg-white/10 px-3 py-2 text-center text-xs text-slate-200">
            {status}
          </p>
        )}

        <div className="rounded-2xl bg-white p-4">
          <label className="block text-xs font-semibold text-navy-700" htmlFor="label-code">
            Code étiquette
            <input
              id="label-code"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitManual();
              }}
              placeholder={expectedRef}
              className="mt-1 w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 font-mono text-sm font-semibold text-navy-900 focus:border-navy-500 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={submitManual}
            className="mt-3 w-full rounded-xl bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700"
          >
            Valider le code
          </button>
        </div>
      </div>
    </div>
  );
}
