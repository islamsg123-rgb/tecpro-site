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
export function db(): SupabaseClient {
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
  etapas?: Map<string, Date>; // "email|curso|aula#etapa" -> quando
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

/* ---------- Etapas da aula (vídeo assistido, prova aprovada) ----------
 * Guardadas na mesma tabela "progresso", com o id da aula seguido de "#etapa"
 * (ex.: "123#video"). Assim não é preciso criar tabela nova no banco.
 * Essas linhas não contam como aula concluída, porque o site só conta ids de aulas reais. */

export type EtapaAula = "inicio" | "video" | "prova";
const ETAPAS: EtapaAula[] = ["inicio", "video", "prova"];

export async function etapasDaAula(emailAluno: string, cursoId: string, aulaId: string): Promise<Partial<Record<EtapaAula, Date>>> {
  const email = norm(emailAluno);
  const out: Partial<Record<EtapaAula, Date>> = {};
  if (bancoEmDemonstracao) {
    for (const e of ETAPAS) {
      const d = mem.etapas?.get(`${email}|${cursoId}|${aulaId}#${e}`);
      if (d) out[e] = d;
    }
    return out;
  }
  const { data, error } = await db()
    .from("progresso")
    .select("aula_id, concluida_em")
    .eq("email", email)
    .eq("curso_id", cursoId)
    .in("aula_id", ETAPAS.map((e) => `${aulaId}#${e}`));
  if (error) throw error;
  for (const r of data ?? []) {
    const e = String(r.aula_id).split("#").pop() as EtapaAula;
    out[e] = new Date(r.concluida_em as string);
  }
  return out;
}

/** Registra uma etapa (só a primeira vez; a data fica a do primeiro registro). */
export async function marcarEtapa(emailAluno: string, cursoId: string, aulaId: string, etapa: EtapaAula): Promise<void> {
  const email = norm(emailAluno);
  if (bancoEmDemonstracao) {
    mem.etapas ??= new Map();
    const k = `${email}|${cursoId}|${aulaId}#${etapa}`;
    if (!mem.etapas.has(k)) mem.etapas.set(k, new Date());
    return;
  }
  const { error } = await db()
    .from("progresso")
    .upsert({ email, curso_id: cursoId, aula_id: `${aulaId}#${etapa}` }, { onConflict: "email,curso_id,aula_id", ignoreDuplicates: true });
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
  await salvarConfiguracoesCursos([c]);
}

/** Salva vários cursos de uma vez (uma só chamada ao banco). */
export async function salvarConfiguracoesCursos(lista: ConfigCurso[]): Promise<void> {
  if (!lista.length) return;
  if (bancoEmDemonstracao) {
    for (const c of lista) configs().set(c.cursoId, c);
    return;
  }
  const agora = new Date().toISOString();
  const { error } = await db().from("configuracoes_curso").upsert(
    lista.map((c) => ({
      curso_id: c.cursoId,
      preco_centavos: c.precoCentavos,
      visivel: c.visivel,
      destaque: c.destaque,
      certificado_modo: c.certificadoModo,
      certificado_preco_centavos: c.certificadoPrecoCentavos,
      atualizado_em: agora,
    })),
    { onConflict: "curso_id" },
  );
  if (error) throw error;
}

/* ---------- Configurações gerais da loja ---------- */

export interface ConfigLoja {
  /** Prazo de acesso do aluno em meses; null = vitalício. */
  mesesDeAcesso: number | null;
  /** Mostra o botão "Avaliar" (pesquisa de satisfação) nas aulas. */
  pesquisaNasAulas: boolean;
  /** Mostra os depoimentos na página inicial. */
  mostrarDepoimentos: boolean;
  /** Contatos mostrados no rodapé do site (vazio = não mostra). */
  whatsapp: string;
  emailContato: string;
  instagram: string;
  /** Preços da emissão de certificado nos cursos gratuitos, em centavos. */
  precoCertIndividual: number;
  precoCertEssencial: number;
  precoCertProfissional: number;
  /** Onde os pagamentos são processados. Se o escolhido não tiver chave na Vercel, usa o outro. */
  gateway: "mercadopago" | "asaas";
  /** Vídeo de parabéns na última aula de todos os cursos: arquivo do site (/video/parabens.mp4), .mp4, Panda ou YouTube. Vazio = sem vídeo. */
  videoParabens?: string;
  /** Código do Google: Analytics (G-XXXXXXX) ou Tag Manager (GTM-XXXXXXX). Vazio = desligado. */
  googleAnalyticsId?: string;
}
const CONFIG_LOJA_PADRAO: ConfigLoja = {
  gateway: "mercadopago",
  mesesDeAcesso: null, pesquisaNasAulas: true, mostrarDepoimentos: true, whatsapp: "", emailContato: "", instagram: "",
  precoCertIndividual: 3790, precoCertEssencial: 8990, precoCertProfissional: 12990,
  videoParabens: "/video/parabens.mp4",
  googleAnalyticsId: "GTM-M8V8THNK", // contêiner do Google Tag Manager da Tecpro (enviado pelo dono em 2026-11-26)
};

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

/* ---------- Cursos gratuitos ----------
 * Guardados em configuracoes_loja (chave "cursos_gratuitos"), assim não é preciso mudar o banco. */

const gGratis = globalThis as unknown as { __gratisDemo?: string[] };

export async function cursosGratuitos(): Promise<Set<string>> {
  if (bancoEmDemonstracao) return new Set(gGratis.__gratisDemo ?? []);
  const { data, error } = await db().from("configuracoes_loja").select("valor").eq("chave", "cursos_gratuitos").maybeSingle();
  if (error) {
    console.error("[dados] cursos_gratuitos", error.message);
    return new Set();
  }
  return new Set(Array.isArray(data?.valor) ? (data.valor as string[]).map(String) : []);
}

export async function definirCursoGratuito(cursoId: string, gratuito: boolean): Promise<void> {
  const atual = await cursosGratuitos();
  if (gratuito === atual.has(cursoId)) return;
  if (gratuito) atual.add(cursoId);
  else atual.delete(cursoId);
  await definirCursosGratuitos(Array.from(atual));
}

/** Substitui a lista inteira de cursos gratuitos. */
export async function definirCursosGratuitos(ids: string[]): Promise<void> {
  const lista = Array.from(new Set(ids.map(String))).sort();
  if (bancoEmDemonstracao) {
    gGratis.__gratisDemo = lista;
    return;
  }
  const { error } = await db()
    .from("configuracoes_loja")
    .upsert({ chave: "cursos_gratuitos", valor: lista, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
  if (error) throw error;
}

/* ---------- Relatórios do painel ---------- */

export interface Atividade {
  email: string;
  cursoId: string;
  /** id da aula, ou "id#etapa" (inicio, video, prova) */
  aulaId: string;
  quando: string;
}

/** Tudo o que o aluno fez nas aulas (aulas concluídas e etapas), mais recente primeiro. */
export async function atividadesDoAluno(emailAluno: string): Promise<Atividade[]> {
  const email = norm(emailAluno);
  if (bancoEmDemonstracao) {
    const out: Atividade[] = [];
    for (const [k, aulas] of mem.progresso) {
      const [e, cursoId] = k.split("|");
      if (e === email) for (const aulaId of aulas) out.push({ email, cursoId, aulaId, quando: new Date().toISOString() });
    }
    for (const [k, d] of mem.etapas ?? []) {
      const [e, cursoId, aulaId] = k.split("|");
      if (e === email) out.push({ email, cursoId, aulaId, quando: d.toISOString() });
    }
    return out.sort((a, b) => b.quando.localeCompare(a.quando));
  }
  const { data, error } = await db()
    .from("progresso")
    .select("curso_id, aula_id, concluida_em")
    .eq("email", email)
    .order("concluida_em", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data ?? []).map((r) => ({ email, cursoId: r.curso_id, aulaId: r.aula_id, quando: r.concluida_em }));
}

/** Data da última atividade de cada aluno nas aulas (para achar quem parou de estudar). */
export async function ultimaAtividadePorAluno(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (bancoEmDemonstracao) {
    for (const email of mem.alunos.keys()) {
      const a = await atividadesDoAluno(email);
      if (a[0]) out.set(email, a[0].quando);
    }
    return out;
  }
  // Lê do mais recente para o mais antigo: a primeira linha de cada aluno é a última atividade.
  // O Supabase devolve no máximo 1000 linhas por vez: lemos em páginas.
  for (let de = 0; de < 200_000; de += 1000) {
    const { data, error } = await db()
      .from("progresso").select("email, concluida_em")
      .order("concluida_em", { ascending: false }).order("email").order("aula_id").range(de, de + 999);
    if (error) throw error;
    for (const r of data ?? []) if (!out.has(r.email)) out.set(r.email, r.concluida_em);
    if (!data || data.length < 1000) break;
  }
  return out;
}

export interface CertificadoListado extends Certificado {}

/** Certificados emitidos (mais recentes primeiro). */
export async function listarCertificados(limite = 500): Promise<Certificado[]> {
  if (bancoEmDemonstracao) return Array.from(certs().values()).sort((a, b) => b.emitidoEm.localeCompare(a.emitidoEm));
  const { data, error } = await db().from("certificados").select("*").order("emitido_em", { ascending: false }).limit(limite);
  if (error) throw error;
  return (data ?? []).map((r) => daLinha(r as LinhaCert));
}

/** Certificados pagos (cobrança confirmada), emitidos ou não. */
export async function listarCertificadosPagos(): Promise<{ email: string; cursoId: string; cobrancaId: string; pagoEm: string }[]> {
  if (bancoEmDemonstracao) {
    return Array.from(certPagos(), ([k, cobrancaId]) => {
      const [email, cursoId] = k.split("|");
      return { email, cursoId, cobrancaId, pagoEm: new Date().toISOString() };
    }).filter((p) => !p.cursoId.startsWith(PREFIXO_CREDITO));
  }
  const { data, error } = await db().from("certificados_pagos").select("*").order("pago_em", { ascending: false }).limit(1000);
  if (error) throw error;
  return (data ?? [])
    .filter((r) => !String(r.curso_id).startsWith(PREFIXO_CREDITO))
    .map((r) => ({ email: r.email, cursoId: r.curso_id, cobrancaId: r.cobranca_id, pagoEm: r.pago_em }));
}

/* ---------- Créditos de certificado (pacotes) ----------
 * Quem compra um pacote de 3 ou 5 certificados usa 1 no curso em que comprou e fica com o resto como crédito.
 * Cada crédito é uma linha em "certificados_pagos" com curso_id = "credito:<cobrança>:<n>" (não precisa de tabela nova).
 * Usar um crédito = trocar o curso_id dessa linha pelo curso de verdade. */

export const PREFIXO_CREDITO = "credito:";

/** Guarda N créditos de uma cobrança. Pode ser chamada de novo (aviso repetido do Asaas) sem duplicar. */
export async function registrarCreditos(emailAluno: string, cobrancaId: string, quantidade: number): Promise<void> {
  const email = norm(emailAluno);
  if (quantidade < 1) return;
  const linhas = Array.from({ length: quantidade }, (_, i) => `${PREFIXO_CREDITO}${cobrancaId}:${i + 1}`);
  if (bancoEmDemonstracao) {
    for (const l of linhas) if (!certPagos().has(`${email}|${l}`)) certPagos().set(`${email}|${l}`, cobrancaId);
    return;
  }
  const { error } = await db()
    .from("certificados_pagos")
    .upsert(linhas.map((curso_id) => ({ email, curso_id, cobranca_id: cobrancaId })), { onConflict: "email,curso_id", ignoreDuplicates: true });
  if (error) throw error;
}

async function linhasDeCredito(email: string): Promise<string[]> {
  if (bancoEmDemonstracao) {
    return Array.from(certPagos().keys()).filter((k) => k.startsWith(`${email}|${PREFIXO_CREDITO}`)).map((k) => k.split("|")[1]);
  }
  const { data, error } = await db().from("certificados_pagos").select("curso_id").eq("email", email).like("curso_id", `${PREFIXO_CREDITO}%`);
  if (error) throw error;
  return (data ?? []).map((r) => String(r.curso_id));
}

/** Quantos certificados o aluno ainda pode emitir com os pacotes que comprou. */
export async function saldoCreditos(emailAluno: string): Promise<number> {
  return (await linhasDeCredito(norm(emailAluno))).length;
}

/** Usa 1 crédito para liberar o certificado de um curso. Devolve false se não havia crédito. */
export async function usarCredito(emailAluno: string, cursoId: string): Promise<boolean> {
  const email = norm(emailAluno);
  if (await certificadoFoiPago(email, cursoId)) return true;
  for (const linha of await linhasDeCredito(email)) {
    if (bancoEmDemonstracao) {
      const cobranca = certPagos().get(`${email}|${linha}`)!;
      certPagos().delete(`${email}|${linha}`);
      certPagos().set(`${email}|${cursoId}`, cobranca);
      return true;
    }
    // Troca o "curso" da linha de crédito pelo curso de verdade. Se outra aba usou o mesmo crédito, tenta o próximo.
    const { data, error } = await db()
      .from("certificados_pagos").update({ curso_id: cursoId, pago_em: new Date().toISOString() })
      .eq("email", email).eq("curso_id", linha).select("curso_id");
    if (error) {
      if (error.code === "23505") return true; // o curso já estava pago
      throw error;
    }
    if (data?.length) return true;
  }
  return false;
}

/** Quantas aulas cada aluno concluiu em cada curso ("email|curso" -> quantidade). Só aulas reais, sem as etapas. */
export async function aulasConcluidasPorAlunoCurso(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (bancoEmDemonstracao) {
    for (const [k, s] of mem.progresso) out.set(k, s.size);
    return out;
  }
  // O Supabase devolve no máximo 1000 linhas por vez: lemos em páginas.
  const data: { email: string; curso_id: string }[] = [];
  for (let de = 0; de < 200_000; de += 1000) {
    const { data: pag, error } = await db()
      .from("progresso").select("email, curso_id, aula_id").not("aula_id", "like", "%#%")
      .order("email").order("curso_id").order("aula_id").range(de, de + 999);
    if (error) throw error;
    data.push(...(pag ?? []));
    if (!pag || pag.length < 1000) break;
  }
  for (const r of data) {
    const k = `${r.email}|${r.curso_id}`;
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

export interface LinhaProgresso {
  email: string;
  cursoId: string;
  /** id da aula, ou "id#etapa" (inicio, video, prova), ou "#teste" */
  aulaId: string;
  quando: string;
}

/** Todas as linhas de progresso (aulas e etapas), com data. Usado no progresso dos alunos (painel). */
export async function todasAsLinhasDeProgresso(): Promise<LinhaProgresso[]> {
  if (bancoEmDemonstracao) {
    const out: LinhaProgresso[] = [];
    const agora = new Date().toISOString();
    for (const [k, aulas] of mem.progresso) {
      const [email, cursoId] = k.split("|");
      for (const aulaId of aulas) out.push({ email, cursoId, aulaId, quando: agora });
    }
    for (const [k, d] of mem.etapas ?? []) {
      const [email, cursoId, aulaId] = k.split("|");
      out.push({ email, cursoId, aulaId, quando: d.toISOString() });
    }
    return out;
  }
  // O Supabase devolve no máximo 1000 linhas por vez: lemos em páginas.
  const out: LinhaProgresso[] = [];
  for (let de = 0; de < 500_000; de += 1000) {
    const { data, error } = await db()
      .from("progresso").select("email, curso_id, aula_id, concluida_em")
      .order("email").order("curso_id").order("aula_id").range(de, de + 999);
    if (error) throw error;
    for (const r of data ?? []) out.push({ email: r.email, cursoId: r.curso_id, aulaId: r.aula_id, quando: r.concluida_em });
    if (!data || data.length < 1000) break;
  }
  return out;
}
