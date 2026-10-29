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
      className="rounded-full border border-white/25 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-60"
    >
      {pending ? t("signout.pending") : t("cta.signout")}
    </button>
  );
}
