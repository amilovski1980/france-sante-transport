import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminSuppliersPanel from "@/components/dashboard/AdminSuppliersPanel";
import type { Organization, OrganizationMember, Profile, Supplier } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminSuppliersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/admin/suppliers");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const [{ data: suppliers }, { data: organizations }, { data: profiles }, { data: members }] =
    await Promise.all([
      supabase.from("suppliers").select("*").order("code"),
      supabase.from("organizations").select("*").eq("kind", "supplier").order("name"),
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("organization_members").select("*"),
    ]);

  return (
    <AdminSuppliersPanel
      suppliers={(suppliers ?? []) as Supplier[]}
      organizations={(organizations ?? []) as Organization[]}
      profiles={(profiles ?? []) as Profile[]}
      members={(members ?? []) as OrganizationMember[]}
    />
  );
}
