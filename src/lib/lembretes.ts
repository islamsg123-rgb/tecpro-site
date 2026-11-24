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
import { telefonesDemonstracao } from "./dados/painel";
import { emailConfigurado, emailLembrete, enviarEmail } from "./email";
import { SITE_OFICIAL } from "./site";

/**
 * Lembretes de estudo: quando o aluno começou um curso, não terminou e ficou alguns dias
 * sem estudar, o site manda um e-mail chamando de volta.
 *
 *  - Só 3 lembretes por "parada" (padrão: 3, 7 e 14 dias). Depois disso, para.
 *  - Se o aluno voltar a estudar, a contagem recomeça do zero.
 *  - Curso concluído, curso removido pelo painel, aluno excluído ou descadastrado: não recebe.
 *  - No máximo 1 e-mail por aluno a cada 3 dias, mesmo com vários cursos parados.
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
}

export const MENSAGEM_WHATSAPP_PADRAO =
  "Oi, {nome}! Tudo bem? Aqui é da Tecpro Multi Ensino 😊\n\n" +
  "Vi que você já fez {progresso} do curso *{curso}* e está há {dias} dias sem estudar. Você está indo muito bem, não pare agora!\n\n" +
  "Que tal separar 15 minutinhos hoje? É só continuar de onde parou: {link}\n\n" +
  "Se tiver qualquer dificuldade, me chama aqui que eu te ajudo.";

export const CONFIG_LEMBRETES_PADRAO: ConfigLembretes = {
  ligado: false, dias: [3, 7, 14], limiteDias: 45, maximoPorDia: 90, mensagemWhatsapp: MENSAGEM_WHATSAPP_PADRAO,
};

const gMem = globalThis as unknown as {
  __lembretesDemo?: { config?: ConfigLembretes; registros: RegistroLembrete[]; descadastro: Set<string>; seq: number; ultima?: UltimaRodada };
};
const mem = () => (gMem.__lembretesDemo ??= { registros: [], descadastro: new Set(), seq: 1 });

export async function obterConfigLembretes(): Promise<ConfigLembretes> {
  if (bancoEmDemonstracao) return { ...CONFIG_LEMBRETES_PADRAO, ...mem().config };
  const { data, error } = await db().from("configuracoes_loja").select("valor").eq("chave", "lembretes").maybeSingle();
  if (error) return CONFIG_LEMBRETES_PADRAO;
  return { ...CONFIG_LEMBRETES_PADRAO, ...((data?.valor as Partial<ConfigLembretes>) ?? {}) };
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
  email: string;
  nome: string | null;
  cursoId: string;
  cursoNome: string | null;
  etapa: number;
  diasParado: number;
  progressoPct: number | null;
  ultimaAtividade: string;
  status: "enviado" | "erro";
  detalhe: string | null;
  enviadoEm: string;
}

const daLinha = (r: Record<string, unknown>): RegistroLembrete => ({
  id: Number(r.id), email: String(r.email), nome: (r.nome as string) ?? null, cursoId: String(r.curso_id),
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
    email: r.email, nome: r.nome, curso_id: r.cursoId, curso_nome: r.cursoNome, etapa: r.etapa, dias_parado: r.diasParado,
    progresso_pct: r.progressoPct, ultima_atividade: r.ultimaAtividade, status: r.status, detalhe: r.detalhe?.slice(0, 500) ?? null,
  });
  if (error) throw new Error(`Não deu para gravar o registro do lembrete: ${error.message}`);
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
export async function cursosParados(minimoDias = 1): Promise<AlunoParado[]> {
  const porPar = new Map<string, { aulas: Set<string>; ultima: string }>();
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

  const [alunos, cursos, removidos, telefones] = await Promise.all([
    todosAlunos(), getCursos(), todosCursosRemovidos(), telefonesDosAlunos(),
  ]);
  const aluno = new Map(alunos.map((a) => [norm(a.email), a]));
  const agora = Date.now();

  const candidatos = Array.from(porPar.entries()).flatMap(([k, p]) => {
    const [email, cursoId] = k.split("|");
    const dias = Math.floor((agora - new Date(p.ultima).getTime()) / DIA);
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

/* ---------- Envio ---------- */

/** Qual lembrete (1, 2 ou 3) cabe para quem está há `dias` sem estudar. 0 = nenhum. */
export function etapaPara(dias: number, cfg: ConfigLembretes): number {
  let etapa = 0;
  cfg.dias.forEach((d, i) => { if (dias >= d) etapa = i + 1; });
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

async function rodada(base: string): Promise<ResultadoRodada> {
  const cfg = await obterConfigLembretes();
  const r: ResultadoRodada = { enviados: 0, erros: 0, pulados: [], detalhes: [] };
  if (!cfg.ligado) {
    r.pulados.push("Lembretes desligados no painel.");
    return r;
  }
  if (!emailConfigurado) {
    r.pulados.push("RESEND_API_KEY não está na Vercel: nenhum e-mail pode ser enviado.");
    return r;
  }
  const [parados, sairam, { lista: historico, tabelaFaltando }] = await Promise.all([
    cursosParados(Math.min(...cfg.dias)), descadastrados(), listarLembretes(Math.max(cfg.limiteDias, 30) + 30),
  ]);
  if (tabelaFaltando) throw new Error("Tabela de lembretes não encontrada: rode o SQL lembretes-estudo.sql no Supabase.");

  const enviados = historico.filter((h) => h.status === "enviado");
  const jaFoi = new Set(enviados.map((h) => `${h.email}|${h.cursoId}|${h.etapa}|${new Date(h.ultimaAtividade).getTime()}`));
  const ultimoPorAluno = new Map<string, number>();
  for (const h of enviados) ultimoPorAluno.set(h.email, Math.max(ultimoPorAluno.get(h.email) ?? 0, new Date(h.enviadoEm).getTime()));

  // Um curso por aluno: o que ele estudou mais recentemente (os parados vêm do mais recente para o mais antigo).
  const vistos = new Set<string>();
  for (const p of parados) {
    if (r.enviados + r.erros >= cfg.maximoPorDia) {
      r.pulados.push(`Limite de ${cfg.maximoPorDia} e-mails por dia atingido; o resto fica para amanhã.`);
      break;
    }
    if (vistos.has(p.email) || sairam.has(p.email) || (p.email === EMAIL_DEMO && !bancoEmDemonstracao)) continue;
    const etapa = etapaPara(p.diasParado, cfg);
    if (!etapa) continue;
    if (jaFoi.has(`${p.email}|${p.cursoId}|${etapa}|${new Date(p.ultimaAtividade).getTime()}`)) continue;
    if (Date.now() - (ultimoPorAluno.get(p.email) ?? 0) < 3 * DIA - 3_600_000) continue;
    vistos.add(p.email);

    const email = emailLembrete({
      nome: p.nome ?? "", curso: p.cursoNome, pct: p.pct, feitas: p.feitas, total: p.total, dias: p.diasParado, etapa,
      linkContinuar: linkContinuar(p.cursoSlug, base), linkSair: linkDescadastro(p.email, base),
    });
    let status: "enviado" | "erro" = "enviado";
    let detalhe: string | null = null;
    try {
      await enviarEmail({ para: p.email, ...email, cabecalhos: { "List-Unsubscribe": `<${linkDescadastro(p.email, base)}>` } });
      r.enviados++;
    } catch (e) {
      status = "erro";
      detalhe = e instanceof Error ? e.message : String(e);
      r.erros++;
      r.detalhes.push(`${p.email}: ${detalhe}`);
    }
    await registrar({
      email: p.email, nome: p.nome, cursoId: p.cursoId, cursoNome: p.cursoNome, etapa, diasParado: p.diasParado,
      progressoPct: p.pct, ultimaAtividade: p.ultimaAtividade, status, detalhe,
    });
    // O Resend aceita no máximo 2 e-mails por segundo.
    await new Promise((ok) => setTimeout(ok, 600));
  }
  return r;
}
