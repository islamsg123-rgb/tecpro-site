import "server-only";
import { bancoEmDemonstracao, db } from "./index";
import { listarCarrinhos } from "./carrinhos";
import { JANELA_ONLINE_MS, type LugarOnline } from "../online";

/**
 * "Online agora": uma linha por visitante (navegador), atualizada a cada sinal (1 por minuto por aba aberta).
 * Tabela criada por supabase/migrations/0013_online_agora.sql (online-agora.sql).
 * Se a tabela ainda não existir, o site continua normal: o sinal só é ignorado.
 */

export interface Presenca extends LugarOnline {
  visitante: string;
  email: string | null;
  primeiraEm: string;
  vistoEm: string;
}

const g = globalThis as unknown as { __presencaDemo?: Map<string, Presenca> };
const demo = () => (g.__presencaDemo ??= new Map());

/** Começo do dia de hoje em Brasília (sem horário de verão desde 2019). */
export function inicioDeHoje(): string {
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  return new Date(`${hoje}T00:00:00-03:00`).toISOString();
}

export async function registrarSinal(visitante: string, email: string | null, lugar: LugarOnline): Promise<void> {
  const agora = new Date().toISOString();
  if (bancoEmDemonstracao) {
    const atual = demo().get(visitante);
    demo().set(visitante, { visitante, email: email ?? atual?.email ?? null, ...lugar, primeiraEm: atual?.primeiraEm ?? agora, vistoEm: agora });
    return;
  }
  const linha: Record<string, unknown> = {
    visitante, area: lugar.area, pagina: lugar.pagina, curso_slug: lugar.cursoSlug, visto_em: agora,
  };
  // Sem e-mail neste sinal: mantém o que já se sabia (ex.: digitou o e-mail no checkout e voltou ao catálogo).
  if (email) linha.email = email;
  const { error } = await db().from("presenca_site").upsert(linha, { onConflict: "visitante" });
  if (error) throw error;
}

export interface ResumoPresenca {
  online: Presenca[];
  /** Navegadores diferentes que passaram pelo site hoje (horário de Brasília). */
  visitasHoje: number;
  tabelaFaltando: boolean;
}

const daLinha = (r: Record<string, unknown>): Presenca => ({
  visitante: String(r.visitante), email: (r.email as string) ?? null,
  area: r.area as Presenca["area"], pagina: r.pagina as Presenca["pagina"], cursoSlug: (r.curso_slug as string) ?? null,
  primeiraEm: String(r.primeira_em), vistoEm: String(r.visto_em),
});

export async function resumoPresenca(): Promise<ResumoPresenca> {
  const corte = new Date(Date.now() - JANELA_ONLINE_MS).toISOString();
  const hoje = inicioDeHoje();
  if (bancoEmDemonstracao) {
    const todos = Array.from(demo().values());
    return { online: todos.filter((p) => p.vistoEm >= corte), visitasHoje: todos.filter((p) => p.vistoEm >= hoje).length, tabelaFaltando: false };
  }
  const [on, vis] = await Promise.all([
    db().from("presenca_site").select("*").gte("visto_em", corte).order("visto_em", { ascending: false }).limit(2000),
    db().from("presenca_site").select("visitante", { count: "exact", head: true }).gte("visto_em", hoje),
  ]);
  if (on.error || vis.error) {
    console.error("[online]", (on.error ?? vis.error)?.message);
    return { online: [], visitasHoje: 0, tabelaFaltando: true };
  }
  // Faxina de vez em quando: quem não aparece há mais de 30 dias sai da tabela.
  if (Math.random() < 0.02) {
    const velho = new Date(Date.now() - 30 * 86400_000).toISOString();
    void db().from("presenca_site").delete().lt("visto_em", velho).then(() => undefined, () => undefined);
  }
  return { online: (on.data ?? []).map(daLinha), visitasHoje: vis.count ?? 0, tabelaFaltando: false };
}

/** Quantas pessoas se cadastraram hoje no site (primeira matrícula, grátis ou paga). */
export async function cadastrosHoje(): Promise<number> {
  const hoje = inicioDeHoje();
  if (bancoEmDemonstracao) return 0;
  const { count, error } = await db().from("alunos").select("email", { count: "exact", head: true }).gte("criado_em", hoje);
  if (error) throw error;
  return count ?? 0;
}

/** Nome e celular de quem já é conhecido (aluno ou quem preencheu o checkout). */
export async function contatosPorEmail(emails: string[]): Promise<Map<string, { nome: string | null; telefone: string | null; cursoId?: string }>> {
  const r = new Map<string, { nome: string | null; telefone: string | null; cursoId?: string }>();
  if (!emails.length) return r;
  if (bancoEmDemonstracao) {
    const { lista } = await listarCarrinhos();
    for (const c of lista) if (emails.includes(c.email) && !r.has(c.email)) r.set(c.email, { nome: c.nome, telefone: c.telefone, cursoId: c.cursoId });
    return r;
  }
  const [al, ca] = await Promise.all([
    db().from("alunos").select("email, nome, telefone").in("email", emails),
    db().from("carrinhos").select("email, nome, telefone, curso_id, atualizado_em").in("email", emails).order("atualizado_em", { ascending: false }),
  ]);
  for (const c of ca.data ?? []) if (!r.has(c.email)) r.set(c.email, { nome: c.nome ?? null, telefone: c.telefone ?? null, cursoId: c.curso_id ?? undefined });
  for (const a of al.data ?? []) {
    const antes = r.get(a.email);
    r.set(a.email, { nome: a.nome ?? antes?.nome ?? null, telefone: a.telefone ?? antes?.telefone ?? null, cursoId: antes?.cursoId });
  }
  return r;
}
