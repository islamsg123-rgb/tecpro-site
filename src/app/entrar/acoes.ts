"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { entrarDemonstracao, loginEmDemonstracao, sairDemonstracao, supabaseDoServidor } from "@/lib/auth";
import { emailValido } from "@/lib/validacao";
import { SITE_OFICIAL } from "@/lib/site";

export interface EstadoEntrar {
  erro?: string;
  enviadoPara?: string;
}

export async function entrar(_: EstadoEntrar, f: FormData): Promise<EstadoEntrar> {
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  if (!emailValido(email)) return { erro: "Digite um e-mail válido." };

  if (loginEmDemonstracao) {
    await entrarDemonstracao(email);
    redirect("/minha-conta");
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
  return { enviadoPara: email };
}

export async function sair() {
  if (loginEmDemonstracao) await sairDemonstracao();
  else await (await supabaseDoServidor()).auth.signOut();
  redirect("/");
}
