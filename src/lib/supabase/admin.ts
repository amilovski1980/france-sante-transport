import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase à clé service_role — UNIQUEMENT dans les route handlers
 * côté serveur (jamais importé par du code navigateur : la clé serait
 * embarquée dans le bundle). Contourne les politiques RLS pour les
 * opérations d'administration d'authentification (inviter, bannir…).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Configuration manquante : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis côté serveur.",
    );
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
