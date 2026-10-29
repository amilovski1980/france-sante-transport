"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const ITEMS = [{ href: "/dashboard/admin", label: "Vue d'ensemble", icon: "📊" }, { href: "/dashboard/requests", label: "Dossiers", icon: "📋" }, { href: "/dashboard/admin/agenda", label: "Agenda", icon: "📅" }, { href: "/dashboard/users", label: "Clients", icon: "👥" }, { href: "/dashboard/admin/fleet", label: "Flotte", icon: "🚐" }, { href: "/dashboard/settings", label: "Parametres", icon: "⚙️" }];
export default function AdminSidebar() {
  const pathname = usePathname();
  return (<aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white md:flex"><div className="border-b border-slate-100 px-5 py-5"><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Console</p><p className="mt-1 text-lg font-bold text-slate-900">Administration</p></div><nav className="flex-1 space-y-1 p-3">{ITEMS.map((it) => { const active = it.href === "/dashboard/admin" ? pathname === "/dashboard/admin" : pathname.startsWith(it.href); return (<Link key={it.href} href={it.href} className={active ? "flex items-center gap-3 rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white" : "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"}><span className="text-base">{it.icon}</span>{it.label}</Link>); })}</nav></aside>);
}
