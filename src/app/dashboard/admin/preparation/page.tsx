import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminPreparationPanel from "@/components/dashboard/AdminPreparationPanel";
import type {
  DeliverySchedule,
  DeliveryScheduleLine,
  Lot,
  PreparationOrder,
  PreparationOrderLine,
  Product,
  ProductReference,
  Recipient,
  Warehouse,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPreparationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/admin/preparation");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin" && me?.role !== "dispatcher") redirect("/dashboard");

  const [
    { data: orders },
    { data: orderLines },
    { data: schedules },
    { data: scheduleLines },
    { data: warehouses },
    { data: recipients },
    { data: lots },
    { data: references },
    { data: products },
  ] = await Promise.all([
    supabase.from("preparation_orders").select("*").order("created_at", { ascending: false }),
    supabase.from("preparation_order_lines").select("*"),
    supabase.from("delivery_schedules").select("*").order("requested_date", { ascending: false }),
    supabase.from("delivery_schedule_lines").select("*"),
    supabase.from("warehouses").select("*").order("name"),
    supabase.from("recipients").select("*").order("name"),
    supabase.from("lots").select("*"),
    supabase.from("product_references").select("*"),
    supabase.from("products").select("*"),
  ]);

  return (
    <AdminPreparationPanel
      orders={(orders ?? []) as PreparationOrder[]}
      orderLines={(orderLines ?? []) as PreparationOrderLine[]}
      schedules={(schedules ?? []) as DeliverySchedule[]}
      scheduleLines={(scheduleLines ?? []) as DeliveryScheduleLine[]}
      warehouses={(warehouses ?? []) as Warehouse[]}
      recipients={(recipients ?? []) as Recipient[]}
      lots={(lots ?? []) as Lot[]}
      references={(references ?? []) as ProductReference[]}
      products={(products ?? []) as Product[]}
    />
  );
}
