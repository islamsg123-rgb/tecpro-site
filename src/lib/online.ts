/**
 * "Online agora": em que parte do site a pessoa está, a partir do endereço da página.
 * Usado no navegador (sinal) e no servidor (painel). Sem nada secreto aqui.
 */

export type AreaOnline = "loja" | "aluno";
export type PaginaOnline =
  | "inicio" | "catalogo" | "curso" | "checkout" | "pagando" | "outra"
  | "aula" | "certificado" | "conta"
  /** Só no painel: /checkout de um curso GRATUITO é cadastro, não pagamento. */
  | "cadastro";

export interface LugarOnline {
  area: AreaOnline;
  pagina: PaginaOnline;
  cursoSlug: string | null;
}

/** Sinal a cada minuto; online = sinal nos últimos 2 minutos (com folga para atrasos). */
export const INTERVALO_SINAL_MS = 60_000;
export const JANELA_ONLINE_MS = 150_000;

const SLUG = "([a-z0-9-]{1,120})";

/** null = página que não conta (painel, rotas internas). */
export function lugarDoCaminho(caminho: string): LugarOnline | null {
  const p = (caminho.split(/[?#]/)[0] || "/").replace(/\/+$/, "") || "/";
  if (p.startsWith("/admin") || p.startsWith("/api") || p.startsWith("/auth")) return null;
  let m: RegExpMatchArray | null;
  if ((m = p.match(new RegExp(`^/minha-conta/cursos/${SLUG}/aulas/[^/]+$`, "i")))) return { area: "aluno", pagina: "aula", cursoSlug: m[1].toLowerCase() };
  if ((m = p.match(new RegExp(`^/minha-conta/cursos/${SLUG}/certificado$`, "i")))) return { area: "aluno", pagina: "certificado", cursoSlug: m[1].toLowerCase() };
  if ((m = p.match(new RegExp(`^/minha-conta/cursos/${SLUG}$`, "i")))) return { area: "aluno", pagina: "conta", cursoSlug: m[1].toLowerCase() };
  if (p.startsWith("/minha-conta")) return { area: "aluno", pagina: "conta", cursoSlug: null };
  if (p === "/") return { area: "loja", pagina: "inicio", cursoSlug: null };
  if (p === "/cursos") return { area: "loja", pagina: "catalogo", cursoSlug: null };
  if (p.startsWith("/checkout/pedido/")) return { area: "loja", pagina: "pagando", cursoSlug: null };
  if ((m = p.match(new RegExp(`^/checkout/${SLUG}$`, "i")))) return { area: "loja", pagina: "checkout", cursoSlug: m[1].toLowerCase() };
  if ((m = p.match(new RegExp(`^/cursos/${SLUG}$`, "i")))) return { area: "loja", pagina: "curso", cursoSlug: m[1].toLowerCase() };
  return { area: "loja", pagina: "outra", cursoSlug: null };
}

/* ---------- Resposta do painel (/api/admin/online) ---------- */

export interface PessoaNoCheckout {
  nome: string | null;
  email: string | null;
  curso: string | null;
  /** checkout = curso pago; pagando = tela do Pix/boleto; certificado = pagando o certificado na área do aluno; cadastro = curso grátis */
  pagina: "checkout" | "pagando" | "certificado" | "cadastro";
  ficha: string | null;
  whatsapp: string | null;
}

export interface RespostaOnline {
  tabelaFaltando: boolean;
  atualizadoEm: string;
  loja: { total: number; paginas: Partial<Record<PaginaOnline, number>>; cursosVistos: { nome: string; n: number }[]; noCheckout: PessoaNoCheckout[]; cadastroGratis: PessoaNoCheckout[] };
  aluno: { total: number; assistindo: number; porCurso: { nome: string; n: number }[] };
  hoje: { visitas: number; cadastros: number | null; vendas: number | null };
  /** De onde veio quem está online agora ("Não identificado" = chegou antes de existir esta função). */
  origemAgora: { nome: string; n: number }[];
}
