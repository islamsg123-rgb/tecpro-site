import { urlSupabase } from "@/lib/supabase-url";
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Banco MÍNIMO do site (Supabase). Cadastro e matrículas ficam na Escola Avançada;
 * aqui só guardamos:
 *  - o vínculo entre o e-mail de login e o código do aluno na Escola Avançada;
 *  - as aulas concluídas.
 * Sem SUPABASE_SERVICE_ROLE_KEY, usa um banco de DEMONSTRAÇÃO em memória.
 */

const URL_SUPABASE = urlSupabase();
const CHAVE_SERVICO = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const bancoEmDemonstracao = !URL_SUPABASE || !CHAVE_SERVICO;

export const EMAIL_DEMO = "aluno@demo.tecpro";

const norm = (email: string) => email.trim().toLowerCase();

let cliente: SupabaseClient | null = null;
function db(): SupabaseClient {
  cliente ??= createClient(URL_SUPABASE!, CHAVE_SERVICO!, { auth: { persistSession: false } });
  return cliente;
}

/* ---------- Demonstração (memória) ---------- */
interface Memoria {
  configuracoes?: Map<string, ConfigCurso>;
  certificadosPagos?: Map<string, string>; // "email|curso" -> cobrança
  certificados?: Map<string, Certificado>; // código -> certificado
  alunos: Map<string, { eaUsuarioId: string; nome: string | null }>;
  progresso: Map<string, Set<string>>; // "email|curso" -> aulas concluídas
}
const g = globalThis as unknown as { __bancoDemo?: Memoria };
const mem: Memoria = (g.__bancoDemo ??= {
  alunos: new Map([[EMAIL_DEMO, { eaUsuarioId: "sim-demo", nome: "Aluno Demonstração" }]]),
  progresso: new Map([
    [`${EMAIL_DEMO}|101`, new Set(["Excel-1", "Excel-2", "Excel-3", "Excel-4", "Excel-5", "Excel-6", "Excel-7"])],
    [`${EMAIL_DEMO}|104`, new Set(["Design-1"])],
  ]),
});

/* ---------- Alunos ---------- */

export interface RegistroAluno {
  email: string;
  eaUsuarioId: string;
  nome: string | null;
}

export async function obterAluno(emailAluno: string): Promise<RegistroAluno | null> {
  const email = norm(emailAluno);
  if (bancoEmDemonstracao) {
    const a = mem.alunos.get(email);
    return a ? { email, ...a } : null;
  }
  const { data, error } = await db().from("alunos").select("email, ea_usuario_id, nome").eq("email", email).maybeSingle();
  if (error) throw error;
  return data ? { email: data.email, eaUsuarioId: data.ea_usuario_id, nome: data.nome } : null;
}

export async function salvarAluno(a: RegistroAluno): Promise<void> {
  const email = norm(a.email);
  if (bancoEmDemonstracao) {
    mem.alunos.set(email, { eaUsuarioId: a.eaUsuarioId, nome: a.nome });
    return;
  }
  const { error } = await db()
    .from("alunos")
    .upsert({ email, ea_usuario_id: a.eaUsuarioId, nome: a.nome }, { onConflict: "email" });
  if (error) throw error;
}

/* ---------- Progresso ---------- */

export async function aulasConcluidas(emailAluno: string, cursoId: string): Promise<Set<string>> {
  const email = norm(emailAluno);
  if (bancoEmDemonstracao) return new Set(mem.progresso.get(`${email}|${cursoId}`) ?? []);
  const { data, error } = await db().from("progresso").select("aula_id").eq("email", email).eq("curso_id", cursoId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.aula_id as string));
}

export async function definirAulaConcluida(emailAluno: string, cursoId: string, aulaId: string, concluida: boolean): Promise<void> {
  const email = norm(emailAluno);
  if (bancoEmDemonstracao) {
    const chave = `${email}|${cursoId}`;
    const s = mem.progresso.get(chave) ?? new Set<string>();
    if (concluida) s.add(aulaId);
    else s.delete(aulaId);
    mem.progresso.set(chave, s);
    return;
  }
  const t = db().from("progresso");
  const { error } = concluida
    ? await t.upsert({ email, curso_id: cursoId, aula_id: aulaId }, { onConflict: "email,curso_id,aula_id", ignoreDuplicates: true })
    : await t.delete().eq("email", email).eq("curso_id", cursoId).eq("aula_id", aulaId);
  if (error) throw error;
}

/* ---------- Certificados ---------- */

export interface Certificado {
  codigo: string;
  email: string;
  cursoId: string;
  nomeAluno: string;
  cursoNome: string;
  cargaHoraria: number;
  emitidoEm: string;
}

const certPagos = () => (mem.certificadosPagos ??= new Map());
const certs = () => (mem.certificados ??= new Map());

export async function registrarCertificadoPago(emailAluno: string, cursoId: string, cobrancaId: string): Promise<void> {
  const email = norm(emailAluno);
  if (bancoEmDemonstracao) {
    if (!certPagos().has(`${email}|${cursoId}`)) certPagos().set(`${email}|${cursoId}`, cobrancaId);
    return;
  }
  const { error } = await db()
    .from("certificados_pagos")
    .upsert({ email, curso_id: cursoId, cobranca_id: cobrancaId }, { onConflict: "email,curso_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function certificadoFoiPago(emailAluno: string, cursoId: string): Promise<boolean> {
  const email = norm(emailAluno);
  if (bancoEmDemonstracao) return certPagos().has(`${email}|${cursoId}`);
  const { data, error } = await db().from("certificados_pagos").select("email").eq("email", email).eq("curso_id", cursoId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

type LinhaCert = { codigo: string; email: string; curso_id: string; nome_aluno: string; curso_nome: string; carga_horaria: number; emitido_em: string };
const daLinha = (r: LinhaCert): Certificado => ({
  codigo: r.codigo, email: r.email, cursoId: r.curso_id, nomeAluno: r.nome_aluno,
  cursoNome: r.curso_nome, cargaHoraria: r.carga_horaria, emitidoEm: r.emitido_em,
});

export async function certificadoDoAluno(emailAluno: string, cursoId: string): Promise<Certificado | null> {
  const email = norm(emailAluno);
  if (bancoEmDemonstracao) return Array.from(certs().values()).find((c) => c.email === email && c.cursoId === cursoId) ?? null;
  const { data, error } = await db().from("certificados").select("*").eq("email", email).eq("curso_id", cursoId).maybeSingle();
  if (error) throw error;
  return data ? daLinha(data as LinhaCert) : null;
}

export async function certificadoPorCodigo(codigo: string): Promise<Certificado | null> {
  const c = codigo.trim().toUpperCase();
  if (bancoEmDemonstracao) return certs().get(c) ?? null;
  const { data, error } = await db().from("certificados").select("*").eq("codigo", c).maybeSingle();
  if (error) throw error;
  return data ? daLinha(data as LinhaCert) : null;
}

/** Grava o certificado. Se o aluno já tinha um para esse curso, devolve o existente. */
export async function gravarCertificado(c: Certificado): Promise<Certificado> {
  const existente = await certificadoDoAluno(c.email, c.cursoId);
  if (existente) return existente;
  const novo = { ...c, email: norm(c.email) };
  if (bancoEmDemonstracao) {
    certs().set(novo.codigo, novo);
    return novo;
  }
  const { error } = await db().from("certificados").insert({
    codigo: novo.codigo, email: novo.email, curso_id: novo.cursoId, nome_aluno: novo.nomeAluno,
    curso_nome: novo.cursoNome, carga_horaria: novo.cargaHoraria, emitido_em: novo.emitidoEm,
  });
  if (error) {
    if (error.code === "23505") return (await certificadoDoAluno(novo.email, novo.cursoId))!;
    throw error;
  }
  return novo;
}

/* ---------- Configurações do painel (por curso) ---------- */

export interface ConfigCurso {
  cursoId: string;
  /** null = usa o preço da Escola Avançada */
  precoCentavos: number | null;
  visivel: boolean;
  destaque: boolean;
  /** null = padrão do site (grátis) */
  certificadoModo: "gratis" | "pago" | null;
  certificadoPrecoCentavos: number | null;
}

// Demonstração: o curso 104 com certificado pago, para mostrar os dois casos.
const configs = () =>
  (mem.configuracoes ??= new Map([
    ["104", { cursoId: "104", precoCentavos: null, visivel: true, destaque: false, certificadoModo: "pago", certificadoPrecoCentavos: 2990 }],
  ]));

export async function configuracoesDosCursos(): Promise<Map<string, ConfigCurso>> {
  if (bancoEmDemonstracao) return new Map(configs());
  const { data, error } = await db().from("configuracoes_curso").select("*");
  if (error) {
    // Se o banco cair, a vitrine continua no ar com os dados da Escola Avançada.
    console.error("[dados] configuracoes_curso", error.message);
    return new Map();
  }
  return new Map(
    (data ?? []).map((r) => [
      r.curso_id as string,
      {
        cursoId: r.curso_id,
        precoCentavos: r.preco_centavos,
        visivel: r.visivel,
        destaque: r.destaque,
        certificadoModo: r.certificado_modo,
        certificadoPrecoCentavos: r.certificado_preco_centavos,
      } satisfies ConfigCurso,
    ]),
  );
}

export async function salvarConfiguracaoCurso(c: ConfigCurso): Promise<void> {
  if (bancoEmDemonstracao) {
    configs().set(c.cursoId, c);
    return;
  }
  const { error } = await db().from("configuracoes_curso").upsert(
    {
      curso_id: c.cursoId,
      preco_centavos: c.precoCentavos,
      visivel: c.visivel,
      destaque: c.destaque,
      certificado_modo: c.certificadoModo,
      certificado_preco_centavos: c.certificadoPrecoCentavos,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "curso_id" },
  );
  if (error) throw error;
}

/* ---------- Configurações gerais da loja ---------- */

export interface ConfigLoja {
  /** Prazo de acesso do aluno em meses; null = vitalício. */
  mesesDeAcesso: number | null;
}
const CONFIG_LOJA_PADRAO: ConfigLoja = { mesesDeAcesso: null };

const gLoja = globalThis as unknown as { __configLojaDemo?: ConfigLoja };

export async function obterConfigLoja(): Promise<ConfigLoja> {
  if (bancoEmDemonstracao) return { ...CONFIG_LOJA_PADRAO, ...gLoja.__configLojaDemo };
  const { data, error } = await db().from("configuracoes_loja").select("valor").eq("chave", "geral").maybeSingle();
  if (error) {
    console.error("[dados] configuracoes_loja", error.message);
    return CONFIG_LOJA_PADRAO;
  }
  return { ...CONFIG_LOJA_PADRAO, ...((data?.valor as Partial<ConfigLoja>) ?? {}) };
}

export async function salvarConfigLoja(c: ConfigLoja): Promise<void> {
  if (bancoEmDemonstracao) {
    gLoja.__configLojaDemo = c;
    return;
  }
  const { error } = await db()
    .from("configuracoes_loja")
    .upsert({ chave: "geral", valor: c, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
  if (error) throw error;
}

/* ---------- Registro das matrículas (para ver no painel sem abrir os logs da Vercel) ---------- */

export interface EventoMatricula {
  quando: string;
  etapa: string;
  ok: boolean;
  detalhe: string;
}
const LIMITE_EVENTOS = 40;
const gEventos = globalThis as unknown as { __eventosDemo?: EventoMatricula[] };

/** Guarda um evento (aviso do Asaas, resposta da Escola Avançada, erro). Nunca derruba quem chamou. */
export async function registrarEventoMatricula(etapa: string, ok: boolean, detalhe: string): Promise<void> {
  const ev: EventoMatricula = { quando: new Date().toISOString(), etapa, ok, detalhe: detalhe.slice(0, 600) };
  try {
    if (bancoEmDemonstracao) {
      gEventos.__eventosDemo = [ev, ...(gEventos.__eventosDemo ?? [])].slice(0, LIMITE_EVENTOS);
      return;
    }
    const atuais = await eventosMatricula();
    await db()
      .from("configuracoes_loja")
      .upsert(
        { chave: "eventos_matricula", valor: [ev, ...atuais].slice(0, LIMITE_EVENTOS), atualizado_em: ev.quando },
        { onConflict: "chave" },
      );
  } catch (e) {
    console.error("[dados] eventos_matricula", e instanceof Error ? e.message : e);
  }
}

export async function eventosMatricula(): Promise<EventoMatricula[]> {
  if (bancoEmDemonstracao) return gEventos.__eventosDemo ?? [];
  const { data } = await db().from("configuracoes_loja").select("valor").eq("chave", "eventos_matricula").maybeSingle();
  const lista = Array.isArray(data?.valor) ? (data.valor as EventoMatricula[]) : [];
  // Eventos antigos podem ter a senha devolvida por usuarios/novo: escondemos na leitura.
  return lista.map((e) => ({ ...e, detalhe: String(e.detalhe).replace(/("senha"\s*:\s*)("[^"]*"|[^,}\s]+)/gi, '$1"***"') }));
}

export interface AlunoListado extends RegistroAluno {
  criadoEm: string | null;
}

/** Alunos que já compraram pelo site (mais recentes primeiro). */
export async function listarAlunos(limite = 200): Promise<AlunoListado[]> {
  if (bancoEmDemonstracao) {
    return Array.from(mem.alunos, ([email, a]) => ({ email, ...a, criadoEm: null }));
  }
  const { data, error } = await db()
    .from("alunos")
    .select("email, ea_usuario_id, nome, criado_em")
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []).map((d) => ({ email: d.email, eaUsuarioId: d.ea_usuario_id, nome: d.nome, criadoEm: d.criado_em }));
}

/** Totais simples para a visão geral do painel. */
export async function contagens(): Promise<{ alunos: number; certificados: number }> {
  if (bancoEmDemonstracao) return { alunos: mem.alunos.size, certificados: certs().size };
  const [a, c] = await Promise.all([
    db().from("alunos").select("*", { count: "exact", head: true }),
    db().from("certificados").select("*", { count: "exact", head: true }),
  ]);
  return { alunos: a.count ?? 0, certificados: c.count ?? 0 };
}
