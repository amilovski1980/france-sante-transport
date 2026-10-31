import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let configuredOnce = false;

function ensureVapid(): boolean {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  if (!configuredOnce) {
    webpush.setVapidDetails(
      "mailto:exploitation@france-sante-transport.fr",
      publicKey,
      privateKey,
    );
    configuredOnce = true;
  }
  return true;
}

/**
 * Pousse une notification Web Push à TOUS les appareils d'un utilisateur.
 * Ne lève jamais : l'échec push ne casse pas le flux métier.
 */
export async function sendWebPush(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!ensureVapid()) return { sent: 0, failed: 0 };
  let subs: Array<{ id: string; endpoint: string; p256dh: string; auth: string }> = [];
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);
    subs = (data ?? []) as typeof subs;
  } catch {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const admin = createAdminClient();
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        sent += 1;
        await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", s.id);
      } catch (err) {
        failed += 1;
        // 404/410 : abonnement expiré côté navigateur → nettoyage
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    }),
  );
  return { sent, failed };
}
