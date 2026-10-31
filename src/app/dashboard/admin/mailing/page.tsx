import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MailingPanel from "@/components/dashboard/MailingPanel";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MailingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/admin/mailing");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin" && me?.role !== "dispatcher") redirect("/dashboard/requests");

  const { data: recipients } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, avatar_url")
    .in("role", ["client", "partner", "driver", "dispatcher"])
    .neq("id", user.id)
    .order("role")
    .order("full_name");

  return <MailingPanel recipients={(recipients ?? []) as Pick<Profile, "id" | "full_name" | "email" | "role" | "avatar_url">[]} />;
}
