"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { adminAttachSupplierMember, adminCreateSupplier } from "@/lib/api";
import { toUserMessage } from "@/lib/errors";
import type { Organization, OrganizationMember, OrgRole, Profile, Supplier } from "@/lib/types";

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-navy-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100";

const ORG_ROLES: { value: OrgRole; label: string }[] = [
  { value: "owner", label: "Propriétaire" },
  { value: "member", label: "Membre" },
  { value: "contact", label: "Contact" },
];

export default function AdminSuppliersPanel({
  suppliers,
  organizations,
  profiles,
  members,
}: {
  suppliers: Supplier[];
  organizations: Organization[];
  profiles: Profile[];
  members: OrganizationMember[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState({
    organization_name: "",
    code: "",
    contact_email: "",
    contact_phone: "",
    siret: "",
    address: "",
  });
  const [userDraft, setUserDraft] = useState({
    full_name: "",
    email: "",
    password: "",
  });
  const [attachDraft, setAttachDraft] = useState({
    supplier_id: suppliers[0]?.id ?? "",
    user_id: "",
    org_role: "member" as OrgRole,
  });

  const organizationById = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization])),
    [organizations],
  );
  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const supplierProfiles = profiles.filter((profile) => profile.role === "supplier");

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitSupplier(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      await adminCreateSupplier({
        organization_name: createDraft.organization_name.trim(),
        code: createDraft.code.trim(),
        contact_email: createDraft.contact_email.trim() || null,
        contact_phone: createDraft.contact_phone.trim() || null,
        siret: createDraft.siret.trim() || null,
        address: createDraft.address.trim() || null,
      });
      setCreateDraft({ organization_name: "", code: "", contact_email: "", contact_phone: "", siret: "", address: "" });
    });
  }

  async function submitUser(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...userDraft, role: "supplier" }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Création impossible");
      setUserDraft({ full_name: "", email: "", password: "" });
    });
  }

  async function submitAttach(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      await adminAttachSupplierMember(attachDraft.supplier_id, attachDraft.user_id, attachDraft.org_role);
      setAttachDraft((draft) => ({ ...draft, user_id: "" }));
    });
  }

  return (
    <div className="space-y-4">
      <div className="card-pro p-5">
        <h1 className="font-display text-xl font-bold text-navy-900 dark:text-white">Fournisseurs</h1>
        <p className="mt-1 text-sm text-slate-400">
          Créez l&apos;organisation fournisseur, son compte utilisateur puis rattachez-le à l&apos;organisation.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="card-pro overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3.5 dark:border-white/10">
            <h2 className="font-display text-sm font-semibold text-navy-900 dark:text-white">
              {suppliers.length} fournisseur(s)
            </h2>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-white/10">
            {suppliers.map((supplier) => {
              const organization = organizationById.get(supplier.organization_id);
              const supplierMembers = members.filter((member) => member.organization_id === supplier.organization_id);
              return (
                <li key={supplier.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-sm font-semibold text-navy-900 dark:text-white">
                        {organization?.name ?? supplier.code}
                      </p>
                      <p className="text-xs text-slate-400">
                        Code {supplier.code} · {supplier.contact_email ?? "sans e-mail"} · {supplier.contact_phone ?? "sans téléphone"}
                      </p>
                    </div>
                    <span
                      className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase ${
                        supplier.active
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"
                      }`}
                    >
                      {supplier.active ? "Actif" : "Inactif"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {supplierMembers.length === 0 ? (
                      <span className="text-xs text-slate-400">Aucun membre rattaché.</span>
                    ) : (
                      supplierMembers.map((member) => {
                        const profile = profileById.get(member.user_id);
                        return (
                          <span
                            key={`${member.organization_id}-${member.user_id}`}
                            className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300"
                          >
                            {profile?.full_name || profile?.email || member.user_id.slice(0, 8)} · {member.org_role}
                          </span>
                        );
                      })
                    )}
                  </div>
                </li>
              );
            })}
            {suppliers.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-slate-400">Aucun fournisseur.</li>
            )}
          </ul>
        </section>

        <div className="space-y-4">
          <section className="card-pro p-5">
            <h2 className="font-display text-sm font-semibold text-navy-900 dark:text-white">Créer un fournisseur</h2>
            <form onSubmit={submitSupplier} className="mt-3 space-y-2">
              <input className={input} placeholder="Nom de l'organisation *" value={createDraft.organization_name} onChange={(e) => setCreateDraft({ ...createDraft, organization_name: e.target.value })} required />
              <input className={input} placeholder="Code fournisseur *" value={createDraft.code} onChange={(e) => setCreateDraft({ ...createDraft, code: e.target.value })} required />
              <input className={input} type="email" placeholder="E-mail de contact" value={createDraft.contact_email} onChange={(e) => setCreateDraft({ ...createDraft, contact_email: e.target.value })} />
              <input className={input} placeholder="Téléphone de contact" value={createDraft.contact_phone} onChange={(e) => setCreateDraft({ ...createDraft, contact_phone: e.target.value })} />
              <input className={input} placeholder="SIRET" value={createDraft.siret} onChange={(e) => setCreateDraft({ ...createDraft, siret: e.target.value })} />
              <input className={input} placeholder="Adresse" value={createDraft.address} onChange={(e) => setCreateDraft({ ...createDraft, address: e.target.value })} />
              <button type="submit" disabled={busy} className="rounded-xl bg-navy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
                Créer le fournisseur
              </button>
            </form>
          </section>

          <section className="card-pro p-5">
            <h2 className="font-display text-sm font-semibold text-navy-900 dark:text-white">Créer un compte fournisseur</h2>
            <form onSubmit={submitUser} className="mt-3 space-y-2">
              <input className={input} placeholder="Nom complet *" value={userDraft.full_name} onChange={(e) => setUserDraft({ ...userDraft, full_name: e.target.value })} required />
              <input className={input} type="email" placeholder="E-mail *" value={userDraft.email} onChange={(e) => setUserDraft({ ...userDraft, email: e.target.value })} required />
              <input className={input} type="text" placeholder="Mot de passe (8 caractères min.) *" value={userDraft.password} onChange={(e) => setUserDraft({ ...userDraft, password: e.target.value })} autoComplete="off" required />
              <button type="submit" disabled={busy} className="rounded-xl bg-navy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
                Créer le compte
              </button>
            </form>
          </section>

          <section className="card-pro p-5">
            <h2 className="font-display text-sm font-semibold text-navy-900 dark:text-white">Rattacher un membre</h2>
            <form onSubmit={submitAttach} className="mt-3 space-y-2">
              <select className={input} value={attachDraft.supplier_id} onChange={(e) => setAttachDraft({ ...attachDraft, supplier_id: e.target.value })} required>
                <option value="">Fournisseur *</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {organizationById.get(supplier.organization_id)?.name ?? supplier.code}
                  </option>
                ))}
              </select>
              <select className={input} value={attachDraft.user_id} onChange={(e) => setAttachDraft({ ...attachDraft, user_id: e.target.value })} required>
                <option value="">Compte fournisseur *</option>
                {supplierProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.full_name || profile.email}</option>
                ))}
              </select>
              <select className={input} value={attachDraft.org_role} onChange={(e) => setAttachDraft({ ...attachDraft, org_role: e.target.value as OrgRole })}>
                {ORG_ROLES.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
              <button type="submit" disabled={busy || supplierProfiles.length === 0} className="rounded-xl bg-navy-800 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
                Rattacher
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
