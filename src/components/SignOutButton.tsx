"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/components/I18nProvider";

export default function SignOutButton() {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const supabase = createClient();
          await supabase.auth.signOut();
          router.push("/");
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
      className="rounded-full border border-navy-100 bg-navy-50 px-4 py-2 text-sm font-semibold text-navy-800 transition-colors hover:bg-navy-100 disabled:opacity-60 dark:border-white/15 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20"
    >
      {pending ? t("signout.pending") : t("cta.signout")}
    </button>
  );
}
