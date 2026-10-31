"use client";

const TONES = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  normal: "bg-blue-100 text-blue-700 border-blue-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
} as const;

export type Priority = keyof typeof TONES;

const LABELS: Record<Priority, string> = {
  critical: "Critique",
  high: "Haute",
  normal: "Normale",
  low: "Basse",
};

export default function PriorityBadge({ level }: { level: Priority }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONES[level]}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[level]}
    </span>
  );
}
