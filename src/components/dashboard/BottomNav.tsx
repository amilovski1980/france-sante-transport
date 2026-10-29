"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

function Icon({ name, active }: { name: string; active: boolean }) {
  const c = active ? "#2563eb" : "#64748b";
  const common = { fill: "none", stroke: c, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "home") return <svg width="22" height="22" viewBox="0 0 24 24" {...common}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>;
  if (name === "orders") return <svg width="22" height="22" viewBox="0 0 24 24" {...common}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>;
  if (name === "bell") return <svg width="22" height="22" viewBox="0 0 24 24" {...common}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>;
  if (name === "msg") return <svg width="22" height="22" viewBox="0 0 24 24" {...common}><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.6 8.6 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z" /></svg>;
  return <svg width="22" height="22" viewBox="0 0 24 24" {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 12 4.6a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 19.4 11a2 2 0 1 1 0 4Z" /></svg>;
}

const ITEMS = [{ href: "/dashboard/requests", label: "Accueil", icon: "home" }, { href: "/dashboard/orders", label: "Commandes", icon: "orders" }, { href: "/dashboard/notifications", label: "Alertes", icon: "bell" }, { href: "/dashboard/messages", label: "Messages", icon: "msg" }, { href: "/dashboard/settings", label: "Reglages", icon: "settings" }];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-stretch justify-around border-t border-slate-200 bg-white px-1 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      {ITEMS.map((it) => {
        const active = pathname.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} className="flex flex-1 flex-col items-center gap-1 py-1">
            <Icon name={it.icon} active={active} />
            <span className={active ? "text-[10px] font-semibold text-blue-600" : "text-[10px] font-medium text-slate-500"}>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
