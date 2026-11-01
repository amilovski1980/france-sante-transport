"use client";

import { useEffect, useRef, useState } from "react";
import { NavIcon } from "@/components/dashboard/NavIcon";
import type { Shipment } from "@/lib/types";

type Action = {
  key: string;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onRun: () => void;
};

/**
 * Menu d'actions collapse pour une mission : un seul bouton toggle
 * au lieu de quatre boutons toujours affichés (moins de redondance
 * sur le panneau admin).
 */
export default function ShipmentActions({
  shipment,
  pending,
  onRun,
  size = "sm",
}: {
  shipment: Shipment;
  pending: boolean;
  onRun: (action: () => Promise<unknown>) => void;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const actions: Action[] = [];
  if (shipment.status === "pending_confirmation") {
    actions.push({
      key: "confirm",
      label: "Confirmer la mission",
      onRun: () => import("@/lib/api").then((m) => onRun(() => m.adminConfirmShipment(shipment.id))),
    });
  }
  if (shipment.status === "confirmed") {
    actions.push({
      key: "start",
      label: "Démarrer la course",
      onRun: () => import("@/lib/api").then((m) => onRun(() => m.adminStartShipment(shipment.id))),
    });
  }
  if (shipment.status === "confirmed" || shipment.status === "in_progress") {
    actions.push({
      key: "complete",
      label: "Terminer la course",
      onRun: () => import("@/lib/api").then((m) => onRun(() => m.adminCompleteShipment(shipment.id))),
    });
  }
  if (shipment.status !== "completed" && shipment.status !== "cancelled") {
    actions.push({
      key: "cancel",
      label: "Annuler la mission",
      danger: true,
      onRun: () => import("@/lib/api").then((m) => onRun(() => m.adminCancelShipment(shipment.id, "Annulée par l'équipe"))),
    });
  }

  if (actions.length === 0) return null;
  const pad = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  const itemPad = size === "sm" ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm";

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full border border-navy-200 ${pad} font-semibold text-navy-700 transition hover:bg-navy-50 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10`}
      >
        <NavIcon name="settings" className="h-3.5 w-3.5" />
        Actions
        <span
          aria-hidden="true"
          className={`transition-transform ${open ? "rotate-180" : ""} text-[9px] leading-none`}
        >
          ▼
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-xl border border-navy-100 bg-white shadow-xl dark:border-white/15 dark:bg-[#151a23]"
        >
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                void a.onRun();
              }}
              className={`block w-full ${itemPad} text-left font-semibold transition-colors disabled:opacity-50 ${
                a.danger
                  ? "text-flagred-700 hover:bg-flagred-50 dark:text-red-400 dark:hover:bg-red-500/10"
                  : "text-navy-700 hover:bg-navy-50 dark:text-slate-200 dark:hover:bg-white/10"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
