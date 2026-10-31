import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWebPush } from "@/lib/webpush/send";

export const dynamic = "force-dynamic";

/** POST /api/push/test — pousse une notification de test sur mes appareils. */
export async function POST(): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentification requise" }, { status: 401 });

  const vapidReady = Boolean(process.env.WEB_PUSH_VAPID_PUBLIC_KEY && process.env.WEB_PUSH_VAPID_PRIVATE_KEY);
  if (!vapidReady) {
    return NextResponse.json({ ok: false, error: "Clés VAPID absentes côté serveur (.env.local)" }, { status: 503 });
  }

  const result = await sendWebPush(user.id, {
    title: "France Santé Transport 🔔",
    body: "Notifications push activées ! Vous recevrez les alertes ici, même en arrière-plan.",
    url: "/dashboard/notifications",
    tag: "push-test",
  });
  if (result.sent === 0) {
    return NextResponse.json(
      { ok: false, error: "Aucun appareil n'a reçu la notification (réessayez l'activation ou ouvrez l'app)." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, sent: result.sent, failed: result.failed });
}
