"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { createTransportRequest } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import { useI18n } from "@/components/I18nProvider";
import type { ServiceType } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-navy-200 bg-white px-4 py-3 text-sm text-navy-900 placeholder:text-navy-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100";

export default function RequestForm() {
  const { t, labels } = useI18n();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string } | null>(null);

  const [serviceType, setServiceType] = useState<ServiceType>("medical_transport");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupDatetime, setPickupDatetime] = useState("");
  const [patientName, setPatientName] = useState("");
  const [mobilityNotes, setMobilityNotes] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      setReady(true);
    });
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const request = await createTransportRequest({
        service_type: serviceType,
        pickup_address: pickup.trim(),
        dropoff_address: dropoff.trim(),
        pickup_datetime: new Date(pickupDatetime).toISOString(),
        patient_name: patientName.trim() || undefined,
        mobility_notes: mobilityNotes.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setCreated({ id: request.id });
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (!ready) {
    return <div className="surface h-96 animate-pulse" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <div className="surface p-8 text-center">
        <h2 className="font-display text-2xl font-semibold text-navy-900">
          {t("qform.needTitle")}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-navy-700/80">
          {t("qform.needBody")}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/login?redirect=/devis"
            className="rounded-full bg-navy-800 px-7 py-3 text-sm font-semibold text-white hover:bg-navy-700"
          >
            {t("cta.signin")}
          </Link>
          <Link
            href="/signup?redirect=/devis"
            className="rounded-full border border-navy-200 px-7 py-3 text-sm font-semibold text-navy-800 hover:bg-navy-50"
          >
            {t("login.createAccount")}
          </Link>
        </div>
      </div>
    );
  }

  if (created) {
    return (
      <div className="surface p-8 text-center">
        <span
          aria-hidden="true"
          className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-2xl text-emerald-700"
        >
          ✓
        </span>
        <h2 className="mt-5 font-display text-2xl font-semibold text-navy-900">
          {t("qform.createdTitle")}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-navy-700/80">
          {t("qform.createdBody")}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="rounded-full bg-navy-800 px-7 py-3 text-sm font-semibold text-white hover:bg-navy-700"
          >
            {t("qform.followCta")}
          </Link>
          <button
            type="button"
            onClick={() => setCreated(null)}
            className="rounded-full border border-navy-200 px-7 py-3 text-sm font-semibold text-navy-800 hover:bg-navy-50"
          >
            {t("qform.newRequest")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="surface space-y-6 p-7 sm:p-8">
      <div>
        <label htmlFor="req-service" className="mb-1.5 block text-sm font-semibold text-navy-800">
          {t("qform.serviceLabel")}
        </label>
        <select
          id="req-service"
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value as ServiceType)}
          className={inputClass}
        >
          {(Object.keys(labels.service) as ServiceType[]).map((key) => (
            <option key={key} value={key}>
              {labels.service[key]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="req-pickup" className="mb-1.5 block text-sm font-semibold text-navy-800">
            {t("qform.pickup")}
          </label>
          <input
            id="req-pickup"
            required
            minLength={3}
            maxLength={500}
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
            placeholder={t("qform.pickupPh")}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="req-dropoff" className="mb-1.5 block text-sm font-semibold text-navy-800">
            {t("qform.dropoff")}
          </label>
          <input
            id="req-dropoff"
            required
            minLength={3}
            maxLength={500}
            value={dropoff}
            onChange={(e) => setDropoff(e.target.value)}
            placeholder={t("qform.dropoffPh")}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="req-datetime" className="mb-1.5 block text-sm font-semibold text-navy-800">
            {t("qform.datetime")}
          </label>
          <input
            id="req-datetime"
            type="datetime-local"
            required
            value={pickupDatetime}
            onChange={(e) => setPickupDatetime(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="req-phone" className="mb-1.5 block text-sm font-semibold text-navy-800">
            {t("qform.contactPhone")}
          </label>
          <input
            id="req-phone"
            type="tel"
            maxLength={30}
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="06 00 00 00 00"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="req-patient" className="mb-1.5 block text-sm font-semibold text-navy-800">
            {t("qform.patient")}
          </label>
          <input
            id="req-patient"
            maxLength={200}
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder={t("qform.patientPh")}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="req-mobility" className="mb-1.5 block text-sm font-semibold text-navy-800">
            {t("qform.mobility")}
          </label>
          <input
            id="req-mobility"
            maxLength={500}
            value={mobilityNotes}
            onChange={(e) => setMobilityNotes(e.target.value)}
            placeholder={t("qform.mobilityPh")}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="req-notes" className="mb-1.5 block text-sm font-semibold text-navy-800">
          {t("qform.notes")}
        </label>
        <textarea
          id="req-notes"
          rows={4}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("qform.notesPh")}
          className={inputClass}
        />
      </div>

      <p className="rounded-lg bg-navy-50 px-4 py-3 text-xs leading-relaxed text-navy-700">
        {t("qform.priceNote")}
      </p>

      {error && (
        <p role="alert" className="rounded-lg border border-flagred-600/30 bg-flagred-50 px-4 py-3 text-sm font-medium text-flagred-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-flagred-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-flagred-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {pending ? t("qform.submitting") : t("qform.submit")}
      </button>
    </form>
  );
}
