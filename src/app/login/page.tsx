"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toUserMessage } from "@/lib/errors";
import { useI18n } from "@/components/I18nProvider";

const inputClass =
  "w-full rounded-lg border border-navy-200 bg-white px-4 py-3 text-sm text-navy-900 placeholder:text-navy-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100";

function LoginForm() {
  const router = useRouter();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setInfo(null);
    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        throw authError;
      }
      if (!data.session) {
        setError(t("login.sessionError"));
        return;
      }
      router.push(redirect.startsWith("/") ? redirect : "/dashboard");
      router.refresh();
    } catch (err) {
      const mapped = toUserMessage(err);
      setError(
        /invalid login credentials/i.test(mapped) || /Identifiants/i.test(mapped)
          ? t("login.invalid")
          : mapped,
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="surface space-y-5 p-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-navy-900">{t("login.title")}</h1>
        <p className="mt-1.5 text-sm text-navy-700/75">
          {t("login.subtitle")}
        </p>
      </div>

      <div>
        <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-navy-800">
          {t("field.email")}
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("signup.emailPlaceholder")}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="login-password" className="mb-1.5 block text-sm font-semibold text-navy-800">
          {t("field.password")}
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className={inputClass}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-flagred-600/30 bg-flagred-50 px-4 py-3 text-sm font-medium text-flagred-700">
          {error}
        </p>
      )}
      {info && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {info}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-navy-800 px-6 py-3.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? t("login.submitting") : t("login.submit")}
      </button>

      <p className="text-center text-sm text-navy-700/80">
        {t("login.noAccount")}{" "}
        <Link
          href={`/signup?redirect=${encodeURIComponent(redirect)}`}
          className="font-semibold text-navy-900 underline decoration-flagred-600 decoration-2 underline-offset-4"
        >
          {t("login.createAccount")}
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <section className="section-pad bg-navy-50/60">
      <div className="container-x mx-auto max-w-md">
        <Suspense fallback={<div className="surface h-96 animate-pulse" />}>
          <LoginForm />
        </Suspense>
      </div>
    </section>
  );
}
