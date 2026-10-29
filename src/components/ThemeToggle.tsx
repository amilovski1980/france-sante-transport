"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <button type="button" onClick={toggle} className="rounded-full border border-navy-200 px-3 py-1.5 text-xs font-semibold text-navy-700 transition hover:bg-navy-50 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/10">
      {dark ? "Sombre" : "Clair"}
    </button>
  );
}
