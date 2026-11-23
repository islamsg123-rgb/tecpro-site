import "server-only";
import { notFound, redirect } from "next/navigation";
import { alunoLogado, loginEmDemonstracao } from "./auth";

/**
 * Quem pode entrar no painel: os e-mails da variável ADMIN_EMAILS (separados por vírgula).
 * O login é o mesmo da área do aluno (link no e-mail).
 * Em modo demonstração, sem ADMIN_EMAILS, o administrador é admin@demo.tecpro.
 */

export const EMAIL_ADMIN_DEMO = "admin@demo.tecpro";

function emailsAdmin(): string[] {
  const lista = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!lista.length && loginEmDemonstracao) return [EMAIL_ADMIN_DEMO];
  return lista;
}

export async function eAdmin(): Promise<boolean> {
  const u = await alunoLogado();
  return Boolean(u && emailsAdmin().includes(u.email));
}

export async function exigirAdmin(): Promise<{ email: string }> {
  const u = await alunoLogado();
  if (!u) redirect("/entrar");
  // Para quem não é administrador, o painel "não existe".
  if (!emailsAdmin().includes(u.email)) notFound();
  return u;
}
