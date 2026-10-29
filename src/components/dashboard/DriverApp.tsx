"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { respondToAssignment } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import { useLiveRefresh } from "@/lib/useLiveRefresh";
import { formatDateTime } from "@/components/dashboard/ClientDashboard";
import PositionShareToggle from "@/components/dashboard/PositionShareToggle";
import ProfileEditor from "@/components/dashboard/ProfileEditor";
import Avatar from "@/components/Avatar"; import MissionCard from "@/components/dashboard/MissionCard";
import type { DriverAssignment, Profile, Shipment, TransportRequest, Vehicle } from "@/lib/types";

const TABS = ["missions", "compte"] as const;

export default function DriverApp({ driver, assignments, shipments, requests, vehicles }: { driver: Profile; assignments: DriverAssignment[]; shipments: Shipment[]; requests: TransportRequest[]; vehicles: Vehicle[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"missions" | "compte">("missions");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { mode } = useLiveRefresh(["driver_assignments", "shipments"]);
  const requestById = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests]);
  const shipmentById = useMemo(() => new Map(shipments.map((s) => [s.id, s])), [shipments]);
  const active = useMemo(() => assignments.filter((a) => a.status === "proposed" || a.status === "accepted"), [assignments]);
  async function respond(id: string, accept: boolean) { setPendingId(id); setError(null); try { await respondToAssignment(id, accept); router.refresh(); } catch (err) { setError(toUserMessage(err)); } finally { setPendingId(null); } }
  return (<div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-50"><header className="sticky top-0 z-10 flex items-center gap-2 bg-slate-900 px-4 py-3 text-white"><Avatar name={driver.full_name} email={driver.email} src={driver.avatar_url} size="sm" /><div><p className="text-sm font-semibold leading-tight">{driver.full_name || driver.email}</p><p className="text-[11px] text-slate-400">Chauffeur</p></div></header><main className="flex-1 space-y-3 p-4">{tab === "compte" ? (<div className="space-y-4"><PositionShareToggle /><ProfileEditor /></div>) : (<>{error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}{active.length === 0 ? (<div className="rounded-2xl bg-white p-8 text-center shadow-sm"><p className="text-4xl">🚐</p><p className="mt-2 text-sm font-semibold text-slate-800">Aucune mission</p></div>) : active.map((a) => <MissionCard key={a.id} a={a} requestById={requestById} shipmentById={shipmentById} pendingId={pendingId} respond={respond} />)} </>) }</main><nav className="sticky bottom-0 grid grid-cols-2 border-t border-slate-200 bg-white"><button onClick={() => setTab("missions")} className={tab === "missions" ? "py-3 text-xs font-semibold text-slate-900" : "py-3 text-xs font-semibold text-slate-400"}>Missions</button><button onClick={() => setTab("compte")} className={tab === "compte" ? "py-3 text-xs font-semibold text-slate-900" : "py-3 text-xs font-semibold text-slate-400"}>Compte</button></nav></div>);
}
