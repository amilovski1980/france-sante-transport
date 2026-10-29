"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { formatMoney } from "@/components/dashboard/ClientDashboard";

const BASE_PER_KM = 2.5;
const FIXED = 12;

export default function MarginCalculator() {
  const { t, locale } = useI18n();
  const [distance, setDistance] = useState(45);
  const [night, setNight] = useState(false);
  const [weekend, setWeekend] = useState(false);
  const [danger, setDanger] = useState(false);

  const result = useMemo(() => {
    let price = FIXED + distance * BASE_PER_KM;
    if (night) price *= 1.2;
    if (weekend) price *= 1.15;
    if (danger) price += 6.3;
    const cost = price * 0.74;
    const margin = price - cost;
    const pct = price > 0 ? Math.round((margin / price) * 100) : 0;
    return { price, margin, pct };
  }, [distance, night, weekend, danger]);

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">{t("mc.baseKm")}</label>
          <input readOnly value={formatMoney(BASE_PER_KM, "EUR", locale)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">{t("mc.distance")}</label>
          <input type="number" value={distance} onChange={(e) => setDistance(Number(e.target.value) || 0)} className={inputClass} />
        </div>
      </div>
      <div className="space-y-1.5 text-sm text-slate-700">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={night} onChange={(e) => setNight(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
          {t("mc.night")}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={weekend} onChange={(e) => setWeekend(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
          {t("mc.weekend")}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={danger} onChange={(e) => setDanger(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
          {t("mc.danger")}
        </label>
      </div>
      <div className="rounded-xl bg-blue-50 p-4">
        <p className="text-xs font-medium text-blue-700">{t("mc.advised")}</p>
        <p className="mt-1 font-display text-2xl font-bold text-blue-900">{formatMoney(result.price, "EUR", locale)}</p>
        <p className="mt-1 text-xs font-semibold text-emerald-700">{t("mc.margin")} : {result.pct}%</p>
      </div>
    </div>
  );
}
