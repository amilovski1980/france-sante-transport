import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface PushSubscriptionJson {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

/** PUT /api/push/subscribe — enregistre (ou met à jour) l'abonnement de cet appareil. */
export async function PUT(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentification requise" }, { status: 401 });

  let body: PushSubscriptionJson;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corps JSON invalide" }, { status: 400 });
  }
  const endpoint = body.endpoint;
  const p256dh = body.keys?.p256dh;
  const auth = body.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: false, error: "Abonnement incomplet" }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: user.id, endpoint, p256dh, auth, user_agent: userAgent },
      { onConflict: "endpoint" },
    );
  if (error) {
    return NextResponse.json({ ok: false, error: "Enregistrement impossible : " + error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** DELETE /api/push/subscribe — désactive cet appareil. */
export async function DELETE(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Authentification requise" }, { status: 401 });

  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corps JSON invalide" }, { status: 400 });
  }
  if (!body.endpoint) return NextResponse.json({ ok: false, error: "Endpoint requis" }, { status: 400 });

  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", body.endpoint);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
