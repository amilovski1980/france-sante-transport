"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const ITEMS = [{ href: "/dashboard/requests", label: "Maison" }, { href: "/dashboard/orders", label: "Commandes" }, { href: "/dashboard/notifications", label: "Alertes" }, { href: "/dashboard/messages", label: "Messages" }, { href: "/dashboard/settings", label: "Reglages" }];
export default function BottomNav() {
  const pathname = usePathname();
  return (<nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center justify-around border-t border-white/40 bg-white/70 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-xl dark:border-white/10 dark:bg-black/50">{ITEMS.map((it) => { const active = pathname.startsWith(it.href); return (<Link key={it.href} href={it.href} className={active ? "flex flex-1 flex-col items-center gap-0.5 text-[10px] font-semibold text-blue-600" : "flex flex-1 flex-col items-center gap-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400"}><span className={active ? "h-1.5 w-1.5 rounded-full bg-blue-600" : "h-1.5 w-1.5 rounded-full bg-transparent"} />{it.label}</Link>); })}</nav>);
}
