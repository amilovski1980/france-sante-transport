"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import { adminUpdateProfile, listAllProfiles } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import { useI18n } from "@/components/I18nProvider";
import type { AppRole, Profile } from "@/lib/types";

const ROLE_TONES: Record<AppRole, string> = {
  admin: "bg-violet-100 text-violet-700 border-violet-200",
  dispatcher: "bg-blue-100 text-blue-700 border-blue-200",
  driver: "bg-emerald-100 text-emerald-700 border-emerald-200",
  client: "bg-slate-100 text-slate-600 border-slate-200",
  partner: "bg-amber-100 text-amber-700 border-amber-200",
};

const ROLES: AppRole[] = ["client", "driver", "dispatcher", "admin", "partner"];

function roleLabel(labels: { roles: readonly { value: string; label: string }[] }, role: AppRole): string {
  return labels.roles.find((r) => r.value === role)?.label ?? role;
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

export default function UserAdminPanel() {
  const { t, labels } = useI18n();
  const router = useRouter();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | "all">("all");
  const [editing, setEditing] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setUsers(await listAllProfiles());
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        (u.full_name || "").toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone || "").toLowerCase().includes(q)
      );
    });
  }, [users, query, roleFilter]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await adminUpdateProfile({
        userId: editing.id,
        full_name: editing.full_name,
        phone: editing.phone,
        address: editing.address,
        avatar_url: editing.avatar_url,
        role: editing.role,
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">{t("uap.title")}</h2>
          <p className="text-sm text-slate-500">{t("uap.subtitle", { n: users.length })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("uap.search")}
            className={`${inputClass} w-56`}
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as AppRole | "all")}
            className={`${inputClass} w-40`}
          >
            <option value="all">{t("uap.allRoles")}</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{roleLabel(labels, r)}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-flagred-600/30 bg-flagred-50 px-4 py-3 text-sm font-medium text-flagred-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="p-8 text-center text-sm text-slate-500">{t("common.loading")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((u) => (
            <div key={u.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
              <Avatar name={u.full_name} email={u.email} src={u.avatar_url} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold text-slate-900">{u.full_name || u.email}</p>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${ROLE_TONES[u.role]}`}>
                    {roleLabel(labels, u.role)}
                  </span>
                </div>
                <p className="truncate text-xs text-slate-500">{u.email}</p>
                {u.phone && <p className="mt-1 text-xs text-slate-600">☎ {u.phone}</p>}
                {u.address && <p className="truncate text-xs text-slate-400">📍 {u.address}</p>}
                <button
                  type="button"
                  onClick={() => setEditing(u)}
                  className="mt-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t("uap.edit")}
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full p-8 text-center text-sm text-slate-500">{t("uap.empty")}</p>
          )}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
          <form onSubmit={save} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <Avatar name={editing.full_name} email={editing.email} src={editing.avatar_url} size="lg" />
              <div>
                <h3 className="font-semibold text-slate-900">{t("uap.editTitle")}</h3>
                <p className="text-xs text-slate-500">{editing.email}</p>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">{t("uap.fullName")}</label>
              <input className={inputClass} value={editing.full_name ?? ""} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">{t("uap.phone")}</label>
              <input className={inputClass} value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">{t("uap.address")}</label>
              <input className={inputClass} value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">{t("uap.avatar")}</label>
              <input className={inputClass} placeholder="https://..." value={editing.avatar_url ?? ""} onChange={(e) => setEditing({ ...editing, avatar_url: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">{t("uap.role")}</label>
              <select className={inputClass} value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value as AppRole })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{roleLabel(labels, r)}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                {t("common.cancel")}
              </button>
              <button type="submit" disabled={saving} className="rounded-full bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
