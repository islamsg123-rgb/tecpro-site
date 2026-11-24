"use server";

import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseDoServidor } from "@/lib/auth";
import { TIPOS_LINK, caminhoDestino } from "@/lib/link-acesso";

/** O aluno apertou "Entrar": trocamos o token do link por uma sessão (vale em qualquer navegador). */
export async function confirmarLink(f: FormData) {
  const hash = String(f.get("token_hash") ?? "");
  const tipo = String(f.get("type") ?? "") as EmailOtpType;
  const destino = caminhoDestino(String(f.get("para") ?? ""));
  if (!hash || !TIPOS_LINK.includes(tipo)) redirect("/entrar?erro=link");

  const supabase = await supabaseDoServidor();
  const { error } = await supabase.auth.verifyOtp({ token_hash: hash, type: tipo });
  if (error) {
    // Se o mesmo link já foi usado AQUI (ex.: clicou duas vezes), a pessoa já está logada: segue.
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect(destino);
    console.error("[confirmar]", error.message);
    redirect("/entrar?erro=link");
  }
  redirect(destino);
}
