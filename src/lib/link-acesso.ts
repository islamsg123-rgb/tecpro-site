import "server-only";
import type { EmailOtpType } from "@supabase/supabase-js";
import { bancoEmDemonstracao, db } from "@/lib/dados";
import { emailConfigurado, emailLinkAcesso, enviarEmail } from "@/lib/email";
import { SITE_OFICIAL } from "@/lib/site";

/**
 * Link de acesso que funciona em QUALQUER navegador ou aparelho.
 *
 * Antes o link do e-mail usava o login "PKCE" do Supabase: um código ficava guardado no navegador
 * onde o aluno pediu o link. Se ele abria o e-mail no app do Gmail, no celular ou em outro navegador,
 * esse código não existia lá e o site dizia "link expirou", mesmo com o link recém-chegado.
 *
 * Agora o próprio site gera o link (com a chave de serviço do Supabase) e envia pelo Resend:
 *  - o link leva a /auth/confirmar com um "token_hash", que não depende do navegador;
 *  - a página só entra quando o aluno aperta o botão, então robôs que "abrem" links para checar
 *    vírus (Outlook, antivírus) não gastam o link antes do aluno;
 *  - o e-mail também traz um código de 6 dígitos para digitar no site, caso o link não abra.
 */

export type Destino = "conta" | "senha";

/** Endereços em que o link pode voltar. Qualquer outro cai no endereço oficial. */
const ORIGENS_PERMITIDAS = [SITE_OFICIAL, "https://tecpromultiensino.com.br", "https://tecpro-site.vercel.app"];

export function origemDoLink(host: string | null, proto: string | null): string {
  const origem = host ? `${proto ?? "https"}://${host}` : "";
  if (ORIGENS_PERMITIDAS.includes(origem)) return origem;
  if (/^http:\/\/localhost(:\d+)?$/.test(origem)) return origem;
  // Prévias da Vercel deste projeto (para testar antes de publicar).
  if (/^https:\/\/tecpro-site-[a-z0-9-]+-tecpro-site\.vercel\.app$/.test(origem)) return origem;
  // Prévias da Vercel deste projeto (para testar antes de publicar).
  if (/^https:\/\/tecpro-site-[a-z0-9-]+-tecpro-site\.vercel\.app$/.test(origem)) return origem;
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || SITE_OFICIAL;
}

/** Tipos aceitos na página de confirmação (vêm do Supabase). */
export const TIPOS_LINK: EmailOtpType[] = ["magiclink", "signup", "email", "recovery", "invite"];

export const caminhoDestino = (d: string | undefined) => (d === "senha" ? "/minha-conta/senha" : "/minha-conta");

/** Um envio por e-mail a cada 60 segundos (evita que alguém encha a caixa de outra pessoa). */
const ultimoEnvio = ((globalThis as unknown as { __ultimoLink?: Map<string, number> }).__ultimoLink ??= new Map());
const INTERVALO_MS = 60_000;

export type ResultadoEnvio = "enviado" | "aguarde" | "indisponivel" | "falhou";

/** true quando o site consegue mandar o link próprio (chave de serviço + Resend configurados). */
export const linkProprioDisponivel = () => !bancoEmDemonstracao && emailConfigurado;

export async function enviarLinkDeAcesso(email: string, origem: string, destino: Destino): Promise<ResultadoEnvio> {
  if (!linkProprioDisponivel()) return "indisponivel";

  const agora = Date.now();
  const antes = ultimoEnvio.get(email);
  if (antes && agora - antes < INTERVALO_MS) return "aguarde";
  ultimoEnvio.set(email, agora);
  if (ultimoEnvio.size > 5000) for (const [k, t] of ultimoEnvio) if (agora - t > INTERVALO_MS) ultimoEnvio.delete(k);

  const admin = db().auth.admin;
  // Garante que a conta existe (antes o Supabase criava sozinho no 1º acesso). Se já existe, segue.
  const criado = await admin.createUser({ email, email_confirm: true });
  if (criado.error && !/already|registered|exists/i.test(criado.error.message)) {
    console.error("[link-acesso] criar usuário:", criado.error.message);
  }

  const { data, error } = await admin.generateLink({ type: "magiclink", email });
  const hash = data?.properties?.hashed_token;
  if (error || !hash) {
    console.error("[link-acesso] gerar link:", error?.message ?? "sem token");
    ultimoEnvio.delete(email);
    return "falhou";
  }
  const tipo = data.properties.verification_type || "magiclink";
  const codigo = data.properties.email_otp || "";

  const link = `${origem}/auth/confirmar?token_hash=${encodeURIComponent(hash)}&type=${encodeURIComponent(tipo)}&para=${destino}`;
  try {
    await enviarEmail({ para: email, ...emailLinkAcesso(link, codigo, destino === "senha") });
  } catch (e) {
    console.error("[link-acesso] enviar e-mail:", (e as Error).message);
    ultimoEnvio.delete(email);
    return "falhou";
  }
  return "enviado";
}
