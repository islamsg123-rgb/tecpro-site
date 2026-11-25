/**
 * "De onde veio a venda": guardamos por onde a pessoa chegou ao site (Instagram, Facebook, Google...)
 * num cookie de 30 dias. Quando ela compra, essa origem vai junto com a venda.
 *
 * Vale a ÚLTIMA origem conhecida (se a pessoa veio do Instagram e depois de um anúncio do Google, conta o Google).
 * Entrar digitando o endereço ("direto") não apaga uma origem anterior.
 *
 * Para os links que vocês divulgam, use ?origem=instagram (ou utm_source=instagram); o painel tem um gerador de links.
 */

export const COOKIE_ORIGEM = "tecpro_origem";
export const DIAS_ORIGEM = 30;

export const CANAIS = {
  instagram: "Instagram",
  facebook: "Facebook",
  google: "Google",
  whatsapp: "WhatsApp",
  youtube: "YouTube",
  tiktok: "TikTok",
  email: "E-mail",
  outro: "Outro site",
  direto: "Direto (digitou o endereço)",
} as const;
export type Canal = keyof typeof CANAIS;

export interface Origem {
  canal: Canal;
  /** Veio de anúncio pago (utm_medium cpc/paid/ads, fbclid com utm pago, gclid) */
  anuncio: boolean;
  /** Nome da campanha (utm_campaign), quando houver */
  campanha?: string;
}

const PALAVRAS: [RegExp, Canal][] = [
  [/insta/i, "instagram"],
  [/face|fb|meta/i, "facebook"],
  [/google|gads|adwords/i, "google"],
  [/whats|wa\.me|zap/i, "whatsapp"],
  [/youtu/i, "youtube"],
  [/tiktok/i, "tiktok"],
  [/mail|newsletter|resend/i, "email"],
];

function canalDoTexto(t: string): Canal | null {
  for (const [re, canal] of PALAVRAS) if (re.test(t)) return canal;
  return null;
}

/** Descobre a origem pelo endereço de chegada e pela página anterior. null = nada novo (não troca a guardada). */
export function descobrirOrigem(url: URL, referrer: string, hostDoSite: string): Origem | null {
  const p = url.searchParams;
  const fonte = p.get("origem") ?? p.get("utm_source") ?? p.get("ref") ?? "";
  const meio = p.get("utm_medium") ?? "";
  const campanha = (p.get("utm_campaign") ?? "").slice(0, 60) || undefined;
  const anuncioPorMeio = /cpc|ppc|paid|ads?$|anuncio|patrocinado/i.test(meio);

  if (p.get("gclid") || p.get("gbraid") || p.get("wbraid")) return { canal: "google", anuncio: true, campanha };
  if (fonte) return { canal: canalDoTexto(fonte) ?? "outro", anuncio: anuncioPorMeio || Boolean(p.get("fbclid") && meio), campanha };
  if (p.get("fbclid")) {
    // O Facebook/Instagram acrescenta fbclid em qualquer link clicado lá (anúncio ou não).
    const ref = referrer.toLowerCase();
    return { canal: ref.includes("instagram") ? "instagram" : "facebook", anuncio: false, campanha };
  }
  if (referrer) {
    try {
      const host = new URL(referrer).hostname.replace(/^www\./, "");
      if (host && host !== hostDoSite.replace(/^www\./, "") && !host.endsWith("vercel.app")) {
        return { canal: canalDoTexto(host) ?? "outro", anuncio: false };
      }
    } catch {
      /* referrer inválido */
    }
  }
  return null;
}

export function origemParaCookie(o: Origem): string {
  return encodeURIComponent([o.canal, o.anuncio ? "1" : "0", o.campanha ?? ""].join("|"));
}

export function origemDoCookie(valor: string | undefined | null): Origem | null {
  if (!valor) return null;
  try {
    const [canal, anuncio, campanha] = decodeURIComponent(valor).split("|");
    if (!(canal in CANAIS)) return null;
    return { canal: canal as Canal, anuncio: anuncio === "1", campanha: campanha || undefined };
  } catch {
    return null;
  }
}

/** Texto curto para o painel, ex.: "Instagram (anúncio)". */
export function nomeOrigem(o: Origem | null | undefined): string {
  if (!o) return "Não identificado";
  return `${CANAIS[o.canal]}${o.anuncio ? " (anúncio)" : ""}`;
}
