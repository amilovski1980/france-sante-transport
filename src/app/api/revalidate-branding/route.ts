import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Revalidation ciblée des réglages d'identité (logo, réseaux sociaux,
 * images de la page d'accueil). Appelée par le panneau d'administration
 * juste après un enregistrement : les pages publiques refont surface
 * immédiatement avec le nouveau branding, sans attendre le cache ISR.
 */
export async function POST() {
  try {
    revalidateTag("branding");
    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch {
    // L'invalidation cache-only est sans enjeu : le cache expire aussi seul.
    return NextResponse.json({ ok: true, revalidated: false });
  }
}
