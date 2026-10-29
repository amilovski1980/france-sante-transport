"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Profile } from "@/lib/types";

const NAV = [{ href: "/dashboard/requests", label: "Commandes" }, { href: "/dashboard/notifications", label: "Notifications" }, { href: "/dashboard/messages", label: "Messages" }, { href: "/dashboard/settings", label: "Parametres" }];

export default function DashboardSidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-navy-100 bg-white px-2 dark:border-white/10 dark:bg-[#0f131b]">
      {NAV.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={active ? "shrink-0 border-b-2 border-slate-900 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-white dark:text-white" : "shrink-0 border-b-2 border-transparent px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400"}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
