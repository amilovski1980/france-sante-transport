"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppRole } from "@/lib/types";

interface SettingsState {
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_pass: string | null;
  smtp_from: string | null;
  resend_api_key: string | null;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_from: string | null;
  stripe_secret_key: string | null;
  vat_rate: number;
  docusign_account_id: string | null;
  docusign_integration_key: string | null;
  docusign_user_id: string | null;
  docusign_private_key: string | null;
  docusign_environment: "demo" | "production";
  configured: { email: boolean; sms: boolean; stripe: boolean; docusign: boolean };
}

const EMPTY: SettingsState = {
  smtp_host: null,
  smtp_port: null,
  smtp_user: null,
  smtp_pass: null,
  smtp_from: null,
  resend_api_key: null,
  twilio_account_sid: null,
  twilio_auth_token: null,
  twilio_from: null,
  stripe_secret_key: null,
  vat_rate: 0,
  docusign_account_id: null,
  docusign_integration_key: null,
  docusign_user_id: null,
  docusign_private_key: null,
  docusign_environment: "demo",
  configured: { email: false, sms: false, stripe: false, docusign: false },
};

/* Les secrets masqués ne se réaffichent pas : champe laissé vide = inchangé. */
const SECRET_FIELDS = ["smtp_pass", "resend_api_key", "twilio_account_sid", "twilio_auth_token", "stripe_secret_key", "docusign_integration_key", "docusign_private_key"];

export default function AdminServicesPanel({ role }: { role: AppRole }) {
  const [state, setState] = useState<SettingsState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/settings", { cache: "no-store" });
    const data = await res.json();
    if (data.ok) {
      setState({ ...EMPTY, ...data.settings, configured: data.settings.configured });
      setForm({});
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const payload: Record<string, string> = {};
    for (const [k, v] of Object.entries(form)) {
      // Pour les secrets masqués : une chaîne vide signifie « inchangé ».
      if (SECRET_FIELDS.includes(k) && v.trim() === "") continue;
      payload[k] = v;
    }
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ kind: "ok", text: "Réglages enregistrés et appliqués immédiatement." });
        await load();
      } else {
        setMessage({ kind: "error", text: data.error ?? "Enregistrement impossible" });
      }
    } catch {
      setMessage({ kind: "error", text: "Erreur réseau" });
    } finally {
      setSaving(false);
    }
  }

  async function test(service: "email" | "sms") {
    setTesting(service);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service }),
      });
      const data = await res.json();
      setMessage({
        kind: data.ok ? "ok" : "error",
        text: data.ok
          ? `${service === "email" ? "E-mail" : "SMS"} de test envoyé — ${data.detail ?? "vérifiez votre boîte."}${data.error ? ` (${data.error})` : ""}`
          : data.error ?? "Test échoué",
      });
    } catch {
      setMessage({ kind: "error", text: "Erreur réseau" });
    } finally {
      setTesting(null);
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Chargement des réglages…</p>;

  const s = state;
  const isDisabled = role !== "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy-900 dark:text-slate-100">Services &amp; API</h1>
          <p className="mt-1 text-sm text-slate-400">Paramétrage SMTP, Resend, Twilio (SMS) et Stripe — actif immédiatement après enregistrement.</p>
        </div>
        <div className="flex gap-2">
          <Badge ok={s.configured.email}>E-mail</Badge>
          <Badge ok={s.configured.sms}>SMS</Badge>
          <Badge ok={s.configured.stripe}>Stripe</Badge>
        </div>
      </div>

      {message && (
        <div className={`card-pro px-5 py-3 text-sm font-semibold ${message.kind === "ok" ? "text-emerald-700 dark:text-emerald-300" : "text-red-600"}`}>
          {message.text}
        </div>
      )}

      {isDisabled && <p className="text-sm text-amber-600">Seuls les administrateurs peuvent modifier ces réglages.</p>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* E-mail */}
        <div className="card-pro overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
            <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700 dark:text-slate-200">E-mail (SMTP / Resend)</h2>
            <button type="button" disabled={isDisabled || testing !== null} onClick={() => void test("email")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-navy-700 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
              {testing === "email" ? "Test…" : "Tester l'envoi"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 px-5 py-4">
            <Field label="Hôte SMTP" value={s.smtp_host ?? ""} field="smtp_host" onChange={set} disabled={isDisabled} placeholder="smtp.example.com" />
            <Field label="Port" value={s.smtp_port != null ? String(s.smtp_port) : ""} field="smtp_port" onChange={set} disabled={isDisabled} placeholder="587" type="number" />
            <Field label="Utilisateur" value={s.smtp_user ?? ""} field="smtp_user" onChange={set} disabled={isDisabled} placeholder="postmaster@…" />
            {s.smtp_pass ? (
              <Field label="Mot de passe (configuré — masqué)" value={form.smtp_pass ?? ""} field="smtp_pass" onChange={set} disabled={isDisabled} placeholder="••••••••" type="password" secret={!!form.smtp_pass} />
            ) : (
              <Field label="Mot de passe" value={form.smtp_pass ?? ""} field="smtp_pass" onChange={set} disabled={isDisabled} placeholder="••••••••" type="password" />
            )}
            <Field label="Expéditeur (From)" value={s.smtp_from ?? ""} field="smtp_from" onChange={set} disabled={isDisabled} placeholder="France Santé Transport <no-reply@…>" wide />
            <Field label="Clé API Resend (prioritaire)" value={form.resend_api_key ?? ""} field="resend_api_key" onChange={set} disabled={isDisabled} placeholder={s.resend_api_key ? "configurée — laisser vide pour conserver" : "re_…"} type="password" secret={!!s.resend_api_key} wide />
          </div>
        </div>

        {/* SMS */}
        <div className="card-pro overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
            <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700 dark:text-slate-200">SMS — Twilio (codes de vérification)</h2>
            <button type="button" disabled={isDisabled || testing !== null} onClick={() => void test("sms")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-navy-700 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10">
              {testing === "sms" ? "Test…" : "Tester le SMS"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 px-5 py-4">
            <Field label="Account SID" value={form.twilio_account_sid ?? ""} field="twilio_account_sid" onChange={set} disabled={isDisabled} placeholder={s.twilio_account_sid ? "configuré — laisser vide pour conserver" : "AC…"} type="password" secret={!!s.twilio_account_sid} />
            <Field label="Auth Token" value={form.twilio_auth_token ?? ""} field="twilio_auth_token" onChange={set} disabled={isDisabled} placeholder={s.twilio_auth_token ? "configuré — laisser vide pour conserver" : "••••••••"} type="password" secret={!!s.twilio_auth_token} />
            <Field label="Numéro émetteur (From)" value={s.twilio_from ?? ""} field="twilio_from" onChange={set} disabled={isDisabled} placeholder="+33 6 00 00 00 00" wide />
          </div>
        </div>

        {/* Stripe */}
        <div className="card-pro overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
            <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700 dark:text-slate-200">Paiement & facturation</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 px-5 py-4">
            <Field label="Clé secrète (sk_test_… ou sk_live_…)" value={form.stripe_secret_key ?? ""} field="stripe_secret_key" onChange={set} disabled={isDisabled} placeholder={s.stripe_secret_key ? "configurée — laisser vide pour conserver" : "sk_test_…"} type="password" secret={!!s.stripe_secret_key} wide />
            <Field label="TVA par défaut (%)" value={state.vat_rate != null ? String(state.vat_rate) : ""} field="vat_rate" onChange={set} disabled={isDisabled} placeholder="20" type="number" />
            <p className="col-span-2 text-[11px] leading-relaxed text-slate-400">
              Le taux configuré s'applique aux <strong>nouvelles factures</strong> créées depuis un devis accepté. Les factures existantes conservent leur taux.
            </p>
          </div>
        </div>

        {/* DocuSign */}
        <div className="card-pro overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
            <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700 dark:text-slate-200">Signature électronique — DocuSign</h2>
            <Badge ok={s.configured.docusign}>{s.configured.docusign ? "Actif" : "Non configuré"}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 px-5 py-4">
            <Field label="Account ID (GUID)" value={form.docusign_account_id ?? ""} field="docusign_account_id" onChange={set} disabled={isDisabled} placeholder="ex. 5a1d… " />
            <Field label="Integration Key (GUID)" value={form.docusign_integration_key ?? ""} field="docusign_integration_key" onChange={set} disabled={isDisabled} placeholder={s.docusign_integration_key ? "configurée — laisser vide pour conserver" : ""} type="password" secret={!!s.docusign_integration_key} />
            <Field label="User ID (GUID)" value={form.docusign_user_id ?? ""} field="docusign_user_id" onChange={set} disabled={isDisabled} placeholder="User ID de l'utilisateur API" />
            <Field label="Clé privée (PEM complet)" value={form.docusign_private_key ?? ""} field="docusign_private_key" onChange={set} disabled={isDisabled} placeholder={s.docusign_private_key ? "configurée — laisser vide pour conserver" : "-----BEGIN RSA PRIVATE KEY-----"} type="password" secret={!!s.docusign_private_key} wide />
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Environnement</label>
              <select
                value={form.docusign_environment ?? s.docusign_environment}
                onChange={(e) => set("docusign_environment", e.target.value)}
                disabled={isDisabled}
                className="mt-1 w-full cursor-pointer rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-navy-400 dark:border-white/10 dark:bg-[#12161f] dark:text-slate-200"
              >
                <option value="demo">Demo (account-d.docusign.com)</option>
                <option value="production">Production</option>
              </select>
            </div>
            <p className="col-span-2 text-[11px] leading-relaxed text-slate-400">
              Créez une <strong>application API DocuSign</strong> (authorizationCodeFlow / JWT) sur account.docusign.com, activez l&apos;impersonation, copiez Account ID / Integration Key / User ID + la clé privée RSA.
              Le signataire signe dans son navigateur via l&apos;URL intégrée, le PDF signé est archivé automatiquement.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          disabled={isDisabled || saving}
          onClick={() => void save()}
          className="rounded-xl bg-navy-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-40"
        >
          {saving ? "Enregistrement…" : "Enregistrer les réglages"}
        </button>
      </div>
    </div>
  );
}

function Badge({ children, ok }: { children: React.ReactNode; ok: boolean }) {
  return (
    <span className={ok
      ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
      : "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"}>
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />{children}
    </span>
  );
}

function Field({
  label, value, field, onChange, disabled, placeholder, type = "text", wide, secret,
}: {
  label: string;
  value: string;
  field: string;
  onChange: (field: string, v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  type?: string;
  wide?: boolean;
  secret?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      <input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(field, e.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-navy-400 disabled:opacity-60 dark:border-white/10 dark:bg-[#12161f] dark:text-slate-200"
      />
      {secret && value.trim() !== "" && <p className="mt-1 text-[10px] text-slate-400">Nouvelle valeur — remplacera le secret actuel.</p>}
    </div>
  );
}
