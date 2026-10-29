"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toUserMessage } from "@/lib/errors";
import { useI18n } from "@/components/I18nProvider";

const inputClass =
  "w-full rounded-lg border border-navy-200 bg-white px-4 py-3 text-sm text-navy-900 placeholder:text-navy-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100";

type Phase = "loading" | "form" | "invalid" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const supabase = createClient();
      try {
        let { data } = await supabase.auth.getSession();
        if (!data.session && typeof window !== "undefined") {
          // Fallback explicite : on applique les jetons de réinitialisation
          // présents dans l'URL (#access_token=...&type=recovery).
          const params = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (params.get("type") === "recovery" && accessToken && refreshToken) {
            const res = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            data = res.data;
          }
        }
        if (cancelled) return;
        if (data.session) {
          window.history.replaceState(null, "", window.location.pathname);
          setPhase("form");
        } else {
          setPhase("invalid");
        }
      } catch {
        if (!cancelled) setPhase("invalid");
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setError(t("reset.errorMin"));
      return;
    }
    if (password !== confirm) {
      setError(t("reset.errorMismatch"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;
      setPhase("done");
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1200);
    } catch (err) {
      setError(toUserMessage(err));
      setPending(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-20">
      {phase === "loading" && (
        <div className="surface p-8 text-sm text-navy-700">{t("reset.checking")}</div>
      )}

      {phase === "invalid" && (
        <div className="surface space-y-3 p-8 text-center">
          <h1 className="font-display text-2xl font-semibold text-navy-900">{t("reset.invalidTitle")}</h1>
          <p className="text-sm text-navy-700/80">
            {t("reset.invalidBody")}
          </p>
          <a href="/login" className="inline-block text-sm font-semibold text-flagred-700 hover:underline">
            {t("reset.backToLogin")}
          </a>
        </div>
      )}

      {phase === "done" && (
        <div className="surface p-8 text-center">
          <h1 className="font-display text-2xl font-semibold text-navy-900">
            {t("reset.doneTitle")}
          </h1>
          <p className="mt-2 text-sm text-navy-700/80">{t("reset.doneBody")}</p>
        </div>
      )}

      {phase === "form" && (
        <form onSubmit={handleSubmit} className="surface space-y-5 p-8">
          <div>
            <h1 className="font-display text-2xl font-semibold text-navy-900">
              {t("reset.title")}
            </h1>
            <p className="mt-1.5 text-sm text-navy-700/75">{t("reset.subtitle")}</p>
          </div>
          <div>
            <label
              htmlFor="reset-password"
              className="mb-1.5 block text-sm font-semibold text-navy-800"
            >
              {t("field.password")}
            </label>
            <input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="reset-confirm"
              className="mb-1.5 block text-sm font-semibold text-navy-800"
            >
              {t("reset.confirm")}
            </label>
            <input
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
          </div>
          {error && <p className="text-sm text-flagred-700">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-flagred-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-flagred-700 disabled:opacity-60"
          >
            {pending ? t("reset.saving") : t("reset.submit")}
          </button>
        </form>
      )}
    </main>
  );
}
