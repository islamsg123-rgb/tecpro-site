import "server-only";
import { bancoEmDemonstracao, db } from "./index";

/**
 * Funcionários, pesquisa de satisfação, depoimentos, dados extras do aluno e cursos removidos.
 * Tabelas criadas por supabase/migrations/0007_painel_completo.sql.
 * Enquanto o SQL não for rodado, as leituras devolvem listas vazias com `tabelaFaltando: true`
 * e o resto do site continua funcionando.
 */

const norm = (email: string) => email.trim().toLowerCase();
type Linha = Record<string, unknown>;

interface Mem {
  funcionarios: Map<string, Funcionario>;
  pesquisas: Pesquisa[];
  depoimentos: Depoimento[];
  removidos: Map<string, string>; // "email|curso" -> quando
  extras: Map<string, DadosExtrasAluno>;
  seq: number;
}
const g = globalThis as unknown as { __painelDemo?: Mem };
const mem = (): Mem =>
  (g.__painelDemo ??= {
    funcionarios: new Map(),
    pesquisas: [],
    depoimentos: [
      { id: 1, nome: "Maria Souza", detalhe: "Aluna de Auxiliar Administrativo", texto: "Fiz o curso pelo celular, no meu tempo, e consegui meu primeiro emprego na área. Recomendo demais!", foto: null, ativo: true, ordem: 0, criadoEm: new Date().toISOString() },
    ],
    removidos: new Map(),
    extras: new Map(),
    seq: 10,
  });

/* ---------- Funcionários ---------- */

/** Seções do painel que podem ser liberadas para um funcionário. */
export const SECOES = {
  financeiro: "Financeiro (valores e vendas)",
  vendas: "Vendas (carrinhos e cupons)",
  alunos: "Alunos",
  cursos: "Cursos",
  loja: "Loja virtual",
  funcionarios: "Funcionários",
  mensagens: "Mensagens",
} as const;
export type Secao = keyof typeof SECOES;
export const LISTA_SECOES = Object.keys(SECOES) as Secao[];

export interface Funcionario {
  email: string;
  nome: string;
  permissoes: Secao[];
  ativo: boolean;
  criadoEm: string;
}

const funcDaLinha = (r: Linha): Funcionario => ({
  email: String(r.email), nome: String(r.nome ?? ""),
  permissoes: ((r.permissoes as string[]) ?? []).filter((p): p is Secao => p in SECOES),
  ativo: Boolean(r.ativo), criadoEm: String(r.criado_em),
});

export async function listarFuncionarios(): Promise<{ lista: Funcionario[]; tabelaFaltando: boolean }> {
  if (bancoEmDemonstracao) return { lista: Array.from(mem().funcionarios.values()), tabelaFaltando: false };
  const { data, error } = await db().from("funcionarios").select("*").order("nome");
  if (error) {
    console.error("[funcionarios]", error.message);
    return { lista: [], tabelaFaltando: true };
  }
  return { lista: (data ?? []).map(funcDaLinha), tabelaFaltando: false };
}

export async function obterFuncionario(email: string): Promise<Funcionario | null> {
  const e = norm(email);
  if (bancoEmDemonstracao) return mem().funcionarios.get(e) ?? null;
  const { data, error } = await db().from("funcionarios").select("*").eq("email", e).maybeSingle();
  if (error) return null; // tabela ainda não criada: ninguém além do dono entra
  return data ? funcDaLinha(data) : null;
}

export async function salvarFuncionario(f: Omit<Funcionario, "criadoEm">): Promise<void> {
  const email = norm(f.email);
  if (bancoEmDemonstracao) {
    const antigo = mem().funcionarios.get(email);
    mem().funcionarios.set(email, { ...f, email, criadoEm: antigo?.criadoEm ?? new Date().toISOString() });
    return;
  }
  const { error } = await db().from("funcionarios").upsert(
    { email, nome: f.nome, permissoes: f.permissoes, ativo: f.ativo },
    { onConflict: "email" },
  );
  if (error) throw error;
}

export async function apagarFuncionario(email: string): Promise<void> {
  if (bancoEmDemonstracao) {
    mem().funcionarios.delete(norm(email));
    return;
  }
  const { error } = await db().from("funcionarios").delete().eq("email", norm(email));
  if (error) throw error;
}

/* ---------- Pesquisa de satisfação ---------- */

export interface Pesquisa {
  id: number;
  email: string;
  nome: string | null;
  cursoId: string | null;
  cursoNome: string | null;
  aulaTitulo: string | null;
  nota: number;
  recomenda: number | null;
  comentario: string | null;
  criadoEm: string;
}

const pesqDaLinha = (r: Linha): Pesquisa => ({
  id: Number(r.id), email: String(r.email), nome: (r.nome as string) ?? null, cursoId: (r.curso_id as string) ?? null,
  cursoNome: (r.curso_nome as string) ?? null, aulaTitulo: (r.aula_titulo as string) ?? null, nota: Number(r.nota),
  recomenda: r.recomenda == null ? null : Number(r.recomenda), comentario: (r.comentario as string) ?? null, criadoEm: String(r.criado_em),
});

export async function registrarPesquisa(p: Omit<Pesquisa, "id" | "criadoEm">): Promise<void> {
  if (bancoEmDemonstracao) {
    const m = mem();
    m.pesquisas.unshift({ ...p, email: norm(p.email), id: ++m.seq, criadoEm: new Date().toISOString() });
    return;
  }
  const { error } = await db().from("pesquisas").insert({
    email: norm(p.email), nome: p.nome, curso_id: p.cursoId, curso_nome: p.cursoNome, aula_titulo: p.aulaTitulo,
    nota: p.nota, recomenda: p.recomenda, comentario: p.comentario,
  });
  if (error) throw error;
}

export async function listarPesquisas(limite = 1000): Promise<{ lista: Pesquisa[]; tabelaFaltando: boolean }> {
  if (bancoEmDemonstracao) return { lista: mem().pesquisas.slice(0, limite), tabelaFaltando: false };
  const { data, error } = await db().from("pesquisas").select("*").order("criado_em", { ascending: false }).limit(limite);
  if (error) {
    console.error("[pesquisas]", error.message);
    return { lista: [], tabelaFaltando: true };
  }
  return { lista: (data ?? []).map(pesqDaLinha), tabelaFaltando: false };
}

export async function apagarPesquisa(id: number): Promise<void> {
  if (bancoEmDemonstracao) {
    mem().pesquisas = mem().pesquisas.filter((p) => p.id !== id);
    return;
  }
  const { error } = await db().from("pesquisas").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Depoimentos ---------- */

export interface Depoimento {
  id: number;
  nome: string;
  detalhe: string | null;
  texto: string;
  foto: string | null;
  ativo: boolean;
  ordem: number;
  criadoEm: string;
}

const depDaLinha = (r: Linha): Depoimento => ({
  id: Number(r.id), nome: String(r.nome), detalhe: (r.detalhe as string) ?? null, texto: String(r.texto),
  foto: (r.foto as string) ?? null, ativo: Boolean(r.ativo), ordem: Number(r.ordem ?? 0), criadoEm: String(r.criado_em),
});

const ordenar = (l: Depoimento[]) => l.sort((a, b) => a.ordem - b.ordem || b.criadoEm.localeCompare(a.criadoEm));

export async function listarDepoimentos(soAtivos = false): Promise<{ lista: Depoimento[]; tabelaFaltando: boolean }> {
  if (bancoEmDemonstracao) {
    return { lista: ordenar(mem().depoimentos.filter((d) => !soAtivos || d.ativo)), tabelaFaltando: false };
  }
  let q = db().from("depoimentos").select("*");
  if (soAtivos) q = q.eq("ativo", true);
  const { data, error } = await q.order("ordem").order("criado_em", { ascending: false });
  if (error) {
    console.error("[depoimentos]", error.message);
    return { lista: [], tabelaFaltando: true };
  }
  return { lista: (data ?? []).map(depDaLinha), tabelaFaltando: false };
}

export async function salvarDepoimento(d: Omit<Depoimento, "id" | "criadoEm"> & { id?: number }): Promise<void> {
  if (bancoEmDemonstracao) {
    const m = mem();
    if (d.id) m.depoimentos = m.depoimentos.map((x) => (x.id === d.id ? { ...x, ...d, id: x.id } : x));
    else m.depoimentos.push({ ...d, id: ++m.seq, criadoEm: new Date().toISOString() });
    return;
  }
  const linha = { nome: d.nome, detalhe: d.detalhe, texto: d.texto, foto: d.foto, ativo: d.ativo, ordem: d.ordem };
  const { error } = d.id
    ? await db().from("depoimentos").update(linha).eq("id", d.id)
    : await db().from("depoimentos").insert(linha);
  if (error) throw error;
}

export async function obterDepoimento(id: number): Promise<Depoimento | null> {
  if (bancoEmDemonstracao) return mem().depoimentos.find((d) => d.id === id) ?? null;
  const { data } = await db().from("depoimentos").select("*").eq("id", id).maybeSingle();
  return data ? depDaLinha(data) : null;
}

export async function apagarDepoimento(id: number): Promise<void> {
  if (bancoEmDemonstracao) {
    mem().depoimentos = mem().depoimentos.filter((d) => d.id !== id);
    return;
  }
  const { error } = await db().from("depoimentos").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Dados extras do aluno ---------- */

export interface DadosExtrasAluno {
  telefone: string | null;
  cpf: string | null;
  observacoes: string | null;
  cidade?: string | null;
  estado?: string | null;
}

/** Modo demonstração: celulares digitados na ficha (para testar os botões de WhatsApp). */
export function telefonesDemonstracao(): Map<string, string> {
  const out = new Map<string, string>();
  for (const [e, d] of mem().extras) if (d.telefone) out.set(e, d.telefone);
  return out;
}

export async function dadosExtrasAluno(email: string): Promise<DadosExtrasAluno & { colunasFaltando: boolean }> {
  const e = norm(email);
  if (bancoEmDemonstracao) return { telefone: null, cpf: null, observacoes: null, ...mem().extras.get(e), colunasFaltando: false };
  const [{ data, error }, local] = await Promise.all([
    db().from("alunos").select("telefone, cpf, observacoes").eq("email", e).maybeSingle(),
    db().from("alunos").select("cidade, estado").eq("email", e).maybeSingle(),
  ]);
  const cidade = local.error ? null : (local.data?.cidade ?? null);
  const estado = local.error ? null : (local.data?.estado ?? null);
  if (error) return { telefone: null, cpf: null, observacoes: null, cidade, estado, colunasFaltando: true };
  return {
    telefone: data?.telefone ?? null, cpf: data?.cpf ?? null, observacoes: data?.observacoes ?? null, cidade, estado,
    colunasFaltando: Boolean(local.error),
  };
}

export async function salvarDadosAluno(email: string, d: DadosExtrasAluno & { nome: string | null }): Promise<void> {
  const e = norm(email);
  if (bancoEmDemonstracao) {
    mem().extras.set(e, { ...mem().extras.get(e), telefone: d.telefone, cpf: d.cpf, observacoes: d.observacoes, ...(d.cidade !== undefined ? { cidade: d.cidade, estado: d.estado } : {}) });
    const g2 = globalThis as unknown as { __bancoDemo?: { alunos: Map<string, { eaUsuarioId: string; nome: string | null }> } };
    const a = g2.__bancoDemo?.alunos.get(e);
    if (a) a.nome = d.nome;
    return;
  }
  const { error } = await db().from("alunos").update({ nome: d.nome, telefone: d.telefone, cpf: d.cpf, observacoes: d.observacoes }).eq("email", e);
  if (error) {
    // Sem o SQL novo, ao menos o nome é salvo.
    const { error: e2 } = await db().from("alunos").update({ nome: d.nome }).eq("email", e);
    if (e2) throw e2;
    throw new Error("colunas");
  }
  if (d.cidade !== undefined) await salvarLocalidadeAluno(e, d.cidade ?? null, d.estado ?? null);
}

/** Guarda CPF e celular informados no cadastro (para não pedir de novo no pagamento do certificado). */
export async function salvarContatoAluno(email: string, cpf: string, telefone: string): Promise<void> {
  const e = norm(email);
  if (bancoEmDemonstracao) {
    mem().extras.set(e, { observacoes: null, ...mem().extras.get(e), cpf, telefone });
    return;
  }
  const { error } = await db().from("alunos").update({ cpf, telefone }).eq("email", e);
  if (error) throw new Error("colunas");
}

/** Guarda cidade e estado do aluno. Sem o SQL 0008, dá erro "colunas". */
export async function salvarLocalidadeAluno(email: string, cidade: string | null, estado: string | null): Promise<void> {
  const e = norm(email);
  if (bancoEmDemonstracao) {
    mem().extras.set(e, { telefone: null, cpf: null, observacoes: null, ...mem().extras.get(e), cidade, estado });
    return;
  }
  const { error } = await db().from("alunos").update({ cidade, estado }).eq("email", e);
  if (error) throw new Error("colunas");
}

/** Cidade e estado de todos os alunos (para a planilha). Vazio se o SQL 0008 não foi rodado. */
export async function localidadesDosAlunos(): Promise<Map<string, { cidade: string | null; estado: string | null }>> {
  const m = new Map<string, { cidade: string | null; estado: string | null }>();
  if (bancoEmDemonstracao) {
    for (const [e, x] of mem().extras) m.set(e, { cidade: x.cidade ?? null, estado: x.estado ?? null });
    return m;
  }
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db().from("alunos").select("email, cidade, estado").range(de, de + 999);
    if (error || !data?.length) break;
    for (const r of data) m.set(r.email as string, { cidade: (r.cidade as string) ?? null, estado: (r.estado as string) ?? null });
    if (data.length < 1000) break;
  }
  return m;
}

/* ---------- Cursos removidos de um aluno ---------- */

export async function cursosRemovidos(email: string): Promise<Set<string>> {
  const e = norm(email);
  if (bancoEmDemonstracao) {
    return new Set(Array.from(mem().removidos.keys()).filter((k) => k.startsWith(`${e}|`)).map((k) => k.split("|")[1]));
  }
  const { data, error } = await db().from("cursos_removidos").select("curso_id").eq("email", e);
  if (error) return new Set();
  return new Set((data ?? []).map((r) => String(r.curso_id)));
}

export async function definirCursoRemovido(email: string, cursoId: string, removido: boolean, por: string): Promise<void> {
  const e = norm(email);
  if (bancoEmDemonstracao) {
    if (removido) mem().removidos.set(`${e}|${cursoId}`, new Date().toISOString());
    else mem().removidos.delete(`${e}|${cursoId}`);
    return;
  }
  const t = db().from("cursos_removidos");
  const { error } = removido
    ? await t.upsert({ email: e, curso_id: cursoId, removido_por: por }, { onConflict: "email,curso_id" })
    : await t.delete().eq("email", e).eq("curso_id", cursoId);
  if (error) throw error;
}
