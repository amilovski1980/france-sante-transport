"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { confirmDeliveryWithProof, notify } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import type { Delivery, Shipment, TransportRequest } from "@/lib/types";

/**
 * Validation de livraison (POD) : nom du destinataire + signature
 * manuscrite (canvas souris/tactile) + note et position optionnelles.
 * Appelle la RPC confirm_delivery : la mission passe delivered/completed.
 */
export default function DeliveryValidation({
  shipment,
  request,
  delivery,
  onClose,
  onConfirmed,
}: {
  shipment: Shipment;
  request: TransportRequest | null;
  delivery?: Delivery | null;
  onClose: () => void;
  onConfirmed: (s: Shipment) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const dirtyRef = useRef(false);
  const [recipient, setRecipient] = useState("");
  const [note, setNote] = useState("");
  const [useGps, setUseGps] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * canvas.width, y: ((e.clientY - rect.top) / rect.height) * canvas.height };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = pos(e);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const p = pos(e);
    if (!p) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    dirtyRef.current = true;
  }

  function end() {
    drawingRef.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dirtyRef.current = false;
  }

  async function captureGps(enable: boolean) {
    setUseGps(enable);
    if (!enable) {
      setCoords(null);
      return;
    }
    if (!navigator.geolocation) {
      setError("Géolocalisation non disponible sur cet appareil.");
      setUseGps(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setCoords({ lat: +position.coords.latitude.toFixed(6), lng: +position.coords.longitude.toFixed(6) }),
      (err) => {
        setError(`Position impossible : ${err.message}`);
        setUseGps(false);
      },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (recipient.trim().length < 2) {
      setError("Indiquez le nom du destinataire (qui a reçu l'envoi).");
      return;
    }
    if (!dirtyRef.current) {
      setError("Faites signer dans le cadre ci-dessous.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const signature = canvasRef.current?.toDataURL("image/png") ?? "";
      if (delivery) {
        await confirmDeliveryWithProof({
          delivery_id: delivery.id,
          recipient_name: recipient.trim(),
          signature_data: signature,
          note: note.trim() || null,
          latitude: useGps && coords ? coords.lat : null,
          longitude: useGps && coords ? coords.lng : null,
        });
        onConfirmed(shipment);
      } else {
        const supabase = createClient();
        const { data, error: err } = await supabase.rpc("confirm_delivery", {
          p_shipment_id: shipment.id,
          p_recipient_name: recipient.trim(),
          p_signature_data: signature,
          p_note: note.trim() || null,
          p_latitude: useGps && coords ? coords.lat : null,
          p_longitude: useGps && coords ? coords.lng : null,
        });
        if (err) throw err;
        const s = Array.isArray(data) ? data[0] : (data as Shipment);
        onConfirmed(s);
      }
      void notify("delivery_proved", shipment.id);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="font-display text-lg font-semibold text-navy-900">Valider la livraison</h3>
        <p className="mt-1 text-xs text-slate-500">
          {request?.pickup_address ? (
            <>Traversée {request.pickup_address} → {request.dropoff_address}</>
          ) : delivery ? (
            <>Livraison de marchandises · mission {shipment.id.slice(0, 8)}</>
          ) : (
            `Mission ${shipment.id.slice(0, 8)}`
          )}
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Destinataire *</label>
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Nom de la personne qui a reçu (réceptionniste, laborantin, magasinier…)"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-navy-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Signature *</label>
            <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-2">
              <canvas
                ref={canvasRef}
                width={520}
                height={180}
                className="h-40 touch-none w-full cursor-crosshair rounded-lg bg-white"
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={end}
                onPointerLeave={end}
              />
              <div className="mt-1.5 flex items-center justify-between px-1">
                <span className="text-[10px] italic text-slate-400">Signature manuscrite du destinataire</span>
                <button type="button" onClick={clear} className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-white">
                  Effacer
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Note (état de l'envoi, incidents…)</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Facultatif"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-navy-400"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={useGps} onChange={(e) => void captureGps(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Joindre ma position GPS {coords && <span className="text-xs text-emerald-600">({coords.lat}, {coords.lng})</span>}
          </label>
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            Annuler
          </button>
          <button type="submit" disabled={busy} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">
            {busy ? "Enregistrement…" : "Valider la livraison"}
          </button>
        </div>
      </form>
    </div>
  );
}
