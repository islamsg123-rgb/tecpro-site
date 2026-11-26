import "server-only";
import type { User } from "@supabase/supabase-js";
import { bancoEmDemonstracao, db } from "./index";

/**
 * Senha do aluno criada pelo painel (para quem não recebe o e-mail de acesso).
 *
 * - A senha é gravada direto na conta de login do Supabase (chave de serviço, só no servidor).
 * - A senha nunca é guardada pelo site nem mostrada de novo: aparece uma única vez para o
 *   administrador copiar ou mandar no WhatsApp.
 * - O histórico (quem mudou e quando) fica no "app_metadata" da conta, que só o servidor consegue
 *   alterar (o aluno não apaga). Não precisa de tabela nova nem de SQL.
 */

export type TipoMudancaSenha = "criada" | "trocada" | "email";

export interface MudancaSenha {
  tipo: TipoMudancaSenha;
  quem: string;
  quando: string;
}

const CAMPO_HISTORICO = "historico_senha";
const MAX_HISTORICO = 20;

/** Modo demonstração: guarda só o histórico em memória (nenhuma senha de verdade). */
const demo = ((globalThis as unknown as { __senhaDemo?: Map<string, MudancaSenha[]> }).__senhaDemo ??= new Map<string, MudancaSenha[]>());

/** Acha a conta de login pelo e-mail (o Supabase não tem busca direta por e-mail). */
async function contaDoLogin(email: string): Promise<User | null> {
  const admin = db().auth.admin;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`login: ${error.message}`);
    const u = data.users.find((x) => x.email?.toLowerCase() === email);
    if (u) return u;
    if (data.users.length < 1000) return null;
  }
  return null;
}

function lerHistorico(u: User | null): MudancaSenha[] {
  const h = u?.app_metadata?.[CAMPO_HISTORICO];
  return Array.isArray(h) ? (h as MudancaSenha[]) : [];
}

export interface SituacaoSenha {
  /** Existe conta de login para este e-mail. */
  temLogin: boolean;
  /** Último acesso ao site (qualquer forma de entrar). */
  ultimoLogin: string | null;
  historico: MudancaSenha[];
}

export async function situacaoSenha(email: string): Promise<SituacaoSenha> {
  if (bancoEmDemonstracao) return { temLogin: true, ultimoLogin: null, historico: demo.get(email) ?? [] };
  const u = await contaDoLogin(email);
  return { temLogin: !!u, ultimoLogin: u?.last_sign_in_at ?? null, historico: lerHistorico(u) };
}

/** Grava a senha nova na conta do aluno (cria a conta de login se ainda não existir). */
export async function definirSenhaDoAluno(email: string, senha: string, quem: string): Promise<TipoMudancaSenha> {
  const agora = new Date().toISOString();
  if (bancoEmDemonstracao) {
    const tipo: TipoMudancaSenha = (demo.get(email) ?? []).some((h: MudancaSenha) => h.tipo !== "email") ? "trocada" : "criada";
    demo.set(email, [{ tipo, quem, quando: agora }, ...(demo.get(email) ?? [])].slice(0, MAX_HISTORICO));
    return tipo;
  }
  const admin = db().auth.admin;
  const u = await contaDoLogin(email);
  if (!u) {
    const entrada: MudancaSenha = { tipo: "criada", quem, quando: agora };
    const { error } = await admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { tem_senha: true },
      app_metadata: { [CAMPO_HISTORICO]: [entrada] },
    });
    if (error) throw new Error(error.message);
    return "criada";
  }
  const tipo: TipoMudancaSenha = u.user_metadata?.tem_senha === true ? "trocada" : "criada";
  const historico = [{ tipo, quem, quando: agora }, ...lerHistorico(u)].slice(0, MAX_HISTORICO);
  const { error } = await admin.updateUserById(u.id, {
    password: senha,
    email_confirm: true,
    user_metadata: { ...u.user_metadata, tem_senha: true },
    app_metadata: { ...u.app_metadata, [CAMPO_HISTORICO]: historico },
  });
  if (error) throw new Error(error.message);
  return tipo;
}

/** Anota no histórico que o painel mandou o e-mail para o aluno criar a própria senha. */
export async function registrarEmailSenha(email: string, quem: string): Promise<void> {
  const entrada: MudancaSenha = { tipo: "email", quem, quando: new Date().toISOString() };
  if (bancoEmDemonstracao) {
    demo.set(email, [entrada, ...(demo.get(email) ?? [])].slice(0, MAX_HISTORICO));
    return;
  }
  const u = await contaDoLogin(email);
  if (!u) return;
  await db().auth.admin.updateUserById(u.id, {
    app_metadata: { ...u.app_metadata, [CAMPO_HISTORICO]: [entrada, ...lerHistorico(u)].slice(0, MAX_HISTORICO) },
  });
}
