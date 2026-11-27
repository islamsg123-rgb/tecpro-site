import "server-only";
import { emailsDono } from "@/lib/admin";
import { listarFuncionarios } from "@/lib/dados/painel";

/** E-mails do dono e dos funcionários (não contam como visitantes). Guardado por 5 minutos. */
const cacheEquipe: { em: number; emails: Set<string> } = { em: 0, emails: new Set() };
export async function emailsDaEquipe(): Promise<Set<string>> {
  if (Date.now() - cacheEquipe.em < 5 * 60_000) return cacheEquipe.emails;
  const { lista } = await listarFuncionarios().catch(() => ({ lista: [] as { email: string }[] }));
  cacheEquipe.emails = new Set([...emailsDono(), ...lista.map((f) => f.email.toLowerCase())]);
  cacheEquipe.em = Date.now();
  return cacheEquipe.emails;
}
