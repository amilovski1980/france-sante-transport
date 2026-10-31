import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_BRANDING, resolveBranding, type BrandingSettings } from "@/lib/branding";

export async function loadBranding(): Promise<BrandingSettings> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return DEFAULT_BRANDING;
  }

  try {
    const supabase = createSupabaseClient(url, anonKey, {
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, next: { revalidate: 300 } }),
      },
    });
    const { data, error } = await supabase
      .from("site_settings")
      .select("logo_url, logo_alt, slogan, custom_css")
      .eq("id", 1)
      .single();
    if (error) return DEFAULT_BRANDING;
    return resolveBranding(data);
  } catch {
    return DEFAULT_BRANDING;
  }
}
