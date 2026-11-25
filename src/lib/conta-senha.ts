import "server-only";
import { bancoEmDemonstracao, db, EMAIL_DEMO } from "@/lib/dados";

/**
 * Responde se a conta deste e-mail já tem senha (para a tela de entrar decidir o 2º passo).
 * 1) Função conta_tem_senha no Supabase (site/publicacao/conta-tem-senha.sql): exata, olha a senha salva.
 * 2) Se a função ainda não existe: procura a conta e olha a marca "tem_senha" que o site grava
 *    quando a pessoa cria a senha ou entra com ela.
 */
export async function contaTemSenha(email: string): Promise<boolean> {
  if (bancoEmDemonstracao) return email === EMAIL_DEMO;
  const { data, error } = await db().rpc("conta_tem_senha", { p_email: email });
  if (!error) return data === true;

  const admin = db().auth.admin;
  for (let page = 1; page <= 50; page++) {
    const r = await admin.listUsers({ page, perPage: 1000 });
    if (r.error) return false;
    const u = r.data.users.find((x) => x.email?.toLowerCase() === email);
    if (u) return u.user_metadata?.tem_senha === true;
    if (r.data.users.length < 1000) return false;
  }
  return false;
}

/** Limite simples por endereço de internet, para ninguém testar milhares de e-mails seguidos. */
const consultas: Map<string, number[]> = ((globalThis as unknown as { __consultasEmail?: Map<string, number[]> }).__consultasEmail ??= new Map());
export function podeConsultar(ip: string): boolean {
  const agora = Date.now();
  const lista = (consultas.get(ip) ?? []).filter((t) => agora - t < 10 * 60_000);
  if (lista.length >= 30) return false;
  lista.push(agora);
  consultas.set(ip, lista);
  if (consultas.size > 5000) consultas.clear();
  return true;
}
