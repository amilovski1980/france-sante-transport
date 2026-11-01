import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { sendWebPush } from "@/lib/webpush/send";
import type { EmailContent } from "@/lib/email/templates";

export interface NotificationAudience {
  id: string;
  email: string;
  full_name: string | null;
}

export interface NotifyPayload {
  type: string;
  title: string;
  body: string;
  url: string;
  tag: string;
  data?: Record<string, unknown>;
}

interface NotifyOptions {
  /** Contenu e-mail optionnel, personnalisé par destinataire. */
  email?: (user: NotificationAudience) => EmailContent;
}

const MISSING_TABLE = "42P01";

/**
 * Notifie une liste d'utilisateurs : enregistre la notification in-app,
 * pousse une notification Web Push et, si fourni, envoie un e-mail.
 * Ne lève jamais : une notification ne doit pas casser le flux métier.
 */
export async function notifyUsers(
  audience: NotificationAudience[],
  payload: NotifyPayload,
  options?: NotifyOptions,
): Promise<{ notified: number; emailed: number }> {
  if (audience.length === 0) return { notified: 0, emailed: 0 };

  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    admin = createAdminClient();
  } catch (err) {
    console.warn("[notifications] client admin indisponible :", err);
  }

  if (admin) {
    const rows = audience.map((user) => ({
      user_id: user.id,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      url: payload.url,
      tag: payload.tag,
      data: payload.data ?? {},
    }));
    const { error } = await admin
      .from("notifications")
      .upsert(rows, { onConflict: "user_id,tag", ignoreDuplicates: true });
    if (error && error.code !== MISSING_TABLE) {
      console.error("[notifications] insertion impossible :", error.message);
    }
  }

  await Promise.all(
    audience.map((user) =>
      sendWebPush(user.id, {
        title: payload.title,
        body: payload.body,
        url: payload.url,
        tag: payload.tag,
      }),
    ),
  );

  let emailed = 0;
  if (options?.email) {
    await Promise.all(
      audience.map(async (user) => {
        const content = options.email?.(user);
        if (!content) return;
        const result = await sendEmail({ to: user.email, content });
        if (result.ok) emailed += 1;
      }),
    );
  }

  return { notified: audience.length, emailed };
}

export async function listAudienceByRoles(roles: string[]): Promise<NotificationAudience[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("id, email, full_name")
      .in("role", roles);
    return (data ?? []) as NotificationAudience[];
  } catch (err) {
    console.warn("[notifications] listAudienceByRoles :", err);
    return [];
  }
}

export async function getAudience(userId: string | null | undefined): Promise<NotificationAudience | null> {
  if (!userId) return null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", userId)
      .single();
    return (data as NotificationAudience | null) ?? null;
  } catch {
    return null;
  }
}

export async function getDriverAudience(shipmentId: string): Promise<NotificationAudience | null> {
  try {
    const admin = createAdminClient();
    const { data: assignment } = await admin
      .from("driver_assignments")
      .select("driver_id")
      .eq("shipment_id", shipmentId)
      .in("status", ["proposed", "accepted"])
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return getAudience((assignment as { driver_id?: string } | null)?.driver_id);
  } catch {
    return null;
  }
}
