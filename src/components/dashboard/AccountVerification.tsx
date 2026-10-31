"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Channel = "email" | "sms";

const CHANNEL_LABEL: Record<Channel, { title: string; hint: string }> = {
  email: { title: "Adresse e-mail", hint: "Un code à 6 chiffres vous est envoyé par e-mail." },
  sms: { title: "Numéro de téléphone", hint: "Un code à 6 chiffres vous est envoyé par SMS (Twilio)." },
};

export default function AccountVerification() {
  const router = useRouter();
  const supabase = useMemoClient();
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [phoneVerified, setPhoneVerified] = useState<boolean | null>(null);
  const [hasPhone, setHasPhone] = useState(true);
  const [step, setStep] = useState<Channel | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error" | "warn"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("phone, email_verified_at, phone_verified_at")
      .eq("id", user.id)
      .single();
    if (data) {
      setEmailVerified(Boolean(data.email_verified_at));
      setPhoneVerified(Boolean(data.phone_verified_at));
      setHasPhone(Boolean(data.phone));
    }
  }, [supabase]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function start(channel: Channel) {
    setBusy(channel);
    setMessage(null);
    try {
      const res = await fetch("/api/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMessage({ kind: "error", text: data.error ?? "Envoi du code impossible" });
      } else if (data.already) {
        setMessage({ kind: "ok", text: "Déjà vérifié ✓" });
        await refresh();
      } else {
        setStep(channel);
        setCode("");
        setMessage(
          data.provider === "console"
            ? { kind: "warn", text: data.detail ?? "Service non configuré : consultez l'administrateur (Services & API)." }
            : { kind: "ok", text: CHANNEL_LABEL[channel].hint },
        );
      }
    } catch {
      setMessage({ kind: "error", text: "Erreur réseau" });
    } finally {
      setBusy(null);
    }
  }

  async function confirm(channel: Channel) {
    if (code.replace(/\D/g, "").length !== 6 || busy) return;
    setBusy("confirm");
    try {
      const res = await fetch("/api/verification", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, code }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMessage({ kind: "error", text: data.error ?? "Code refusé" });
      } else {
        setMessage({ kind: "ok", text: channel === "email" ? "E-mail vérifié ✓" : "Téléphone vérifié ✓" });
        setStep(null);
        setCode("");
        await refresh();
        router.refresh();
      }
    } catch {
      setMessage({ kind: "error", text: "Erreur réseau" });
    } finally {
      setBusy(null);
    }
  }

  function Row({ channel }: { channel: Channel }) {
    const verified = channel === "email" ? emailVerified : phoneVerified;
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{CHANNEL_LABEL[channel].title}</p>
          <p className="text-xs text-slate-400">
            {verified
              ? "Vérifié ✓"
              : channel === "sms" && !hasPhone
                ? "Ajoutez d'abord un numéro dans votre profil."
                : "Non vérifié"}
          </p>
        </div>
        {!verified && (channel === "email" || hasPhone) && (
          <button
            type="button"
            onClick={() => { setStep(null); void start(channel); }}
            disabled={busy !== null}
            className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-navy-700 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
          >
            {busy === channel ? "Envoi…" : step === channel ? "Code renvoyé" : "Vérifier"}
          </button>
        )}
        {verified && <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">VÉRIFIÉ</span>}
      </div>
    );
  }

  return (
    <div className="card-pro overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
        <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700 dark:text-slate-200">Vérification du compte</h2>
      </div>
      {message && (
        <div className={`px-5 pt-4 text-xs font-semibold ${
          message.kind === "error" ? "text-red-600" : message.kind === "warn" ? "text-amber-600" : "text-emerald-600"
        }`}>
          {message.text}
        </div>
      )}
      <div className={`divide-y divide-slate-100 px-0 py-0 dark:divide-white/5 ${message ? "mt-2" : ""}`}>
        <Row channel="email" />
        <Row channel="sms" />
      </div>
      {step && (
        <div className="border-t border-slate-100 bg-navy-50/60 px-5 py-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
            Saisissez le code à 6 chiffres envoyé par {step === "email" ? "e-mail" : "SMS"} :
          </p>
          <div className="mt-3 flex items-center gap-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => { if (e.key === "Enter") void confirm(step); }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-center text-lg font-bold tracking-[0.4em] outline-none focus:border-navy-400 dark:border-white/10 dark:bg-[#12161f] dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => void confirm(step)}
              disabled={code.length !== 6 || busy !== null}
              className="rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-40"
            >
              {busy === "confirm" ? "…" : "Valider"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function useMemoClient() {
  const [client] = useState(() => createClient());
  return client;
}
