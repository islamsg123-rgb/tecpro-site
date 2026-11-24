import "server-only";
import { bancoEmDemonstracao, db } from "./index";

/**
 * Mensagens do botão de ajuda (bolinha no canto da tela).
 * Tabela criada por supabase/migrations/0009_mensagens_ajuda.sql.
 * Enquanto o SQL não for rodado, a lista volta vazia com `tabelaFaltando: true`.
 */

export type OrigemMensagem = "aluno" | "loja";
export type StatusMensagem = "nova" | "resolvida";

export const TIPOS_AJUDA = {
  erro: "Erro no site",
  video: "Vídeo não reproduz",
  acesso: "Não consigo entrar",
  pagamento: "Pagamento",
  certificado: "Certificado",
  duvida: "Dúvida sobre um curso",
  outro: "Outro assunto",
} as const;
export type TipoAjuda = keyof typeof TIPOS_AJUDA;

export interface MensagemAjuda {
  id: number;
  origem: OrigemMensagem;
  tipo: TipoAjuda;
  mensagem: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  logado: boolean;
  pagina: string | null;
  cursoNome: string | null;
  aulaTitulo: string | null;
  navegador: string | null;
  print: string | null;
  status: StatusMensagem;
  anotacao: string | null;
  resolvidaEm: string | null;
  resolvidaPor: string | null;
  criadoEm: string;
}

type Linha = Record<string, unknown>;
const txt = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

const daLinha = (r: Linha): MensagemAjuda => ({
  id: Number(r.id),
  origem: r.origem === "aluno" ? "aluno" : "loja",
  tipo: (String(r.tipo) in TIPOS_AJUDA ? r.tipo : "outro") as TipoAjuda,
  mensagem: String(r.mensagem ?? ""),
  nome: txt(r.nome), email: txt(r.email), telefone: txt(r.telefone),
  logado: Boolean(r.logado),
  pagina: txt(r.pagina), cursoNome: txt(r.curso_nome), aulaTitulo: txt(r.aula_titulo),
  navegador: txt(r.navegador), print: txt(r.print),
  status: r.status === "resolvida" ? "resolvida" : "nova",
  anotacao: txt(r.anotacao), resolvidaEm: txt(r.resolvida_em), resolvidaPor: txt(r.resolvida_por),
  criadoEm: String(r.criado_em),
});

/* ---------- Demonstração (memória) ---------- */
interface Mem { lista: (MensagemAjuda & { ipHash: string | null })[]; seq: number }
const g = globalThis as unknown as { __mensagensDemo?: Mem };
const mem = (): Mem => (g.__mensagensDemo ??= { lista: [], seq: 0 });

export type NovaMensagem = Omit<MensagemAjuda, "id" | "status" | "anotacao" | "resolvidaEm" | "resolvidaPor" | "criadoEm"> & { ipHash: string | null };

export async function registrarMensagem(m: NovaMensagem): Promise<void> {
  if (bancoEmDemonstracao) {
    const s = mem();
    s.lista.unshift({ ...m, id: ++s.seq, status: "nova", anotacao: null, resolvidaEm: null, resolvidaPor: null, criadoEm: new Date().toISOString() });
    return;
  }
  const { error } = await db().from("mensagens_ajuda").insert({
    origem: m.origem, tipo: m.tipo, mensagem: m.mensagem, nome: m.nome, email: m.email, telefone: m.telefone,
    logado: m.logado, pagina: m.pagina, curso_nome: m.cursoNome, aula_titulo: m.aulaTitulo,
    navegador: m.navegador, print: m.print, ip_hash: m.ipHash,
  });
  if (error) throw new Error(error.message);
}

/** Quantas mensagens o mesmo aparelho/rede mandou desde `desde` (proteção contra envio em massa). */
export async function envioRecentesDoIp(ipHash: string, desde: Date): Promise<number> {
  if (bancoEmDemonstracao) return mem().lista.filter((m) => m.ipHash === ipHash && new Date(m.criadoEm) >= desde).length;
  const { count, error } = await db()
    .from("mensagens_ajuda")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("criado_em", desde.toISOString());
  if (error) return 0;
  return count ?? 0;
}

/** Lista sem a imagem (que é pesada); a imagem vem só ao abrir a mensagem. */
export async function listarMensagens(limite = 500): Promise<{ lista: MensagemAjuda[]; tabelaFaltando: boolean }> {
  if (bancoEmDemonstracao) return { lista: mem().lista.slice(0, limite).map((m) => ({ ...m, print: m.print ? "sim" : null })), tabelaFaltando: false };
  const { data, error } = await db()
    .from("mensagens_ajuda")
    .select("id,origem,tipo,mensagem,nome,email,telefone,logado,pagina,curso_nome,aula_titulo,navegador,status,anotacao,resolvida_em,resolvida_por,criado_em,tem_print")
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (error) {
    console.error("[mensagens]", error.message);
    return { lista: [], tabelaFaltando: true };
  }
  return { lista: (data ?? []).map((r: Linha) => ({ ...daLinha(r), print: r.tem_print ? "sim" : null })), tabelaFaltando: false };
}

export async function obterMensagem(id: number): Promise<MensagemAjuda | null> {
  if (bancoEmDemonstracao) return mem().lista.find((m) => m.id === id) ?? null;
  const { data } = await db().from("mensagens_ajuda").select("*").eq("id", id).maybeSingle();
  return data ? daLinha(data) : null;
}

/** Quantas mensagens novas (não resolvidas) há, por origem. Usado no contador do menu. */
export async function contarNovas(): Promise<{ aluno: number; loja: number }> {
  if (bancoEmDemonstracao) {
    const novas = mem().lista.filter((m) => m.status === "nova");
    return { aluno: novas.filter((m) => m.origem === "aluno").length, loja: novas.filter((m) => m.origem === "loja").length };
  }
  const conta = async (origem: OrigemMensagem) => {
    const { count, error } = await db().from("mensagens_ajuda").select("id", { count: "exact", head: true }).eq("status", "nova").eq("origem", origem);
    return error ? 0 : count ?? 0;
  };
  const [aluno, loja] = await Promise.all([conta("aluno"), conta("loja")]);
  return { aluno, loja };
}

export async function definirStatus(id: number, status: StatusMensagem, quem: string): Promise<void> {
  const resolvida = status === "resolvida";
  const campos = { status, resolvidaEm: resolvida ? new Date().toISOString() : null, resolvidaPor: resolvida ? quem : null };
  if (bancoEmDemonstracao) {
    const m = mem().lista.find((x) => x.id === id);
    if (m) Object.assign(m, campos);
    return;
  }
  const { error } = await db().from("mensagens_ajuda").update({ status, resolvida_em: campos.resolvidaEm, resolvida_por: campos.resolvidaPor }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function salvarAnotacao(id: number, anotacao: string | null): Promise<void> {
  if (bancoEmDemonstracao) {
    const m = mem().lista.find((x) => x.id === id);
    if (m) m.anotacao = anotacao;
    return;
  }
  const { error } = await db().from("mensagens_ajuda").update({ anotacao }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function apagarMensagem(id: number): Promise<void> {
  if (bancoEmDemonstracao) {
    mem().lista = mem().lista.filter((m) => m.id !== id);
    return;
  }
  const { error } = await db().from("mensagens_ajuda").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
