import { NextResponse } from "next/server";
import { supabaseDoServidor } from "@/lib/auth";

/** O link mágico do e-mail traz o aluno para cá; trocamos o código por uma sessão. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await (await supabaseDoServidor()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/minha-conta", url.origin));
  }
  return NextResponse.redirect(new URL("/entrar?erro=link", url.origin));
}
