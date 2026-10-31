import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QRCode from "qrcode";
import PrintButton from "@/app/dashboard/devis/[id]/PrintButton";
import type { DriverAssignment, Shipment, TransportRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

function fmtDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

/** Étiquette d'expédition imprimable d'une mission (A·B, patient, chauffeur, QR). */
export default async function LabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/dashboard/labels/${id}`);

  const { data: shipment } = await supabase.from("shipments").select("*").eq("id", id).single();
  if (!shipment) notFound();
  const s = shipment as Shipment;

  const [requestByShipment, assignments] = await Promise.all([
    supabase.from("transport_requests").select("*").eq("id", s.transport_request_id).single(),
    supabase.from("driver_assignments").select("*, driver:profiles!driver_assignments_driver_id_fkey(id, full_name, email, phone), vehicle:vehicles(id, registration_plate, label, vehicle_class, capacity, has_wheelchair_lift)").eq("shipment_id", s.id).order("assigned_at", { ascending: false }).limit(1),
  ]);

  const request = requestByShipment.data as TransportRequest | null;
  const assignment = (assignments.data?.[0] ?? null) as Pick<DriverAssignment, "id" | "driver_id" | "vehicle_id" | "status"> & {
    driver: { id: string; full_name: string; email: string; phone: string | null } | null;
    vehicle: { id: string; registration_plate: string; label: string | null; vehicle_class: string; capacity: number; has_wheelchair_lift: boolean } | null;
  } | null;

  const labelRef = `FST-${String(s.id).replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const qrValue = [labelRef, request?.pickup_address ?? "", request?.dropoff_address ?? ""].filter(Boolean).join(" | ");

  // QR (SVG, sans dépendance réseau)
  const qrSvg = await QRCode.toString(qrValue, {
    type: "svg",
    margin: 1,
    width: 180,
    errorCorrectionLevel: "M",
  });

  return (
    <main className="min-h-screen bg-[#e9edf3] py-8 print:bg-white print:py-0">
      <style>{"@media print{ .label *{ -webkit-print-color-adjust: exact; print-color-adjust: exact } }"}</style>
      <div className="mx-auto max-w-[380px] print:max-w-none">
        {/* Barre d'actions (masquée à l'impression) */}
        <div className="mb-5 print:hidden">
          <PrintButton />
        </div>

        {/* Étiquette imprimable */}
        <div
          className="label mx-auto rounded-lg border-2 border-navy-900 bg-white p-5 shadow-lg print:rounded-none print:border-2 print:shadow-none"
          style={{ width: "372px" }}
        >
          {/* En-tête */}
          <div className="flex items-center justify-between gap-2 border-b-2 border-navy-900 pb-3">
            <div>
              <p className="font-display text-base font-bold tracking-wide text-navy-900 leading-none">
                FRANCE SANTÉ TRANSPORT
              </p>
              <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-flagred-600">
                Étiquette d&apos;expédition sanitaire
              </p>
            </div>
            <span className="shrink-0 grid h-10 w-10 place-items-center rounded-lg bg-navy-800 font-display text-sm font-bold text-white">
              FS<span className="text-flagred-600">T</span>
            </span>
          </div>

          {/* Référence + horaire */}
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Référence mission</p>
              <p className="font-mono text-lg font-bold text-navy-900">{labelRef}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Départ prévu</p>
              <p className="text-sm font-bold text-navy-900">{fmtDateTime(s.scheduled_at)}</p>
            </div>
          </div>

          {/* Trajectoire A/B */}
          <div className="mt-3 space-y-2">
            {[
              { tag: "A", label: "Départ", address: request?.pickup_address ?? "—", alt: request?.patient_name ?? "" },
              { tag: "B", label: "Arrivée", address: request?.dropoff_address ?? "—", alt: "" },
            ].map(stop => (
              <div key={stop.tag} className="flex items-start gap-2.5">
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${stop.tag === "A" ? "bg-emerald-600 text-white" : "bg-navy-800 text-white"}`}>
                  {stop.tag}
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{stop.label}</p>
                  <p className="break-words text-[13px] font-semibold leading-snug text-navy-900">{stop.address}</p>
                  {stop.alt && <p className="text-[11px] italic text-slate-600">{stop.tag === "A" ? `Patient : ${stop.alt}` : stop.alt}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* Infos transport */}
          <div className="mt-3 grid grid-cols-2 gap-2 border-y border-slate-200 py-2.5 text-[11px]">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Chauffeur</p>
              <p className="font-semibold text-navy-900">{assignment?.driver?.full_name ?? "Non affecté"}</p>
              {assignment?.driver?.phone && <p className="text-slate-600">☎ {assignment.driver.phone}</p>}
            </div>
            <div>
              <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Véhicule</p>
              <p className="font-mono font-bold text-navy-900">{assignment?.vehicle?.registration_plate ?? "—"}</p>
              {assignment?.vehicle?.label && <p className="text-slate-600">{assignment.vehicle.label}</p>}
            </div>
          </div>

          {/* Service et criticité */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {request?.service_type && (
              <span className="rounded bg-navy-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-navy-700">{request.service_type}</span>
            )}
            {request?.criticality === "critical" && (
              <span className="rounded bg-flagred-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Critique</span>
            )}
            {request?.criticality === "urgent" && (
              <span className="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Urgent</span>
            )}
            {request?.mobility_notes && (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">♿ {request.mobility_notes.slice(0, 42)}</span>
            )}
          </div>

          {/* QR + mentions */}
          <div className="mt-3 flex items-center gap-3 border-t-2 border-navy-900 pt-3">
            <div
              className="shrink-0 [&>svg]:mx-auto [&>svg]:h-24 [&>svg]:w-24 [&>svg]:fill-navy-900"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
              aria-hidden="true"
            />
            <div className="min-w-0 text-[9px] leading-relaxed text-slate-600">
              <p className="font-mono font-bold text-navy-900">{qrValue}</p>
              <p className="mt-1">
                Scannez le QR pour retrouver la mission. Document à coller sur le colis/véhicule. En cas d&apos;urgence : 01 84 79 68 00.
              </p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] text-slate-500 print:hidden">
          Astuce : imprimez 2 exemplaires (un pour le véhicule, un pour le dossier patient).
        </p>
      </div>
    </main>
  );
}
