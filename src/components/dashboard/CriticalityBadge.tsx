"use client";
import type { Criticality } from "@/lib/types";
const CONFIG: Record<Criticality, { dot: string; bg: string; text: string; label: string }> = {
  critical: { dot: "bg-red-500", bg: "bg-red-500/15", text: "text-red-400", label: "CRITIQUE" },
  urgent: { dot: "bg-amber-400", bg: "bg-amber-400/15", text: "text-amber-300", label: "URGENT" },
  standard: { dot: "bg-emerald-400", bg: "bg-emerald-400/15", text: "text-emerald-300", label: "STANDARD" },
};
export default function CriticalityBadge({ level }: { level: Criticality }) {
  const c = CONFIG[level];
  return (<span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider ${c.bg} ${c.text}`}><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />{c.label}</span>);
}
