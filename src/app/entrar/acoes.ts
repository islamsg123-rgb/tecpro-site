"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { entrarDemonstracao, loginEmDemonstracao, sairDemonstracao, supabaseDoServidor } from "@/lib/auth";
import { emailValido } from "@/lib/validacao";

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
  const origem = process.env.NEXT_PUBLIC_SITE_URL ?? h.get("origin") ?? `https://${h.get("host")}`;
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
