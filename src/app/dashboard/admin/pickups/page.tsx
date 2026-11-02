import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminPickupsPanel from "@/components/dashboard/AdminPickupsPanel";
import type {
  Lot,
  PickupOrder,
  PickupOrderLine,
  Product,
  ProductReference,
  Recipient,
  Supplier,
  Warehouse,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPickupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/admin/pickups");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin" && me?.role !== "dispatcher") redirect("/dashboard");

  const [
    { data: orders },
    { data: lines },
    { data: suppliers },
    { data: warehouses },
    { data: recipients },
    { data: lots },
    { data: references },
    { data: products },
  ] = await Promise.all([
    supabase.from("pickup_orders").select("*").order("requested_pickup_date", { ascending: false }),
    supabase.from("pickup_order_lines").select("*"),
    supabase.from("suppliers").select("*").order("code"),
    supabase.from("warehouses").select("*").order("name"),
    supabase.from("recipients").select("*").order("name"),
    supabase.from("lots").select("*"),
    supabase.from("product_references").select("*"),
    supabase.from("products").select("*"),
  ]);

  return (
    <AdminPickupsPanel
      orders={(orders ?? []) as PickupOrder[]}
      lines={(lines ?? []) as PickupOrderLine[]}
      suppliers={(suppliers ?? []) as Supplier[]}
      warehouses={(warehouses ?? []) as Warehouse[]}
      recipients={(recipients ?? []) as Recipient[]}
      lots={(lots ?? []) as Lot[]}
      references={(references ?? []) as ProductReference[]}
      products={(products ?? []) as Product[]}
    />
  );
}
