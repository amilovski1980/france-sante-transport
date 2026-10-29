import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import UserAdminPanel from "@/components/dashboard/UserAdminPanel";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/users");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard/requests");
  return <UserAdminPanel />;
}
