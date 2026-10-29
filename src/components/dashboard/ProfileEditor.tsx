"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toUserMessage } from "@/lib/errors";
import { useI18n } from "@/components/I18nProvider"; import { updateOwnProfile } from "@/lib/api"; import Avatar from "@/components/Avatar";

const inputClass =
  "w-full rounded-lg border border-navy-200 bg-white px-4 py-3 text-sm text-navy-900 placeholder:text-navy-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100";

/**
 * Édition du profil de l'utilisateur connecté (nom et téléphone).
 * Les rôles ne sont modifiables que par un administrateur (protégé aussi
 * par le trigger `prevent_self_role_change` côté base).
 */
export default function ProfileEditor() {
  const { t } = useI18n();
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState(""); const [address, setAddress] = useState(""); const [avatarUrl, setAvatarUrl] = useState(""); const [newEmail, setNewEmail] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, email, avatar_url, address")
        .eq("id", user.id)
        .single();
      if (cancelled) return;
      setEmail(data?.email ?? user.email ?? "");
      setFullName(data?.full_name ?? "");
      setPhone(data?.phone ?? ""); setAddress(data?.address ?? ""); setAvatarUrl(data?.avatar_url ?? ""); setNewEmail(data?.email ?? user.email ?? "");
      setLoaded(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(t("prof.sessionExpired"));
      await updateOwnProfile({ full_name: fullName.trim(), phone: phone.trim() || null, address: address.trim() || null, avatar_url: avatarUrl.trim() || null }); if (newEmail && newEmail.trim() !== email) { const { error: emailError } = await supabase.auth.updateUser({ email: newEmail.trim() }); if (emailError) throw emailError; setEmail(newEmail.trim()); }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (!loaded) {
    return (
      <div className="surface p-6 text-sm text-navy-700">{t("prof.loading")}</div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="surface max-w-xl space-y-5 p-6">
      <div>
        <Avatar name={fullName} email={email} src={avatarUrl || null} size="lg" className="mb-2" /><h2 className="font-display text-xl font-semibold text-navy-900">{t("st.tabAccount")}</h2>
        <p className="mt-1 text-sm text-navy-700/75">{email}</p>
      </div>

      <div>
        <label htmlFor="profile-name" className="mb-1.5 block text-sm font-semibold text-navy-800">
          {t("field.name")}
        </label>
        <input
          id="profile-name"
          type="text"
          required
          maxLength={120}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder={t("prof.namePh")}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="profile-phone" className="mb-1.5 block text-sm font-semibold text-navy-800">
          {t("prof.phone")}
        </label>
        <input
          id="profile-phone"
          type="tel"
          maxLength={30}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+33 6 12 34 56 78"
          className={inputClass}
        />
      </div>

      <div><label className="mb-1.5 block text-sm font-semibold text-navy-800">{t("prof.email")}</label><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputClass} /></div> <div><label className="mb-1.5 block text-sm font-semibold text-navy-800">{t("prof.address")}</label><input type="text" maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} /></div> <div><label className="mb-1.5 block text-sm font-semibold text-navy-800">{t("prof.avatar")}</label><input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className={inputClass} /></div> {error && <p className="text-sm text-flagred-700">{error}</p>}
      {saved && !error && (
        <p className="text-sm font-medium text-emerald-700">{t("prof.updated")}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-flagred-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-flagred-700 disabled:opacity-60"
      >
        {pending ? t("prof.saving") : t("common.save")}
      </button>
    </form>
  );
}
