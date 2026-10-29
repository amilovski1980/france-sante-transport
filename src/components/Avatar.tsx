"use client";

/**
 * Avatar rond professionnel : affiche la photo si disponible, sinon les
 * initiales sur un fond degrade deterministe a partir du nom.
 */

const SIZES = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-lg",
} as const;

export type AvatarSize = keyof typeof SIZES;

function initials(name: string | null | undefined, email?: string | null): string {
  const base = (name && name.trim()) || email || "?";
  const parts = base.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function hashHue(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) % 360;
  }
  return h;
}

export default function Avatar({
  name,
  email,
  src,
  size = "md",
  className = "",
}: {
  name?: string | null;
  email?: string | null;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  const label = initials(name, email);
  const hue = hashHue((name || email || "x").toLowerCase());
  const ring = className ? "" : "ring-2 ring-white";

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name || email || "avatar"}
        suppressHydrationWarning
        className={`${SIZES[size]} shrink-0 rounded-full object-cover shadow-sm ${ring} ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${SIZES[size]} inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm ${ring} ${className}`}
      style={{ backgroundImage: `linear-gradient(135deg, hsl(${hue} 55% 45%), hsl(${(hue + 40) % 360} 60% 38%))` }}
    >
      {label}
    </span>
  );
}
