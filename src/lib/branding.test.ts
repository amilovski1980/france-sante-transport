import { describe, expect, it } from "vitest";

import { DEFAULT_BRANDING, resolveBranding, sanitizeCustomCss } from "@/lib/branding";

describe("sanitizeCustomCss", () => {
  it("retourne une chaîne vide pour une entrée nulle", () => {
    expect(sanitizeCustomCss(null)).toBe("");
    expect(sanitizeCustomCss(undefined)).toBe("");
    expect(sanitizeCustomCss("")).toBe("");
  });

  it("conserve le CSS valide", () => {
    expect(sanitizeCustomCss(":root { --x: 1; }")).toBe(":root { --x: 1; }");
  });

  it("supprime les fermetures de balise style", () => {
    expect(sanitizeCustomCss("a{}</style><script>alert(1)</script>")).not.toContain("</style");
    expect(sanitizeCustomCss("a{}</STYLE>")).not.toMatch(/<\/style/i);
  });

  it("supprime les commentaires HTML ouvrants", () => {
    expect(sanitizeCustomCss("<!-- x")).not.toContain("<!--");
  });

  it("borne la longueur", () => {
    const long = "a".repeat(20000);
    expect(sanitizeCustomCss(long).length).toBeLessThanOrEqual(10000);
  });
});

describe("resolveBranding", () => {
  it("retourne les valeurs par défaut sans réglages", () => {
    expect(resolveBranding(null)).toEqual(DEFAULT_BRANDING);
    expect(resolveBranding(undefined)).toEqual(DEFAULT_BRANDING);
  });

  it("nettoie et remplit les valeurs manquantes", () => {
    const result = resolveBranding({ logo_url: "  https://x.fr/l.png  ", slogan: null });
    expect(result.logo_url).toBe("https://x.fr/l.png");
    expect(result.slogan).toBe(DEFAULT_BRANDING.slogan);
    expect(result.custom_css).toBeNull();
  });

  it("assainit le CSS au résolution", () => {
    const result = resolveBranding({ custom_css: "body{}</style>" });
    expect(result.custom_css).not.toContain("</style");
  });
});
