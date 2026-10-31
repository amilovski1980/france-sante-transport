"use client";

import type { CSSProperties } from "react";

/** Palette dégradée pour les pastilles d'initiales (choisie selon le nom → stable). */
const GRADIENTS = [
  "from-navy-700 to-navy-900",
  "from-flagred-600 to-flagred-800",
  "from-emerald-600 to-emerald-800",
  "from-blue-600 to-blue-800",
  "from-amber-500 to-amber-700",
  "from-violet-600 to-violet-800",
  "from-rose-600 to-rose-800",
  "from-teal-600 to-teal-800",
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const pick = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  const upper = pick.toUpperCase();
  return upper.length > 0 ? upper : "?";
}

function gradientFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 100000;
  }
  return GRADIENTS[hash % GRADIENTS.length];
}

/**
 * Avatar du chauffeur : photo de profil si `url` est renseignée,
 * sinon pastille colorée aux initiales — affichage professionnel partout
 * (planning chauffeur, agenda, suivi en direct…).
 */
export default function DriverAvatar({
  name,
  url,
  size = 40,
  ring,
}: {
  name: string;
  url?: string | null;
  size?: number;
  ring?: boolean;
}) {
  const style: CSSProperties = { width: size, height: size, fontSize: Math.max(10, Math.round(size / 2.5)) };
  const ringCls = ring ? "ring-2 ring-white/70 dark:ring-white/20" : "";
  const initials = initialsOf(name);

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        style={style}
        className={`shrink-0 rounded-full object-cover shadow-sm ${ringCls}`}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }

  return (
    <span
      style={style}
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-semibold text-white shadow-sm ${gradientFor(name)} ${ringCls}`}
    >
      {initials}
    </span>
  );
}
