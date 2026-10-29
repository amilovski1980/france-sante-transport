"use client";

import { useEffect, useState } from "react";

export default function Countdown({ deadline }: { deadline: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - now;
  const expired = diff <= 0;
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const s = Math.floor((abs % 60000) / 1000);
  const label = `${h > 0 ? h + "h " : ""}${m}m ${s}s`;
  return <span className={`font-mono text-xs font-bold ${expired ? "text-red-500" : diff < 900000 ? "text-amber-400" : "text-slate-300"}`}>{expired ? "EXPIRÉ " : ""}{label}</span>;
}
