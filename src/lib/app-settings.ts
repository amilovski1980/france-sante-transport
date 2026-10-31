import { createAdminClient } from "@/lib/supabase/admin";

export interface AppSettings {
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_pass: string | null;
  smtp_from: string | null;
  resend_api_key: string | null;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_from: string | null;
  stripe_secret_key: string | null;
  vat_rate: number | null;
  docusign_account_id: string | null;
  docusign_integration_key: string | null;
  docusign_user_id: string | null;
  docusign_private_key: string | null;
  docusign_environment: "demo" | "production";
}

let cache: { value: AppSettings; at: number } | null = null;
const TTL_MS = 30_000;

/** Réglages techniques (singleton) — lecture côté serveur seule (service_role). */
export async function loadAppSettings(): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const supabase = createAdminClient();
  const { data } = await supabase.from("app_settings").select("*").eq("id", 1).single();
  const value: AppSettings = data ?? {
    smtp_host: null,
    smtp_port: null,
    smtp_user: null,
    smtp_pass: null,
    smtp_from: null,
    resend_api_key: null,
    twilio_account_sid: null,
    twilio_auth_token: null,
    twilio_from: null,
    stripe_secret_key: null,
    vat_rate: 0,
    docusign_account_id: null,
    docusign_integration_key: null,
    docusign_user_id: null,
    docusign_private_key: null,
    docusign_environment: "demo",
  };
  cache = { value, at: Date.now() };
  return value;
}

export function invalidateAppSettingsCache(): void {
  cache = null;
}

/** Masque un secret pour l'affichage admin. */
export function maskSecret(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 6) return "••••••";
  return `${value.slice(0, 3)}…${value.slice(-4)}`;
}
