import crypto from "node:crypto";
import { loadAppSettings } from "@/lib/app-settings";

/**
 * Intégration DocuSign (JWT impersonation) — sans SDK.
 * Réglages depuis Services & API (app_settings) avec repli sur les env :
 * DOCSIGN_ACCOUNT_ID / DOCSIGN_INTEGRATION_KEY / DOCSIGN_USER_ID /
 * DOCSIGN_PRIVATE_KEY (PEM) / DOCSIGN_ENVIRONMENT (demo|production).
 */

export type DocusignConfig = {
  accountId: string;
  integrationKey: string;
  userId: string;
  privateKey: string;
  environment: "demo" | "production";
};

export class DocusignError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function isConfigured(cfg: DocusignConfig | null): boolean {
  return !!cfg;
}

function pick(value: string | null | undefined, envKey: string): string | null {
  const clean = (value ?? "").trim();
  if (clean) return clean;
  const fromEnv = (process.env[envKey] ?? "").trim();
  return fromEnv || null;
}

export async function loadDocusignConfig(): Promise<DocusignConfig | null> {
  const s = await loadAppSettings();
  const accountId = pick(s.docusign_account_id, "DOCSIGN_ACCOUNT_ID");
  const integrationKey = pick(s.docusign_integration_key, "DOCSIGN_INTEGRATION_KEY");
  const userId = pick(s.docusign_user_id, "DOCSIGN_USER_ID");
  const privateKey = pick(s.docusign_private_key, "DOCSIGN_PRIVATE_KEY");
  const environment = (s.docusign_environment === "production" ? "production" : "demo") as "demo" | "production";
  if (!accountId || !integrationKey || !userId || !privateKey) return null;
  // Tolère les clés PEM stockées avec \n littéraux (formulaire admin)
  const normalizedKey = privateKey.includes("\\n")
    ? privateKey.replace(/\\n/g, "\n")
    : privateKey;
  return { accountId, integrationKey, userId, privateKey: normalizedKey, environment };
}

function accountBaseUrl(cfg: DocusignConfig): string {
  return cfg.environment === "production"
    ? "https://account.docusign.com"
    : "https://account-d.docusign.com";
}

function apiBaseUrl(cfg: DocusignConfig): string {
  return cfg.environment === "production"
    ? "https://na3.docusign.net"
    : "https://demo.docusign.net";
}

/** Fabrique le JWT (RS256) et le stock d'échange contre un access token. */
async function getAccessToken(cfg: DocusignConfig): Promise<string> {
  const header = { typ: "JWT", alg: "RS256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: cfg.integrationKey,
    sub: cfg.userId,
    aud: cfg.accountId,
    iat: now,
    exp: now + 600,
    scope: "signature impersonation",
  };
  const encode = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${encode(header)}.${encode(payload)}`;
  let signed: string;
  try {
    signed = crypto.createSign("RSA-SHA256").update(unsigned).sign(cfg.privateKey, "base64url");
  } catch {
    throw new DocusignError(
      "bad_private_key",
      "Clé privée DocuSign invalide (copiez le PEM complet entre -----BEGIN… et -----END…).",
    );
  }
  const assertJwt = `${unsigned}.${signed}`;

  const res = await fetch(`${accountBaseUrl(cfg)}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: assertJwt,
    }).toString(),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    if (body.error === "consent_required" || body.error === "invalid_grant") {
      throw new DocusignError(
        "consent_required",
        "Consentement d'impersonation manquant : ouvrez l'URL de consentement de votre compte DocuSign une fois (Admin → Apps → consent), ou collez l'URL consent dans le navigateur avec ?client_id=<integrationKey>&redirect_uri=ligne. Voir documentation.",
      );
    }
    throw new DocusignError("auth", `Authentification DocuSign impossible : ${body.error_description ?? body.error ?? res.status}`);
  }
  return body.access_token;
}

async function apiFetch<T>(
  cfg: DocusignConfig,
  path: string,
  init?: RequestInit & { raw?: true },
): Promise<{ status: number; data: T | Blob | null }>;

async function apiFetch<T>(cfg: DocusignConfig, path: string, init?: RequestInit): Promise<{ status: number; data: T | null }>;

async function apiFetch<T>(
  cfg: DocusignConfig,
  path: string,
  init?: RequestInit & { raw?: true },
): Promise<{ status: number; data: T | Blob | null }> {
  const token = await getAccessToken(cfg);
  const res = await fetch(`${apiBaseUrl(cfg)}/restapi/v2.1/accounts/${cfg.accountId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: init?.raw ? "application/pdf" : "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (init?.raw) {
    const blob = await res.blob();
    return { status: res.status, data: blob };
  }
  const json = (await res.json().catch(() => null)) as T | null;
  return { status: res.status, data: json };
}

/**
 * Crée une enveloppe « envoyée » avec un signataire intégré (signature
 * dans le navigateur), ancrée automatiquement sur le libellé
 * « Signature du client : » du PDF.
 */
export async function createQuoteEnvelope(
  cfg: DocusignConfig,
  input: {
    pdfBase64: string;
    signerEmail: string;
    signerName: string;
    documentName: string;
    emailSubject: string;
    emailBlurb: string;
  },
): Promise<{ envelopeId: string }> {
  const { status, data } = await apiFetch<Record<string, unknown>>(cfg, "/envelopes", {
    method: "POST",
    body: JSON.stringify({
      emailSubject: input.emailSubject,
      emailBlurb: input.emailBlurb,
      status: "sent",
      documents: [{ documentBase64: input.pdfBase64, name: input.documentName, fileExtension: "pdf", documentId: "1" }],
      recipients: {
        signers: [
          {
            email: input.signerEmail,
            name: input.signerName,
            recipientId: "1",
            clientUserId: input.signerEmail, // signataire intégré (signature dans le navigateur)
            routingOrder: "1",
            tabs: {
              signHereTabs: [
                {
                  documentId: "1",
                  pageNumber: "1",
                  anchorString: "Signature du client :",
                  anchorXOffset: "0.4",
                  anchorYOffset: "-0.05",
                  width: "120",
                  height: "36",
                  discretionary: false,
                },
              ],
              dateSignedTabs: [
                {
                  documentId: "1",
                  pageNumber: "1",
                  anchorString: "Signature du client :",
                  anchorXOffset: "0.4",
                  anchorYOffset: "0.25",
                  width: "90",
                  height: "14",
                },
              ],
            },
          },
        ],
      },
    }),
  });
  const json = data as { envelopes?: { envelopeId?: string }[]; envelopeId?: string; message?: string; errorCode?: string } | null;
  const envelopeId = json?.envelopeId ?? json?.envelopes?.[0]?.envelopeId;
  if (status !== 201 || !envelopeId) {
    throw new DocusignError(json?.errorCode ?? "envelope_create", json?.message ?? `Création d'enveloppe impossible (HTTP ${status})`);
  }
  return { envelopeId };
}

/** URL de signature intégrée (personne à faire signer dans son navigateur). */
export async function getEmbeddedSigningUrl(
  cfg: DocusignConfig,
  envelopeId: string,
  input: { email: string; name: string; returnUrl: string },
): Promise<{ url: string }> {
  const { status, data } = await apiFetch<Record<string, unknown>>(
    cfg,
    `/envelopes/${envelopeId}/views/recipient`,
    {
      method: "POST",
      body: JSON.stringify({
        authenticationMethod: "none",
        email: input.email,
        userName: input.name,
        recipientId: "1",
        clientUserId: input.email,
        returnUrl: input.returnUrl,
      }),
    },
  );
  const json = data as { url?: string; message?: string; errorCode?: string } | null;
  if (status !== 201 || !json?.url) {
    throw new DocusignError(json?.errorCode ?? "recipient_view", json?.message ?? `URL signature impossible (HTTP ${status})`);
  }
  return { url: json.url };
}

export type EnvelopeStatus = "created" | "sent" | "delivered" | "completed" | "declined" | "voided";

/** Lit le statut d'une enveloppe. */
export async function getEnvelopeStatus(cfg: DocusignConfig, envelopeId: string): Promise<EnvelopeStatus> {
  const { data } = await apiFetch<Record<string, unknown>>(cfg, `/envelopes/${envelopeId}`, { method: "GET" });
  const json = data as { status?: EnvelopeStatus } | null;
  return (json?.status ?? "sent") as EnvelopeStatus;
}

/** Télécharge le document combiné (signé) d'une enveloppe complétée. */
export async function downloadCompletedDocument(cfg: DocusignConfig, envelopeId: string): Promise<Blob> {
  const { status, data } = await apiFetch<Blob>(cfg, `/envelopes/${envelopeId}/documents/combined`, { method: "GET", raw: true });
  if (status !== 200 || !data) {
    throw new DocusignError("download", `Téléchargement du document signé impossible (HTTP ${status})`);
  }
  return data;
}
