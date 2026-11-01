import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminDeliveriesPanel from "@/components/dashboard/AdminDeliveriesPanel";
import type {
  Delivery,
  DeliveryItem,
  DeliverySchedule,
  DriverAssignment,
  Lot,
  Product,
  ProductReference,
  Profile,
  Recipient,
  Shipment,
  Vehicle,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminDeliveriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/admin/deliveries");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin" && me?.role !== "dispatcher") redirect("/dashboard");

  const [
    { data: deliveries },
    { data: items },
    { data: schedules },
    { data: recipients },
    { data: lots },
    { data: references },
    { data: products },
    { data: drivers },
    { data: vehicles },
    { data: assignments },
    { data: shipments },
  ] = await Promise.all([
    supabase.from("deliveries").select("*").order("scheduled_at", { ascending: true, nullsFirst: false }),
    supabase.from("delivery_items").select("*"),
    supabase.from("delivery_schedules").select("*"),
    supabase.from("recipients").select("*").order("name"),
    supabase.from("lots").select("*"),
    supabase.from("product_references").select("*"),
    supabase.from("products").select("*"),
    supabase.from("profiles").select("*").eq("role", "driver").order("full_name"),
    supabase.from("vehicles").select("*").eq("active", true).order("registration_plate"),
    supabase.from("driver_assignments").select("*"),
    supabase.from("shipments").select("*"),
  ]);

  return (
    <AdminDeliveriesPanel
      deliveries={(deliveries ?? []) as Delivery[]}
      items={(items ?? []) as DeliveryItem[]}
      schedules={(schedules ?? []) as DeliverySchedule[]}
      recipients={(recipients ?? []) as Recipient[]}
      lots={(lots ?? []) as Lot[]}
      references={(references ?? []) as ProductReference[]}
      products={(products ?? []) as Product[]}
      drivers={(drivers ?? []) as Profile[]}
      vehicles={(vehicles ?? []) as Vehicle[]}
      assignments={(assignments ?? []) as DriverAssignment[]}
      shipments={(shipments ?? []) as Shipment[]}
    />
  );
}
