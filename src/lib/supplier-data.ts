import type { createClient } from "@/lib/supabase/server";
import type {
  Delivery,
  DeliveryItem,
  DeliveryProof,
  DeliverySchedule,
  DeliveryScheduleLine,
  Lot,
  PreparationOrder,
  PreparationOrderLine,
  Product,
  ProductReference,
  PurchaseInvoice,
  PurchaseInvoiceLine,
  Recipient,
  StockLevel,
  StockMovement,
  Supplier,
  Warehouse,
} from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Contexte fournisseur : le fournisseur actif de l'utilisateur et les
 * entrepôts visibles. RLS garantit l'isolation par organisation.
 */
export async function getSupplierContext(supabase: Supabase) {
  const [{ data: suppliers }, { data: warehouses }] = await Promise.all([
    supabase.from("suppliers").select("*").eq("active", true).order("code"),
    supabase.from("warehouses").select("*").eq("active", true).order("name"),
  ]);

  const supplierList = (suppliers ?? []) as Supplier[];
  return {
    suppliers: supplierList,
    supplier: supplierList[0] ?? null,
    warehouses: (warehouses ?? []) as Warehouse[],
  };
}

/**
 * Charge l'espace fournisseur complet (RLS filtrée côté serveur).
 */
export async function loadSupplierWorkspace(supabase: Supabase) {
  const context = await getSupplierContext(supabase);

  const [
    { data: products },
    { data: references },
    { data: lots },
    { data: stockLevels },
    { data: movements },
    { data: recipients },
    { data: schedules },
    { data: scheduleLines },
    { data: deliveries },
    { data: deliveryItems },
    { data: proofs },
    { data: invoices },
    { data: invoiceLines },
    { data: preparationOrders },
    { data: preparationLines },
  ] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase.from("product_references").select("*").order("reference_code"),
    supabase.from("lots").select("*").order("expiry_date", { ascending: true, nullsFirst: false }),
    supabase.from("stock_levels").select("*"),
    supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("recipients").select("*").order("name"),
    supabase.from("delivery_schedules").select("*").order("requested_date", { ascending: false }),
    supabase.from("delivery_schedule_lines").select("*"),
    supabase.from("deliveries").select("*").order("scheduled_at", { ascending: true, nullsFirst: false }),
    supabase.from("delivery_items").select("*"),
    supabase.from("delivery_proofs").select("*").order("created_at", { ascending: false }),
    supabase.from("purchase_invoices").select("*").order("created_at", { ascending: false }),
    supabase.from("purchase_invoice_lines").select("*").order("created_at", { ascending: true }),
    supabase.from("preparation_orders").select("*").order("created_at", { ascending: false }),
    supabase.from("preparation_order_lines").select("*"),
  ]);

  return {
    ...context,
    products: (products ?? []) as Product[],
    references: (references ?? []) as ProductReference[],
    lots: (lots ?? []) as Lot[],
    stockLevels: (stockLevels ?? []) as StockLevel[],
    movements: (movements ?? []) as StockMovement[],
    recipients: (recipients ?? []) as Recipient[],
    schedules: (schedules ?? []) as DeliverySchedule[],
    scheduleLines: (scheduleLines ?? []) as DeliveryScheduleLine[],
    deliveries: (deliveries ?? []) as Delivery[],
    deliveryItems: (deliveryItems ?? []) as DeliveryItem[],
    proofs: (proofs ?? []) as DeliveryProof[],
    invoices: (invoices ?? []) as PurchaseInvoice[],
    invoiceLines: (invoiceLines ?? []) as PurchaseInvoiceLine[],
    preparationOrders: (preparationOrders ?? []) as PreparationOrder[],
    preparationLines: (preparationLines ?? []) as PreparationOrderLine[],
  };
}

export type SupplierWorkspace = Awaited<ReturnType<typeof loadSupplierWorkspace>>;
