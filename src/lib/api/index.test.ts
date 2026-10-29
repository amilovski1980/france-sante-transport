import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors";

const rpc = vi.fn();
const fromTable = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc, from: fromTable }),
}));

type Thenable = { then: (onFulfilled: (v: unknown) => unknown, onRejected: (e: unknown) => unknown) => Promise<unknown> };

function thenable<T>(result: { data: T | null; error: unknown }): Thenable {
  return {
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  };
}

function tableChain<T>(result: { data: T | null; error: unknown }): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  for (const method of ["insert", "select", "order", "eq", "update"]) {
    chain[method] = () => chain;
  }
  chain.single = () => thenable(result);
  chain.then = thenable(result).then;
  return chain;
}

beforeEach(() => {
  rpc.mockReset();
  fromTable.mockReset();
});

describe("call() — succès", () => {
  it("retourne les données quand il n'y a pas d'erreur", async () => {
    fromTable.mockReturnValue(tableChain({ data: [{ id: "1" }], error: null }));
    const { listMyRequests } = await import("@/lib/api");
    await expect(listMyRequests()).resolves.toEqual([{ id: "1" }]);
    expect(fromTable).toHaveBeenCalledWith("transport_requests");
  });

  it("résout un rpc avec les données retournées", async () => {
    rpc.mockReturnValue(thenable({ data: { id: "q1", status: "sent" }, error: null }));
    const { adminSendQuote } = await import("@/lib/api");
    await expect(adminSendQuote("q1")).resolves.toEqual({ id: "q1", status: "sent" });
    expect(rpc).toHaveBeenCalledWith("send_quote", { p_quote_id: "q1" });
  });
});

describe("call() — erreurs mappées", () => {
  it("transforme une erreur Postgres en AppError", async () => {
    rpc.mockReturnValue(
      thenable({ data: null, error: { code: "P0001", message: "Seul un devis en brouillon" } }),
    );
    const { adminSendQuote } = await import("@/lib/api");
    const error = await adminSendQuote("q1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("invalid_state");
    expect((error as AppError).message).toBe("Seul un devis en brouillon");
  });

  it("transforme un refus d'autorisation en AppError permission", async () => {
    rpc.mockReturnValue(
      thenable({ data: null, error: { code: "42501", message: "Accès réservé" } }),
    );
    const { adminConfirmShipment } = await import("@/lib/api");
    const error = await adminConfirmShipment("s1").catch((e: unknown) => e);
    expect((error as AppError).code).toBe("permission");
    expect((error as AppError).status).toBe(403);
  });

  it("transforme une rupture réseau en AppError network", async () => {
    rpc.mockImplementation(() => Promise.reject(new TypeError("fetch failed")));
    const { acceptQuote } = await import("@/lib/api");
    const error = await acceptQuote("q1").catch((e: unknown) => e);
    expect((error as AppError).code).toBe("network");
  });

  it("signale un serveur qui ne renvoie aucune donnée", async () => {
    fromTable.mockReturnValue(tableChain({ data: null, error: null }));
    const { listVehicles } = await import("@/lib/api");
    const error = await listVehicles().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("server");
    expect((error as AppError).message).toBe("Le serveur n'a renvoyé aucune donnée.");
  });
});

describe("sendContactMessage", () => {
  it("insère le message via la table contact_messages", async () => {
    fromTable.mockReturnValue(tableChain({ data: { id: "c1" }, error: null }));
    const { sendContactMessage } = await import("@/lib/api");
    const input = {
      topic: "contact" as const,
      full_name: "Marie Dupont",
      email: "marie@example.fr",
      subject: "Demande d'information",
      message: "Bonjour, je souhaite en savoir plus.",
    };
    await expect(sendContactMessage(input)).resolves.toEqual({ id: "c1" });
    expect(fromTable).toHaveBeenCalledWith("contact_messages");
  });
});

describe("respondToAssignment", () => {
  it("transmet la réponse du chauffeur au rpc", async () => {
    rpc.mockReturnValue(thenable({ data: { id: "a1", status: "accepted" }, error: null }));
    const { respondToAssignment } = await import("@/lib/api");
    await expect(respondToAssignment("a1", true)).resolves.toEqual({ id: "a1", status: "accepted" });
    expect(rpc).toHaveBeenCalledWith("respond_driver_assignment", {
      p_assignment_id: "a1",
      p_accept: true,
    });
  });
});

describe("cancelMyRequest", () => {
  it("transmet la raison d'annulation au rpc", async () => {
    rpc.mockReturnValue(thenable({ data: { id: "r1", status: "cancelled" }, error: null }));
    const { cancelMyRequest } = await import("@/lib/api");
    await cancelMyRequest("r1", "Annulation demandée par le client");
    expect(rpc).toHaveBeenCalledWith("cancel_transport_request", {
      p_request_id: "r1",
      p_reason: "Annulation demandée par le client",
    });
  });
});
