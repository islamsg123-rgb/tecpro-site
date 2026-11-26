import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { bancoEmDemonstracao, db, EMAIL_DEMO, listarAlunos } from "./dados";

/** Lê uma tabela inteira em páginas de 1000 linhas (o Supabase não devolve mais que isso por vez). */
async function lerTudo(
  consulta: (de: number, ate: number) => PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let de = 0; de < 1_000_000; de += 1000) {
    const { data, error } = await consulta(de, de + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
import { getCursos, getModulos } from "./cursos";
import { listarCarrinhos } from "./dados/carrinhos";
import { telefonesDemonstracao } from "./dados/painel";
import { emailConfigurado, emailLembrete, emailNuncaComecou, enviarEmail } from "./email";
import { SITE_OFICIAL } from "./site";
import { diasDesde } from "./dias";

/**
 * Lembretes de estudo: quando o aluno começou um curso, não terminou e ficou alguns dias
 * sem estudar, o site manda um e-mail chamando de volta.
 *
 *  - Só 3 lembretes por "parada" (padrão: 3, 7 e 14 dias). Depois disso, para.
 *  - Se o aluno voltar a estudar, a contagem recomeça do zero.
 *  - Curso concluído, curso removido pelo painel, aluno excluído ou descadastrado: não recebe.
 *  - No máximo 1 e-mail por pessoa a cada 2 dias, mesmo com vários cursos parados.
 *  - Também (liga separado no painel): matriculados que nunca abriram uma aula (padrão: 1, 3 e 7 dias).
 * Roda todo dia sozinho (Cron da Vercel, vercel.json) e também pelo botão do painel.
 * Tabelas: supabase/migrations/0010_lembretes_estudo.sql.
 */

const norm = (e: string) => e.trim().toLowerCase();
const DIA = 86_400_000;

/* ---------- Configuração (painel > Alunos > Lembretes de estudo) ---------- */

export interface ConfigLembretes {
  ligado: boolean;
  /** Dias sem estudar para mandar o 1º, 2º e 3º lembrete */
  dias: [number, number, number];
  /** Quem parou há mais tempo que isso não recebe (evita mandar para quem sumiu há meses no dia em que ligar) */
  limiteDias: number;
  /** Máximo de e-mails por dia (o plano grátis do Resend manda até 100 por dia) */
  maximoPorDia: number;
  /** Mensagem pronta do botão "Chamar no WhatsApp" */
  mensagemWhatsapp: string;
  /** Matriculados que nunca abriram uma aula (dias contados da matrícula) */
  nuncaComecou: GrupoExtra;
  /** E-mails do certificado (não dependem da rodada das 10h) */
  certificado: ConfigCertificado;
}

export interface ConfigCertificado {
  /** Parabéns + importância do certificado para quem concluiu e não comprou */
  ligado: boolean;
  /** Quantas horas depois de ver a tela do certificado sem comprar */
  horas: number;
  /** Manda o certificado em PDF por e-mail assim que é emitido */
  entrega: boolean;
  /** 2º e-mail (convite para emitir), X dias depois de concluir, se ainda não emitiu */
  segundo: EtapaCertificado;
  /** 3º e-mail (último aviso), X dias depois de concluir, se ainda não emitiu */
  terceiro: EtapaCertificado;
}

export interface EtapaCertificado {
  ligado: boolean;
  dias: number;
}

export interface GrupoExtra {
  ligado: boolean;
  dias: [number, number, number];
  mensagemWhatsapp: string;
}

/** Tipo de lembrete: aluno parado no meio do curso ou matriculado que nunca começou. */
export type TipoLembrete = "parado" | "nunca";
export const NOME_TIPO: Record<TipoLembrete, string> = { parado: "Parou de estudar", nunca: "Nunca começou" };

export const MENSAGEM_WHATSAPP_PADRAO =
  "Oi, {nome}! Tudo bem? Aqui é da Tecpro Multi Ensino 😊\n\n" +
  "Vi que você já fez {progresso} do curso *{curso}* e está há {dias} dias sem estudar. Você está indo muito bem, não pare agora!\n\n" +
  "Que tal separar 15 minutinhos hoje? É só continuar de onde parou: {link}\n\n" +
  "Se tiver qualquer dificuldade, me chama aqui que eu te ajudo.";

export const MENSAGEM_WHATSAPP_NUNCA =
  "Oi, {nome}! Tudo bem? Aqui é da Tecpro Multi Ensino 😊\n\n" +
  "Seu curso *{curso}* já está liberado faz {dias} dias, mas vi que você ainda não assistiu à primeira aula. Aconteceu alguma coisa? Conseguiu entrar?\n\n" +
  "É só entrar aqui com o seu e-mail: {link}\n\n" +
  "Se tiver qualquer dificuldade, me chama aqui que eu te ajudo.";

export const CONFIG_LEMBRETES_PADRAO: ConfigLembretes = {
  ligado: false, dias: [3, 7, 14], limiteDias: 45, maximoPorDia: 90, mensagemWhatsapp: MENSAGEM_WHATSAPP_PADRAO,
  nuncaComecou: { ligado: false, dias: [1, 3, 7], mensagemWhatsapp: MENSAGEM_WHATSAPP_NUNCA },
  certificado: { ligado: true, horas: 1, entrega: true, segundo: { ligado: true, dias: 1 }, terceiro: { ligado: true, dias: 7 } },
};

/** Junta o que está salvo com o padrão (configurações antigas não têm os grupos novos). */
function completar(c: Partial<ConfigLembretes> | undefined): ConfigLembretes {
  const p = CONFIG_LEMBRETES_PADRAO;
  return {
    ...p, ...c,
    nuncaComecou: { ...p.nuncaComecou, ...c?.nuncaComecou },
    certificado: {
      ...p.certificado, ...c?.certificado,
      segundo: { ...p.certificado.segundo, ...c?.certificado?.segundo },
      terceiro: { ...p.certificado.terceiro, ...c?.certificado?.terceiro },
    },
  };
}

const gMem = globalThis as unknown as {
  __lembretesDemo?: { config?: ConfigLembretes; registros: RegistroLembrete[]; descadastro: Set<string>; seq: number; ultima?: UltimaRodada };
};
const mem = () => (gMem.__lembretesDemo ??= { registros: [], descadastro: new Set(), seq: 1 });

export async function obterConfigLembretes(): Promise<ConfigLembretes> {
  if (bancoEmDemonstracao) return completar(mem().config);
  const { data, error } = await db().from("configuracoes_loja").select("valor").eq("chave", "lembretes").maybeSingle();
  if (error) return CONFIG_LEMBRETES_PADRAO;
  return completar((data?.valor as Partial<ConfigLembretes>) ?? undefined);
}

export async function salvarConfigLembretes(c: ConfigLembretes): Promise<void> {
  if (bancoEmDemonstracao) {
    mem().config = c;
    return;
  }
  const { error } = await db()
    .from("configuracoes_loja")
    .upsert({ chave: "lembretes", valor: c, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
  if (error) throw error;
}

/* ---------- Registro dos lembretes ---------- */

export interface RegistroLembrete {
  id: number;
  tipo: TipoLembrete;
  email: string;
  nome: string | null;
  cursoId: string;
  cursoNome: string | null;
  etapa: number;
  diasParado: number;
  progressoPct: number | null;
  /** Data de referência: última aula (parado), matrícula (nunca começou)  */
  ultimaAtividade: string;
  status: "enviado" | "erro";
  detalhe: string | null;
  enviadoEm: string;
}

const daLinha = (r: Record<string, unknown>): RegistroLembrete => ({
  id: Number(r.id), tipo: ((r.tipo as TipoLembrete) ?? "parado"), email: String(r.email), nome: (r.nome as string) ?? null, cursoId: String(r.curso_id),
  cursoNome: (r.curso_nome as string) ?? null, etapa: Number(r.etapa), diasParado: Number(r.dias_parado),
  progressoPct: r.progresso_pct == null ? null : Number(r.progresso_pct), ultimaAtividade: String(r.ultima_atividade),
  status: r.status as "enviado" | "erro", detalhe: (r.detalhe as string) ?? null, enviadoEm: String(r.enviado_em),
});

/** Lembretes dos últimos `dias` dias (mais recentes primeiro). `tabelaFaltando` = o SQL ainda não foi rodado. */
export async function listarLembretes(dias = 120, limite = 100_000): Promise<{ lista: RegistroLembrete[]; tabelaFaltando: boolean }> {
  const desde = new Date(Date.now() - dias * DIA).toISOString();
  if (bancoEmDemonstracao) {
    return { lista: mem().registros.filter((r) => r.enviadoEm >= desde).sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm)).slice(0, limite), tabelaFaltando: false };
  }
  try {
    const consulta = () => db().from("lembretes_estudo").select("*").gte("enviado_em", desde).order("enviado_em", { ascending: false }).order("id");
    let linhas: Record<string, unknown>[];
    if (limite <= 1000) {
      const { data, error } = await consulta().limit(limite);
      if (error) throw error;
      linhas = data ?? [];
    } else {
      linhas = await lerTudo((de, ate) => consulta().range(de, ate));
    }
    return { lista: linhas.map(daLinha), tabelaFaltando: false };
  } catch {
    return { lista: [], tabelaFaltando: true };
  }
}

async function registrar(r: Omit<RegistroLembrete, "id" | "enviadoEm">): Promise<void> {
  if (bancoEmDemonstracao) {
    mem().registros.push({ ...r, id: mem().seq++, enviadoEm: new Date().toISOString() });
    return;
  }
  const { error } = await db().from("lembretes_estudo").insert({
    // Sem a coluna "tipo" (SQL lembretes-novos-alunos.sql não rodado), os lembretes de parados continuam funcionando.
    ...(r.tipo !== "parado" ? { tipo: r.tipo } : {}),
    email: r.email, nome: r.nome, curso_id: r.cursoId, curso_nome: r.cursoNome, etapa: r.etapa, dias_parado: r.diasParado,
    progresso_pct: r.progressoPct, ultima_atividade: r.ultimaAtividade, status: r.status, detalhe: r.detalhe?.slice(0, 500) ?? null,
  });
  if (error) throw new Error(`Não deu para gravar o registro do lembrete: ${error.message}`);
}

/** true quando falta rodar o SQL que cria a coluna "tipo" (lembretes para quem nunca começou). */
export async function faltaSqlTipos(): Promise<boolean> {
  if (bancoEmDemonstracao) return false;
  const { error } = await db().from("lembretes_estudo").select("tipo").limit(1);
  return Boolean(error);
}

/* ---------- Descadastro (LGPD) ---------- */

export async function descadastrados(): Promise<Set<string>> {
  if (bancoEmDemonstracao) return new Set(mem().descadastro);
  const linhas = await lerTudo((de, ate) => db().from("lembretes_descadastro").select("email").order("email").range(de, ate)).catch((e) => {
    throw new Error(`Tabela de lembretes não encontrada (rode o SQL lembretes-estudo.sql no Supabase): ${e.message}`);
  });
  return new Set(linhas.map((r) => String(r.email)));
}

export async function definirDescadastro(email: string, sair: boolean): Promise<void> {
  const e = norm(email);
  if (bancoEmDemonstracao) {
    if (sair) mem().descadastro.add(e);
    else mem().descadastro.delete(e);
    return;
  }
  const t = db().from("lembretes_descadastro");
  const { error } = sair ? await t.upsert({ email: e }, { onConflict: "email", ignoreDuplicates: true }) : await t.delete().eq("email", e);
  if (error) throw error;
}

/** Assinatura do link de descadastro: só quem recebeu o e-mail consegue sair da lista daquele endereço. */
function assinatura(email: string): string {
  const segredo = process.env.LEMBRETES_SEGREDO || process.env.SUPABASE_SERVICE_ROLE_KEY || "tecpro-demo";
  return createHmac("sha256", segredo).update(`lembretes:${norm(email)}`).digest("base64url").slice(0, 32);
}

export function assinaturaValida(email: string, t: string): boolean {
  const a = Buffer.from(assinatura(email));
  const b = Buffer.from(String(t));
  return a.length === b.length && timingSafeEqual(a, b);
}

export const linkDescadastro = (email: string, base = SITE_OFICIAL) =>
  `${base}/lembretes/sair?e=${encodeURIComponent(norm(email))}&t=${assinatura(email)}`;

export const linkContinuar = (slug: string, base = SITE_OFICIAL) => `${base}/continuar/${encodeURIComponent(slug)}`;

/* ---------- Quem está parado ---------- */

export interface AlunoParado {
  email: string;
  nome: string | null;
  telefone: string | null;
  cursoId: string;
  cursoNome: string;
  cursoSlug: string;
  feitas: number;
  total: number;
  pct: number;
  ultimaAtividade: string;
  diasParado: number;
}

/**
 * Cursos começados e não concluídos, com os dias sem estudar (do mais recente para o mais antigo).
 * Lê a tabela de progresso inteira em páginas de 1000 linhas.
 */
type Progresso = Map<string, { aulas: Set<string>; ultima: string }>;

/** Progresso de todos os alunos: "email|curso" -> aulas concluídas e data da última atividade. */
async function lerProgresso(): Promise<Progresso> {
  const porPar: Progresso = new Map();
  const somar = (email: string, cursoId: string, aulaId: string, quando: string) => {
    const k = `${norm(email)}|${cursoId}`;
    const p = porPar.get(k) ?? { aulas: new Set<string>(), ultima: quando };
    if (!aulaId.includes("#")) p.aulas.add(aulaId);
    if (quando > p.ultima) p.ultima = quando;
    porPar.set(k, p);
  };

  if (bancoEmDemonstracao) {
    // Demonstração: o aluno de teste parou há 8 dias no curso de Excel.
    const g = globalThis as unknown as { __bancoDemo?: { progresso: Map<string, Set<string>> } };
    const oito = new Date(Date.now() - 8 * DIA).toISOString();
    for (const [k, s] of g.__bancoDemo?.progresso ?? []) {
      const [email, curso] = k.split("|");
      for (const a of s) somar(email, curso, a, oito);
    }
  } else {
    for (let de = 0; de < 500_000; de += 1000) {
      const { data, error } = await db()
        .from("progresso").select("email, curso_id, aula_id, concluida_em")
        .order("email").order("curso_id").order("aula_id").range(de, de + 999);
      if (error) throw error;
      for (const r of data ?? []) somar(String(r.email), String(r.curso_id), String(r.aula_id), String(r.concluida_em));
      if (!data || data.length < 1000) break;
    }
  }
  return porPar;
}

export async function cursosParados(minimoDias = 1, progresso?: Progresso): Promise<AlunoParado[]> {
  const porPar = progresso ?? (await lerProgresso());

  const [alunos, cursos, removidos, telefones] = await Promise.all([
    todosAlunos(), getCursos(), todosCursosRemovidos(), telefonesDosAlunos(),
  ]);
  const aluno = new Map(alunos.map((a) => [norm(a.email), a]));

  const candidatos = Array.from(porPar.entries()).flatMap(([k, p]) => {
    const [email, cursoId] = k.split("|");
    const dias = diasDesde(p.ultima) ?? 0;
    if (dias < minimoDias || !aluno.has(email) || removidos.has(k)) return [];
    const curso = cursos.find((c) => c.id === cursoId);
    return curso ? [{ email, cursoId, curso, p, dias }] : [];
  });

  // Total de aulas de cada curso (poucos cursos por vez).
  const totais = new Map<string, string[]>();
  const ids = Array.from(new Set(candidatos.map((c) => c.cursoId)));
  for (let i = 0; i < ids.length; i += 8) {
    await Promise.all(ids.slice(i, i + 8).map(async (id) => {
      const mods = await getModulos(id).catch(() => []);
      totais.set(id, mods.flatMap((m) => m.aulas.map((a) => a.id)));
    }));
  }

  const out: AlunoParado[] = [];
  for (const c of candidatos) {
    const aulas = totais.get(c.cursoId) ?? [];
    if (!aulas.length) continue;
    const feitas = aulas.filter((a) => c.p.aulas.has(a)).length;
    if (feitas >= aulas.length) continue; // curso concluído
    const a = aluno.get(c.email)!;
    out.push({
      email: c.email, nome: a.nome, telefone: telefones.get(c.email) ?? null,
      cursoId: c.cursoId, cursoNome: c.curso.nome, cursoSlug: c.curso.slug,
      feitas, total: aulas.length, pct: Math.round((feitas / aulas.length) * 100),
      ultimaAtividade: c.p.ultima, diasParado: c.dias,
    });
  }
  return out.sort((x, y) => x.diasParado - y.diasParado);
}

async function todosAlunos(): Promise<{ email: string; nome: string | null }[]> {
  if (bancoEmDemonstracao) return listarAlunos();
  const linhas = await lerTudo((de, ate) => db().from("alunos").select("email, nome").order("email").range(de, ate));
  return linhas.map((r) => ({ email: String(r.email), nome: (r.nome as string) ?? null }));
}

async function todosCursosRemovidos(): Promise<Set<string>> {
  if (bancoEmDemonstracao) {
    const g = globalThis as unknown as { __painelDemo?: { removidos: Map<string, string> } };
    return new Set(g.__painelDemo?.removidos.keys() ?? []);
  }
  const linhas = await lerTudo((de, ate) => db().from("cursos_removidos").select("email, curso_id").order("email").order("curso_id").range(de, ate)).catch(() => []);
  return new Set(linhas.map((r) => `${norm(String(r.email))}|${r.curso_id}`));
}

/** Telefone do aluno: o da ficha; se não tiver, o que ele digitou no checkout. */
export async function telefonesDosAlunos(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (bancoEmDemonstracao) return telefonesDemonstracao();
  const [carr, fichas] = await Promise.all([
    lerTudo((de, ate) => db().from("carrinhos").select("email, telefone, criado_em").not("telefone", "is", null).order("criado_em", { ascending: false }).order("email").range(de, ate)).catch(() => []),
    lerTudo((de, ate) => db().from("alunos").select("email, telefone").not("telefone", "is", null).order("email").range(de, ate)).catch(() => []),
  ]);
  for (const r of carr) if (r.telefone && !out.has(norm(String(r.email)))) out.set(norm(String(r.email)), String(r.telefone));
  for (const r of fichas) if (r.telefone) out.set(norm(String(r.email)), String(r.telefone));
  return out;
}

/* ---------- Quem se matriculou e nunca começou ---------- */

export interface PessoaSemAula {
  email: string;
  nome: string | null;
  telefone: string | null;
  cursoId: string;
  cursoNome: string;
  cursoSlug: string;
  gratuito: boolean;
  /** Data da matrícula */
  desde: string;
  dias: number;
}

interface LinhaCarrinho { email: string; cursoId: string; nome: string | null; telefone: string | null; etapa: string; criadoEm: string; atualizadoEm: string }

async function carrinhosDeCurso(): Promise<LinhaCarrinho[]> {
  if (bancoEmDemonstracao) {
    const { lista } = await listarCarrinhos(5000);
    return lista.filter((c) => c.tipo === "curso").map((c) => ({ ...c, email: norm(c.email) }));
  }
  const linhas = await lerTudo((de, ate) =>
    db().from("carrinhos").select("email, curso_id, nome, telefone, etapa, criado_em, atualizado_em").eq("tipo", "curso")
      .order("email").order("curso_id").range(de, ate)).catch(() => []);
  return linhas.map((r) => ({
    email: norm(String(r.email)), cursoId: String(r.curso_id), nome: (r.nome as string) ?? null, telefone: (r.telefone as string) ?? null,
    etapa: String(r.etapa), criadoEm: String(r.criado_em), atualizadoEm: String(r.atualizado_em),
  }));
}

/**
 * Matriculados pelo site (inscrição concluída) que não abriram nenhuma aula daquele curso.
 * O curso de cada pessoa vem da inscrição feita no site (alunos cadastrados só pelo painel ficam de fora).
 */
export async function semAula(minimoDias = 1, progresso?: Progresso): Promise<{ nunca: PessoaSemAula[] }> {
  const [porPar, carrinhos, alunos, cursos, removidos, telefones] = await Promise.all([
    progresso ?? lerProgresso(), carrinhosDeCurso(), todosAlunos(), getCursos(), todosCursosRemovidos(), telefonesDosAlunos(),
  ]);
  const aluno = new Map(alunos.map((a) => [norm(a.email), a]));
  const nunca: PessoaSemAula[] = [];
  for (const c of carrinhos) {
    const curso = cursos.find((x) => x.id === c.cursoId);
    if (!curso) continue;
    if (c.etapa !== "pago" && c.etapa !== "matriculado") continue;
    const desde = c.atualizadoEm;
    const dias = diasDesde(desde) ?? 0;
    if (dias < minimoDias) continue;
    const base = {
      email: c.email, telefone: telefones.get(c.email) ?? c.telefone, cursoId: c.cursoId, cursoNome: curso.nome, cursoSlug: curso.slug,
      gratuito: curso.gratuito, desde, dias,
    };
    const a = aluno.get(c.email);
    if (!a || porPar.has(`${c.email}|${c.cursoId}`) || removidos.has(`${c.email}|${c.cursoId}`)) continue;
    nunca.push({ ...base, nome: a.nome ?? c.nome });
  }
  const ordem = (x: PessoaSemAula, y: PessoaSemAula) => x.dias - y.dias;
  return { nunca: nunca.sort(ordem) };
}

/* ---------- Envio ---------- */

/** Qual lembrete (1, 2 ou 3) cabe para quem está há `dias` sem estudar. 0 = nenhum. */
export function etapaPara(dias: number, cfg: ConfigLembretes, tipo: TipoLembrete = "parado"): number {
  const lista = tipo === "parado" ? cfg.dias : cfg.nuncaComecou.dias;
  let etapa = 0;
  lista.forEach((d, i) => { if (dias >= d) etapa = i + 1; });
  return dias > cfg.limiteDias ? 0 : etapa;
}

export interface ResultadoRodada {
  enviados: number;
  erros: number;
  pulados: string[];
  detalhes: string[];
}

export interface UltimaRodada extends ResultadoRodada {
  quando: string;
  origem: "automatico" | "painel";
  erroGeral: string | null;
}

export async function ultimaRodada(): Promise<UltimaRodada | null> {
  if (bancoEmDemonstracao) return mem().ultima ?? null;
  const { data } = await db().from("configuracoes_loja").select("valor").eq("chave", "lembretes_ultima_rodada").maybeSingle();
  return (data?.valor as UltimaRodada) ?? null;
}

/** Roda os lembretes do dia (Cron da Vercel, todo dia, e botão "Rodar agora" do painel) e guarda o resumo. */
export async function rodarLembretes(origem: UltimaRodada["origem"], base = SITE_OFICIAL): Promise<UltimaRodada> {
  let r: ResultadoRodada = { enviados: 0, erros: 0, pulados: [], detalhes: [] };
  let erroGeral: string | null = null;
  try {
    r = await rodada(base);
  } catch (e) {
    erroGeral = e instanceof Error ? e.message : String(e);
    console.error("[lembretes]", erroGeral);
  }
  const u: UltimaRodada = { ...r, detalhes: r.detalhes.slice(0, 20), quando: new Date().toISOString(), origem, erroGeral };
  if (bancoEmDemonstracao) mem().ultima = u;
  else {
    await db().from("configuracoes_loja")
      .upsert({ chave: "lembretes_ultima_rodada", valor: u, atualizado_em: u.quando }, { onConflict: "chave" })
      .then(({ error }) => error && console.error("[lembretes] ultima rodada", error.message));
  }
  return u;
}

interface Envio {
  tipo: TipoLembrete;
  email: string;
  nome: string | null;
  cursoId: string;
  cursoNome: string;
  referencia: string;
  dias: number;
  pct: number | null;
  montar: (etapa: number) => { assunto: string; html: string; texto: string };
}

async function rodada(base: string): Promise<ResultadoRodada> {
  const cfg = await obterConfigLembretes();
  const r: ResultadoRodada = { enviados: 0, erros: 0, pulados: [], detalhes: [] };
  const extras = cfg.nuncaComecou.ligado;
  if (!cfg.ligado && !extras) {
    r.pulados.push("Lembretes desligados no painel.");
    return r;
  }
  if (!emailConfigurado) {
    r.pulados.push("RESEND_API_KEY não está na Vercel: nenhum e-mail pode ser enviado.");
    return r;
  }
  const progresso = await lerProgresso();
  const [parados, sem, sairam, { lista: historico, tabelaFaltando }, faltaTipo] = await Promise.all([
    cfg.ligado ? cursosParados(Math.min(...cfg.dias), progresso) : Promise.resolve([]),
    extras ? semAula(1, progresso) : Promise.resolve({ nunca: [] }),
    descadastrados(), listarLembretes(Math.max(cfg.limiteDias, 30) + 30), extras ? faltaSqlTipos() : Promise.resolve(false),
  ]);
  if (tabelaFaltando) throw new Error("Tabela de lembretes não encontrada: rode o SQL lembretes-estudo.sql no Supabase.");

  const sair = (email: string) => linkDescadastro(email, base);
  // Ordem de prioridade: quem parou no meio do curso, depois quem nunca começou.
  const fila: Envio[] = [
    ...parados.map((p): Envio => ({
      tipo: "parado", email: p.email, nome: p.nome, cursoId: p.cursoId, cursoNome: p.cursoNome, referencia: p.ultimaAtividade, dias: p.diasParado, pct: p.pct,
      montar: (etapa) => emailLembrete({
        nome: p.nome ?? "", curso: p.cursoNome, pct: p.pct, feitas: p.feitas, total: p.total, dias: p.diasParado, etapa,
        linkContinuar: linkContinuar(p.cursoSlug, base), linkSair: sair(p.email),
      }),
    })),
  ];
  if (extras && faltaTipo) {
    r.pulados.push("Lembretes para quem nunca começou: falta rodar o SQL lembretes-novos-alunos.sql no Supabase.");
  } else {
    if (cfg.nuncaComecou.ligado) {
      fila.push(...sem.nunca.map((p): Envio => ({
        tipo: "nunca", email: p.email, nome: p.nome, cursoId: p.cursoId, cursoNome: p.cursoNome, referencia: p.desde, dias: p.dias, pct: 0,
        montar: (etapa) => emailNuncaComecou({ nome: p.nome ?? "", curso: p.cursoNome, dias: p.dias, etapa, link: linkContinuar(p.cursoSlug, base), linkSair: sair(p.email) }),
      })));
    }
  }

  const enviados = historico.filter((h) => h.status === "enviado");
  const chaveEnvio = (tipo: string, email: string, curso: string, etapa: number, ref: string) => `${tipo}|${email}|${curso}|${etapa}|${new Date(ref).getTime()}`;
  const jaFoi = new Set(enviados.map((h) => chaveEnvio(h.tipo, h.email, h.cursoId, h.etapa, h.ultimaAtividade)));
  const ultimoPorAluno = new Map<string, number>();
  for (const h of enviados) ultimoPorAluno.set(h.email, Math.max(ultimoPorAluno.get(h.email) ?? 0, new Date(h.enviadoEm).getTime()));

  // Um e-mail por pessoa por rodada, e no máximo um a cada 2 dias.
  const vistos = new Set<string>();
  for (const p of fila) {
    if (r.enviados + r.erros >= cfg.maximoPorDia) {
      r.pulados.push(`Limite de ${cfg.maximoPorDia} e-mails por dia atingido; o resto fica para amanhã.`);
      break;
    }
    if (vistos.has(p.email) || sairam.has(p.email) || (p.email === EMAIL_DEMO && !bancoEmDemonstracao)) continue;
    const etapa = etapaPara(p.dias, cfg, p.tipo);
    if (!etapa) continue;
    if (jaFoi.has(chaveEnvio(p.tipo, p.email, p.cursoId, etapa, p.referencia))) continue;
    if (Date.now() - (ultimoPorAluno.get(p.email) ?? 0) < 2 * DIA - 3_600_000) continue;
    vistos.add(p.email);

    const email = p.montar(etapa);
    let status: "enviado" | "erro" = "enviado";
    let detalhe: string | null = null;
    try {
      await enviarEmail({ para: p.email, ...email, cabecalhos: { "List-Unsubscribe": `<${sair(p.email)}>` }, tipo: p.tipo === "nunca" ? "nunca_comecou" : "lembrete", curso: p.cursoNome });
      r.enviados++;
    } catch (e) {
      status = "erro";
      detalhe = e instanceof Error ? e.message : String(e);
      r.erros++;
      r.detalhes.push(`${p.email}: ${detalhe}`);
    }
    await registrar({
      tipo: p.tipo, email: p.email, nome: p.nome, cursoId: p.cursoId, cursoNome: p.cursoNome, etapa, diasParado: p.dias,
      progressoPct: p.pct, ultimaAtividade: p.referencia, status, detalhe,
    });
    // O Resend aceita no máximo 2 e-mails por segundo.
    await new Promise((ok) => setTimeout(ok, 600));
  }
  return r;
}

/** E-mail com dados de exemplo (prévia e teste do painel). */
export function emailDeExemplo(tipo: TipoLembrete, etapa: number, cfg: ConfigLembretes, nome: string, emailSair: string) {
  const linkSair = linkDescadastro(emailSair);
  if (tipo === "nunca") {
    return emailNuncaComecou({ nome, curso: "Excel Avançado", dias: cfg.nuncaComecou.dias[etapa - 1], etapa, link: linkContinuar("excel-avancado"), linkSair });
  }
  return emailLembrete({
    nome, curso: "Excel Avançado", pct: 40 + etapa * 5, feitas: 8 + etapa, total: 20, dias: cfg.dias[etapa - 1], etapa,
    linkContinuar: linkContinuar("excel-avancado"), linkSair,
  });
}

/** As três listas do painel, lendo o progresso uma vez só. */
export async function listasDoPainel(cfg: ConfigLembretes) {
  const progresso = await lerProgresso();
  const [parados, sem] = await Promise.all([cursosParados(Math.min(...cfg.dias), progresso), semAula(1, progresso)]);
  return { parados, ...sem };
}
