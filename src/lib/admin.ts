import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { alunoLogado, loginEmDemonstracao } from "./auth";
import { LISTA_SECOES, obterFuncionario, type Secao } from "./dados/painel";

/**
 * Quem pode entrar no painel:
 *  - o DONO: e-mails da variável ADMIN_EMAILS (separados por vírgula), com acesso a tudo;
 *  - FUNCIONÁRIOS cadastrados no painel (aba Funcionários), só nas seções liberadas para eles.
 * O login é o mesmo da área do aluno (link no e-mail).
 * Em modo demonstração, sem ADMIN_EMAILS, o administrador é admin@demo.tecpro.
 */

export const EMAIL_ADMIN_DEMO = "admin@demo.tecpro";
export type { Secao } from "./dados/painel";

function emailsDono(): string[] {
  const lista = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!lista.length && loginEmDemonstracao) return [EMAIL_ADMIN_DEMO];
  return lista;
}

export function eDono(email: string): boolean {
  return emailsDono().includes(email.trim().toLowerCase());
}

export interface AcessoPainel {
  email: string;
  nome: string | null;
  dono: boolean;
  permissoes: Secao[];
}

/** Acesso de quem está logado (uma consulta por página). null = não pode entrar no painel. */
export const acessoPainel = cache(async (): Promise<AcessoPainel | null> => {
  const u = await alunoLogado();
  if (!u) return null;
  if (eDono(u.email)) return { email: u.email, nome: null, dono: true, permissoes: [...LISTA_SECOES] };
  const f = await obterFuncionario(u.email);
  if (!f || !f.ativo) return null;
  return { email: u.email, nome: f.nome, dono: false, permissoes: f.permissoes };
});

export async function eAdmin(secao?: Secao): Promise<boolean> {
  const a = await acessoPainel();
  return Boolean(a && (!secao || a.permissoes.includes(secao)));
}

/**
 * Exige acesso ao painel (e, se informado, à seção). Sem login vai para /entrar;
 * para quem não tem acesso, o painel "não existe".
 */
export async function exigirAdmin(secao?: Secao): Promise<AcessoPainel> {
  const u = await alunoLogado();
  if (!u) redirect("/entrar");
  const a = await acessoPainel();
  if (!a) notFound();
  if (secao && !a.permissoes.includes(secao)) redirect("/admin?sem-permissao=1");
  return a;
}
