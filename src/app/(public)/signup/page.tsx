"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toUserMessage } from "@/lib/errors";
import { useI18n } from "@/components/I18nProvider";

const inputClass =
  "w-full rounded-lg border border-navy-200 bg-white px-4 py-3 text-sm text-navy-900 placeholder:text-navy-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100";

function SignupForm() {
  const router = useRouter();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });
      if (authError) {
        throw authError;
      }
      if (data.session) {
        router.push(redirect.startsWith("/") ? redirect : "/dashboard");
        router.refresh();
        return;
      }
      setSuccess(true);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <div className="surface p-8 text-center">
        <h1 className="font-display text-2xl font-semibold text-navy-900">{t("signup.createdTitle")}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-navy-700/80">
          {t("signup.createdBody")}
        </p>
        <Link
          href={`/login?redirect=${encodeURIComponent(redirect)}`}
          className="mt-6 inline-flex rounded-full bg-navy-800 px-7 py-3 text-sm font-semibold text-white hover:bg-navy-700"
        >
          {t("signup.createdCta")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="surface space-y-5 p-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-navy-900">{t("signup.title")}</h1>
        <p className="mt-1.5 text-sm text-navy-700/75">
          {t("signup.subtitle")}
        </p>
      </div>

      <div>
        <label htmlFor="signup-name" className="mb-1.5 block text-sm font-semibold text-navy-800">
          {t("field.name")}
        </label>
        <input
          id="signup-name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={200}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder={t("signup.fullName")}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="signup-email" className="mb-1.5 block text-sm font-semibold text-navy-800">
          {t("field.email")}
        </label>
        <input
          id="signup-email"
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
        <label htmlFor="signup-phone" className="mb-1.5 block text-sm font-semibold text-navy-800">
          {t("signup.phone")}
        </label>
        <input
          id="signup-phone"
          type="tel"
          autoComplete="tel"
          maxLength={30}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("signup.phonePlaceholder")}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="signup-password" className="mb-1.5 block text-sm font-semibold text-navy-800">
          {t("field.password")}
        </label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("signup.passwordHint")}
          className={inputClass}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-flagred-600/30 bg-flagred-50 px-4 py-3 text-sm font-medium text-flagred-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-flagred-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-flagred-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? t("signup.submitting") : t("signup.submit")}
      </button>

      <p className="text-center text-sm text-navy-700/80">
        {t("signup.haveAccount")}{" "}
        <Link
          href={`/login?redirect=${encodeURIComponent(redirect)}`}
          className="font-semibold text-navy-900 underline decoration-flagred-600 decoration-2 underline-offset-4"
        >
          {t("cta.signin")}
        </Link>
      </p>
    </form>
  );
}

export default function SignupPage() {
  return (
    <section className="section-pad bg-navy-50/60">
      <div className="container-x mx-auto max-w-md">
        <Suspense fallback={<div className="surface h-96 animate-pulse" />}>
          <SignupForm />
        </Suspense>
      </div>
    </section>
  );
}
