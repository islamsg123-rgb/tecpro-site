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

/* ---------- Links dos e-mails do site ---------- */

/**
 * Nome de cada e-mail que o site manda (vai no utm_campaign dos links).
 * Lembretes por etapa (1º, 2º, 3º) porque os dias de cada etapa mudam no painel.
 */
export const NOMES_EMAIL: Record<string, string> = {
  "boas-vindas": "Boas-vindas (acesso liberado)",
  "lembrete-1": "Lembrete de estudo · 1º",
  "lembrete-2": "Lembrete de estudo · 2º",
  "lembrete-3": "Lembrete de estudo · 3º",
  "nunca-comecou-1": "Ainda não começou · 1º",
  "nunca-comecou-2": "Ainda não começou · 2º",
  "nunca-comecou-3": "Ainda não começou · 3º",
  "certificado-parabens": "Certificado: parabéns (1º aviso)",
  "certificado-convite": "Certificado: convite (2º aviso)",
  "certificado-ultimo-aviso": "Certificado: último aviso (3º)",
  "certificado-emitido": "Certificado emitido (PDF)",
};

/** Nome amigável de uma campanha: o nome do e-mail, quando for um e-mail do site. */
export function nomeCampanha(c: string): string {
  return NOMES_EMAIL[c] ?? c;
}

/** Ex.: "E-mail · Lembrete de estudo · 1º". Para as outras origens, igual a nomeOrigem. */
export function detalheOrigem(o: Origem | null | undefined): string {
  if (o?.canal === "email" && o.campanha) return `${nomeOrigem(o)} · ${nomeCampanha(o.campanha)}`;
  return nomeOrigem(o);
}

/**
 * Hosts do próprio site: só esses links ganham a marca (links de outros sites ficam como estão).
 */
function linkDoSite(u: URL): boolean {
  const h = u.hostname.replace(/^www\./, "");
  return h === "tecpromultiensino.com.br" || h.endsWith(".vercel.app") || h === "localhost";
}

/**
 * Links que NÃO podem mudar: entrar (código/link mágico), sair da lista e o arquivo PDF.
 * Os de entrar nem passam por aqui (os e-mails de acesso não levam campanha), mas fica a proteção.
 */
const NAO_MARCAR = [/^\/auth\//, /^\/lembretes\/sair/, /^\/certificados\/[^/]+\/pdf/];

/** Acrescenta utm_source=email&utm_medium=email&utm_campaign=<qual e-mail> num link do site. */
export function marcarLinkEmail(link: string, campanha: string): string {
  try {
    const u = new URL(link);
    if (!/^https?:$/.test(u.protocol) || !linkDoSite(u) || NAO_MARCAR.some((re) => re.test(u.pathname))) return link;
    if (u.searchParams.has("utm_source") || u.searchParams.has("origem")) return link;
    u.searchParams.set("utm_source", "email");
    u.searchParams.set("utm_medium", "email");
    u.searchParams.set("utm_campaign", campanha);
    return u.toString();
  } catch {
    return link;
  }
}

/** Marca todos os href="..." do HTML de um e-mail (o texto simples fica igual). */
export function marcarLinksDoEmail(html: string, campanha: string): string {
  return html.replace(/href="([^"]+)"/g, (_, url: string) => {
    // No HTML o "&" vem escrito "&amp;": volta ao normal, marca e escreve de novo.
    const marcado = marcarLinkEmail(url.replace(/&amp;/g, "&"), campanha);
    return `href="${marcado.replace(/&/g, "&amp;")}"`;
  });
}

/* ---------- Origem de cada VISITA (para "De onde vem o público") ---------- */

/** O que o navegador manda no 1º sinal de cada visita. */
export interface OrigemVisita extends Origem {
  /** Site de onde veio quando é "Outro site" (ex.: bing.com, chatgpt.com) ou o nome usado no ?origem= */
  site?: string;
  /** Primeira página aberta, ex.: /cursos/excel */
  entrada?: string;
}

/**
 * Origem desta visita (diferente do cookie de 30 dias, que guarda a última origem conhecida para as vendas):
 * aqui quem entra digitando o endereço conta como "Direto".
 * null = a pessoa veio de outra página do próprio site (aba nova aberta de um link do site): não é visita nova.
 */
export function origemDaVisita(url: URL, referrer: string, hostDoSite: string): OrigemVisita | null {
  const entrada = url.pathname.slice(0, 120);
  const o = descobrirOrigem(url, referrer, hostDoSite);
  if (o) {
    let site: string | undefined;
    if (o.canal === "outro") {
      const fonte = url.searchParams.get("origem") ?? url.searchParams.get("utm_source") ?? url.searchParams.get("ref");
      if (fonte) site = fonte.slice(0, 60);
      else {
        try {
          site = new URL(referrer).hostname.replace(/^www\./, "").slice(0, 60);
        } catch {
          /* sem site */
        }
      }
    }
    return { ...o, site, entrada };
  }
  if (referrer) {
    try {
      const h = new URL(referrer).hostname.replace(/^www\./, "");
      if (h === hostDoSite.replace(/^www\./, "") || h.endsWith("vercel.app")) return null;
    } catch {
      /* segue como direto */
    }
  }
  return { canal: "direto", anuncio: false, entrada };
}

/** Confere o que veio do navegador (nada confiável) antes de gravar. */
export function limparOrigemVisita(x: unknown): OrigemVisita | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.canal !== "string" || !(o.canal in CANAIS)) return null;
  const texto = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
  return {
    canal: o.canal as Canal,
    anuncio: o.anuncio === true,
    campanha: texto(o.campanha, 60),
    site: texto(o.site, 60)?.toLowerCase(),
    entrada: texto(o.entrada, 120),
  };
}
