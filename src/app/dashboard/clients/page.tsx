import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CrmPanel from "@/components/dashboard/CrmPanel";
import type { Profile, Quote, TransportRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/clients");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin" && me?.role !== "dispatcher") redirect("/dashboard/requests");

  const [{ data: clients }, { data: requests }, { data: quotes }, { data: emailLog }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, phone, avatar_url, address, created_at")
      .in("role", ["client", "partner"])
      .order("full_name"),
    supabase
      .from("transport_requests")
      .select("id, client_id, status, pickup_address, dropoff_address, created_at"),
    supabase.from("quotes").select("id, status, amount, transport_request_id"),
    supabase.from("email_log").select("id, recipient_id, subject, status, created_at").order("created_at", { ascending: false }).limit(200),
  ]);

  return (
    <CrmPanel
      clients={(clients ?? []) as unknown as Pick<Profile, "id" | "full_name" | "email" | "role" | "phone" | "avatar_url" | "address" | "created_at">[]}
      requests={(requests ?? []) as unknown as Pick<TransportRequest, "id" | "client_id" | "status" | "pickup_address" | "dropoff_address" | "created_at">[]}
      quotes={(quotes ?? []) as unknown as Pick<Quote, "id" | "status" | "amount" | "transport_request_id">[]}
      emailLog={(emailLog ?? []) as unknown as Pick<import("@/lib/types").EmailLog, "id" | "recipient_id" | "subject" | "status" | "created_at">[]}
    />
  );
}
