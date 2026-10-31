"use client";

const STEPS = ["Demande", "Devis", "En route", "Livré"] as const;

export default function Stepper({ active }: { active: number }) {
  return (
    <ol className="flex items-center justify-between gap-2">
      {STEPS.map((label, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                done
                  ? "bg-emerald-500 text-white"
                  : current
                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : "bg-slate-200 text-slate-500"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={`hidden text-xs font-semibold sm:block ${current ? "text-blue-700" : done ? "text-emerald-700" : "text-slate-400"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span className={`h-0.5 flex-1 rounded-full ${done ? "bg-emerald-400" : "bg-slate-200"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
