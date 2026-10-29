export type AppErrorCode =
  | "network"
  | "auth"
  | "permission"
  | "validation"
  | "not_found"
  | "conflict"
  | "invalid_state"
  | "server"
  | "unknown";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status?: number;

  constructor(code: AppErrorCode, message: string, status?: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

const PG_CODE_MAP: Record<string, AppErrorCode> = {
  "42501": "permission",
  P0001: "invalid_state",
  P0002: "not_found",
  "22023": "validation",
  "22001": "validation",
  "22P02": "validation",
  "23505": "conflict",
  "23503": "validation",
  "23514": "validation",
  "PGRST301": "auth",
  PGRST116: "not_found",
};

interface SupabaseErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
}

/**
 * Transforme une erreur brute (réseau, PostgREST, auth) en AppError
 * avec un message exploitable par l'interface.
 */
export function mapError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const err = error as SupabaseErrorLike | undefined;

  if (
    err instanceof TypeError ||
    (err && typeof err.message === "string" && /fetch failed|failed to fetch|networkerror|load failed/i.test(err.message))
  ) {
    return new AppError("network", "Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.");
  }

  const code = err?.code ?? "";
  const message = err?.message ?? "";

  if (code === "401" || code === "403" || /jwt|not authenticated|invalid token/i.test(message)) {
    return new AppError("auth", "Votre session a expiré. Veuillez vous reconnecter.", 401);
  }

  const mapped = PG_CODE_MAP[code];
  if (mapped === "permission") {
    return new AppError("permission", message || "Vous n'êtes pas autorisé à effectuer cette action.", 403);
  }
  if (mapped === "not_found") {
    return new AppError("not_found", message || "Élément introuvable.", 404);
  }
  if (mapped === "conflict") {
    return new AppError("conflict", message || "Conflit : cet élément existe déjà ou est déjà attribué.", 409);
  }
  if (mapped === "invalid_state") {
    return new AppError("invalid_state", message || "Transition de statut non autorisée.", 409);
  }
  if (mapped === "validation") {
    return new AppError("validation", message || "Certaines informations sont invalides.", 422);
  }
  if (mapped === "auth") {
    return new AppError("auth", "Votre session a expiré. Veuillez vous reconnecter.", 401);
  }

  if (code.startsWith("5") || (err && typeof err.status === "number" && err.status >= 500)) {
    return new AppError("server", "Le serveur a rencontré une erreur. Réessayez dans un instant.", 500);
  }

  if (message) {
    return new AppError("unknown", message);
  }

  return new AppError("unknown", "Une erreur inattendue s'est produite.");
}

export function toUserMessage(error: unknown): string {
  return mapError(error).message;
}
