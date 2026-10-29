"use client";

type Tone = "blue" | "green" | "purple" | "orange" | "navy";

const TONES: Record<Tone, { bg: string; icon: string; text: string }> = {
  blue: { bg: "bg-blue-50", icon: "bg-blue-600", text: "text-blue-700" },
  green: { bg: "bg-emerald-50", icon: "bg-emerald-600", text: "text-emerald-700" },
  purple: { bg: "bg-violet-50", icon: "bg-violet-600", text: "text-violet-700" },
  orange: { bg: "bg-amber-50", icon: "bg-amber-500", text: "text-amber-700" },
  navy: { bg: "bg-navy-50", icon: "bg-navy-700", text: "text-navy-800" },
};

export default function StatCard({
  label,
  value,
  trend,
  icon,
  tone = "blue",
}: {
  label: string;
  value: string;
  trend?: string;
  icon?: React.ReactNode;
  tone?: Tone;
}) {
  const c = TONES[tone];
  const up = trend?.startsWith("+");
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold text-slate-900">{value}</p>
          {trend && (
            <p className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold ${up ? "text-emerald-600" : "text-flagred-600"}`}>
              <span aria-hidden="true">{up ? "↑" : "↓"}</span>
              {trend}
            </p>
          )}
        </div>
        {icon && (
          <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-white ${c.icon}`}>
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}
