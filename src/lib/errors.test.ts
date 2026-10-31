import { describe, expect, it } from "vitest";

import { AppError, mapError, toUserMessage } from "@/lib/errors";

describe("mapError", () => {
  it("retourne l'AppError inchangée", () => {
    const original = new AppError("conflict", "déjà attribué", 409);
    expect(mapError(original)).toBe(original);
  });

  it("mappe TypeError réseau vers network", () => {
    const result = mapError(new TypeError("fetch failed"));
    expect(result.code).toBe("network");
    expect(result.message).toContain("Impossible de joindre le serveur");
  });

  it("mappe un message réseau quelconque vers network", () => {
    const result = mapError({ message: "Failed to fetch" });
    expect(result.code).toBe("network");
  });

  it("mappe 42501 vers permission (403)", () => {
    const result = mapError({ code: "42501", message: "Accès refusé" });
    expect(result.code).toBe("permission");
    expect(result.status).toBe(403);
    expect(result.message).toBe("Accès refusé");
  });

  it("mappe P0001 vers invalid_state (409)", () => {
    const result = mapError({ code: "P0001", message: "Transition invalide" });
    expect(result.code).toBe("invalid_state");
    expect(result.status).toBe(409);
  });

  it("mappe P0002 vers not_found (404)", () => {
    const result = mapError({ code: "P0002" });
    expect(result.code).toBe("not_found");
    expect(result.status).toBe(404);
    expect(result.message).toBe("Élément introuvable.");
  });

  it("mappe 22023 vers validation (422)", () => {
    expect(mapError({ code: "22023" }).code).toBe("validation");
    expect(mapError({ code: "22023" }).status).toBe(422);
  });

  it("mappe 23514 vers validation (422)", () => {
    expect(mapError({ code: "23514" }).code).toBe("validation");
  });

  it("mappe 23505 vers conflict (409)", () => {
    const result = mapError({ code: "23505", message: "déjà utilisé" });
    expect(result.code).toBe("conflict");
    expect(result.status).toBe(409);
  });

  it("mappe un message jwt vers auth (401)", () => {
    const result = mapError({ message: "JWT expired" });
    expect(result.code).toBe("auth");
    expect(result.status).toBe(401);
  });

  it("mappe PGRST301 vers auth (401)", () => {
    expect(mapError({ code: "PGRST301" }).code).toBe("auth");
  });

  it("mappe un code 5xx vers server (500)", () => {
    const result = mapError({ code: "XX000", status: 500 });
    expect(result.code).toBe("server");
    expect(result.status).toBe(500);
  });

  it("conserve un message inconnu non vide", () => {
    const result = mapError({ message: "boom inattendu" });
    expect(result.code).toBe("unknown");
    expect(result.message).toBe("boom inattendu");
  });

  it("produit un message générique sans information", () => {
    const result = mapError(undefined);
    expect(result.code).toBe("unknown");
    expect(result.message).toBe("Une erreur inattendue s'est produite.");
  });
});

describe("toUserMessage", () => {
  it("retourne le message de l'AppError mappée", () => {
    expect(toUserMessage({ code: "42501" })).toBe(
      "Vous n'êtes pas autorisé à effectuer cette action.",
    );
  });
});
