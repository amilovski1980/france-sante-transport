import ProfileEditor from "@/components/dashboard/ProfileEditor";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold text-navy-900 dark:text-slate-100">Parametres</h1>
      <ProfileEditor />
    </div>
  );
}
