import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_DEPOIS_DO_LINK, destinoDepoisDoLink, supabaseDoServidor } from "@/lib/auth";

/**
 * O link do e-mail traz o aluno para cá; trocamos o código por uma sessão.
 * Se ele pediu "criar ou recuperar senha", vai direto para a tela de senha.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await (await supabaseDoServidor()).auth.exchangeCodeForSession(code);
    if (!error) {
      const jar = await cookies();
      const destino = destinoDepoisDoLink(jar.get(COOKIE_DEPOIS_DO_LINK)?.value);
      const resp = NextResponse.redirect(new URL(destino, url.origin));
      resp.cookies.delete(COOKIE_DEPOIS_DO_LINK);
      return resp;
    }
  }
  return NextResponse.redirect(new URL("/entrar?erro=link", url.origin));
}
