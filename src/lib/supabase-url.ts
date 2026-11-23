/**
 * Endereço do Supabase só com a "raiz" (ex.: https://abc.supabase.co).
 * Evita erro "Invalid path specified in request URL" se alguém colar a URL com /rest/v1/ ou barra no fim.
 */
export function urlSupabase(): string | undefined {
  const bruto = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!bruto) return undefined;
  try {
    return new URL(bruto).origin;
  } catch {
    return bruto.replace(/\/+$/, "");
  }
}
