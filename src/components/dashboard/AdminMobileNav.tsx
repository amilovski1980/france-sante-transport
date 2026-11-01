"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Profile } from "@/lib/types";
import { adminNavItems, isAdminNavItemActive } from "@/lib/admin-nav";
import { NavGlyph } from "@/components/dashboard/NavIcon";

export default function AdminMobileNav({ role }: { role: Profile["role"] }) {
  const pathname = usePathname();
  const items = adminNavItems(role);
  return (
    <nav
      aria-label="Menu administration"
      className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden dark:border-white/10 dark:bg-[#0f131b]/95"
    >
      <div className="flex gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = isAdminNavItemActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-navy-700 px-3 py-1.5 text-xs font-semibold text-white"
                  : "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              }
            >
              <span aria-hidden="true" className="text-slate-400 dark:text-slate-300 [&_svg]:h-3.5 [&_svg]:w-3.5">
                <NavGlyph glyph={item.icon} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
