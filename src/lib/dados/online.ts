import "server-only";
import { bancoEmDemonstracao, db } from "./index";
import { listarCarrinhos } from "./carrinhos";
import { JANELA_ONLINE_MS, type LugarOnline } from "../online";
import type { Canal, OrigemVisita } from "../origem";
import { diaBR } from "../dias";

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

/** Quais (e-mail|curso_id) já têm certificado emitido: quem já tem não está "pagando o certificado". */
export async function certificadosEmitidos(emails: string[]): Promise<Set<string>> {
  if (!emails.length || bancoEmDemonstracao) return new Set();
  const { data } = await db().from("certificados").select("email, curso_id").in("email", emails);
  return new Set((data ?? []).map((r) => `${r.email}|${r.curso_id}`));
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

/* ---------- De onde vem o público (visitas por origem) ---------- */

/**
 * Tabela visitas_origem (supabase/migrations/0016_origens_visitas.sql = origens-publico.sql).
 * Uma linha por navegador, por dia, por origem. Sem a tabela, o site segue normal: só não guarda.
 */

export interface LinhaVisita {
  dia: string;
  visitante: string;
  canal: Canal;
  anuncio: boolean;
  campanha: string;
  site: string;
  entrada: string | null;
  email: string | null;
  criadoEm: string;
}
const gv = globalThis as unknown as { __visitasDemo?: LinhaVisita[] };
const visitasDemo = () => (gv.__visitasDemo ??= []);

export async function registrarVisita(visitante: string, email: string | null, o: OrigemVisita): Promise<void> {
  const linha: LinhaVisita = {
    dia: diaBR(), visitante, canal: o.canal, anuncio: o.anuncio, campanha: o.campanha ?? "", site: o.site ?? "",
    entrada: o.entrada ?? null, email, criadoEm: new Date().toISOString(),
  };
  if (bancoEmDemonstracao) {
    const lista = visitasDemo();
    const igual = (x: LinhaVisita) => x.dia === linha.dia && x.visitante === visitante && x.canal === linha.canal && x.anuncio === linha.anuncio && x.campanha === linha.campanha && x.site === linha.site;
    if (!lista.some(igual)) lista.push(linha);
    return;
  }
  const { error } = await db().from("visitas_origem").upsert(
    { dia: linha.dia, visitante, canal: linha.canal, anuncio: linha.anuncio, campanha: linha.campanha, site: linha.site, entrada: linha.entrada, email },
    { onConflict: "dia,visitante,canal,anuncio,campanha,site", ignoreDuplicates: true },
  );
  if (error) throw error;
}

export interface GrupoOrigem { canal: Canal; anuncio: boolean; campanha: string; site: string; visitas: number; pessoas: number }
export interface ResumoOrigens {
  tabelaFaltando: boolean;
  visitas: number;
  pessoas: number;
  grupos: GrupoOrigem[];
  dias: { dia: string; canal: Canal; visitas: number }[];
  entradas: { entrada: string; visitas: number }[];
}

/** Soma das visitas desde um dia ("AAAA-MM-DD", horário de Brasília), sem a equipe. */
export async function resumoOrigens(desde: string, excluir: string[]): Promise<ResumoOrigens> {
  if (bancoEmDemonstracao) {
    const v = visitasDemo().filter((x) => x.dia >= desde && !(x.email && excluir.includes(x.email)));
    const grupos = new Map<string, GrupoOrigem & { quem: Set<string> }>();
    const dias = new Map<string, { dia: string; canal: Canal; visitas: number }>();
    const entradas = new Map<string, number>();
    for (const x of v) {
      const k = [x.canal, x.anuncio, x.campanha, x.site].join("|");
      const g = grupos.get(k) ?? { canal: x.canal, anuncio: x.anuncio, campanha: x.campanha, site: x.site, visitas: 0, pessoas: 0, quem: new Set<string>() };
      g.visitas++;
      g.quem.add(x.visitante);
      g.pessoas = g.quem.size;
      grupos.set(k, g);
      const d = dias.get(`${x.dia}|${x.canal}`) ?? { dia: x.dia, canal: x.canal, visitas: 0 };
      d.visitas++;
      dias.set(`${x.dia}|${x.canal}`, d);
      if (x.entrada) entradas.set(x.entrada, (entradas.get(x.entrada) ?? 0) + 1);
    }
    return {
      tabelaFaltando: false,
      visitas: v.length,
      pessoas: new Set(v.map((x) => x.visitante)).size,
      grupos: [...grupos.values()].map(({ quem: _q, ...g }) => g).sort((a, b) => b.visitas - a.visitas),
      dias: [...dias.values()].sort((a, b) => a.dia.localeCompare(b.dia)),
      entradas: [...entradas].map(([entrada, visitas]) => ({ entrada, visitas })).sort((a, b) => b.visitas - a.visitas),
    };
  }
  const { data, error } = await db().rpc("resumo_origens", { p_desde: desde, p_excluir: excluir });
  if (error || !data) {
    if (error) console.error("[origens]", error.message);
    return { tabelaFaltando: true, visitas: 0, pessoas: 0, grupos: [], dias: [], entradas: [] };
  }
  // Faxina de vez em quando: visitas com mais de 400 dias saem da tabela.
  if (Math.random() < 0.02) {
    const velho = new Date(Date.now() - 400 * 86400_000).toISOString().slice(0, 10);
    void db().from("visitas_origem").delete().lt("dia", velho).then(() => undefined, () => undefined);
  }
  const d = data as { visitas: number; pessoas: number; grupos: GrupoOrigem[]; dias: { dia: string; canal: Canal; visitas: number }[]; entradas: { entrada: string; visitas: number }[] };
  const num = (n: unknown) => Number(n) || 0;
  return {
    tabelaFaltando: false,
    visitas: num(d.visitas),
    pessoas: num(d.pessoas),
    grupos: (d.grupos ?? []).map((g) => ({ ...g, visitas: num(g.visitas), pessoas: num(g.pessoas) })),
    dias: (d.dias ?? []).map((x) => ({ ...x, visitas: num(x.visitas) })),
    entradas: (d.entradas ?? []).map((x) => ({ ...x, visitas: num(x.visitas) })),
  };
}

/** De onde veio quem está online agora: a origem mais recente de hoje de cada visitante. */
export async function origemDosOnline(visitantes: string[]): Promise<Map<string, { canal: Canal; anuncio: boolean }>> {
  const r = new Map<string, { canal: Canal; anuncio: boolean }>();
  if (!visitantes.length) return r;
  const hoje = diaBR();
  if (bancoEmDemonstracao) {
    for (const x of visitasDemo()) if (x.dia === hoje && visitantes.includes(x.visitante)) r.set(x.visitante, { canal: x.canal, anuncio: x.anuncio });
    return r;
  }
  const { data, error } = await db().from("visitas_origem").select("visitante, canal, anuncio, criado_em").eq("dia", hoje).in("visitante", visitantes.slice(0, 500)).order("criado_em", { ascending: true });
  if (error) return r;
  for (const x of data ?? []) r.set(String(x.visitante), { canal: x.canal as Canal, anuncio: Boolean(x.anuncio) });
  return r;
}
