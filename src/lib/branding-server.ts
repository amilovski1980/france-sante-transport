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
          fetch(input, { ...init, next: { revalidate: 60, tags: ["branding"] } }),
      },
    });
    const { data, error } = await supabase
      .from("site_settings")
      .select(
        "logo_url, logo_alt, slogan, custom_css, social_facebook, social_linkedin, social_x, social_instagram, newsletter_url, home_hero_image, home_visual_image",
      )
      .eq("id", 1)
      .single();
    if (error) {
      // Repli : une seconde tentative sans cache (higiénique si la première a été tronquée).
      const retry = await supabase
        .from("site_settings")
        .select(
          "logo_url, logo_alt, slogan, custom_css, social_facebook, social_linkedin, social_x, social_instagram, newsletter_url, home_hero_image, home_visual_image",
        )
        .eq("id", 1)
        .single();
      if (retry.error) return DEFAULT_BRANDING;
      return resolveBranding(retry.data);
    }
    return resolveBranding(data);
  } catch {
    return DEFAULT_BRANDING;
  }
}
