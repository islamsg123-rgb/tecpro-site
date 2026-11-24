"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_DEPOIS_DO_LINK, entrarDemonstracao, loginEmDemonstracao, sairDemonstracao, supabaseDoServidor } from "@/lib/auth";
import { emailValido } from "@/lib/validacao";
import { SITE_OFICIAL } from "@/lib/site";

export interface EstadoEntrar {
  erro?: string;
  enviadoPara?: string;
  /** true quando o link enviado é para criar ou trocar a senha. */
  paraSenha?: boolean;
}

/** Link de acesso por e-mail (sem senha). */
export async function entrar(_: EstadoEntrar, f: FormData): Promise<EstadoEntrar> {
  return enviarLink(f, false);
}

/**
 * "Criar ou recuperar senha": manda o MESMO link de acesso por e-mail; ao clicar, a pessoa entra
 * e cai direto na tela de criar a senha. Assim só quem tem acesso à caixa de e-mail consegue criar
 * ou trocar a senha, e a resposta é igual para qualquer e-mail (ninguém descobre quem tem conta).
 */
export async function pedirLinkSenha(_: EstadoEntrar, f: FormData): Promise<EstadoEntrar> {
  return enviarLink(f, true);
}

async function enviarLink(f: FormData, paraSenha: boolean): Promise<EstadoEntrar> {
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  if (!emailValido(email)) return { erro: "Digite um e-mail válido." };

  if (loginEmDemonstracao) {
    await entrarDemonstracao(email);
    redirect(paraSenha ? "/minha-conta/senha" : "/minha-conta");
  }

  const jar = await cookies();
  if (paraSenha) {
    jar.set(COOKIE_DEPOIS_DO_LINK, "/minha-conta/senha", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 });
  } else {
    jar.delete(COOKIE_DEPOIS_DO_LINK);
  }

  const h = await headers();
  // O link volta para o MESMO endereço em que o aluno pediu: o login guarda um código no navegador
  // (cookie) daquele endereço. Se o link levasse para outro endereço, o login falhava ("link expirou").
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origem = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? SITE_OFICIAL);
  const { error } = await (await supabaseDoServidor()).auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origem}/auth/callback`, shouldCreateUser: true },
  });
  if (error) {
    console.error("[entrar]", error.message);
    return { erro: error.status === 429 ? "Muitas tentativas. Aguarde um minuto e tente de novo." : "Não conseguimos enviar o link. Tente novamente." };
  }
  return { enviadoPara: email, paraSenha };
}

export async function sair() {
  if (loginEmDemonstracao) await sairDemonstracao();
  else await (await supabaseDoServidor()).auth.signOut();
  redirect("/");
}
