import { urlSupabase } from "@/lib/supabase-url";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Renova a sessão do Supabase nas páginas do aluno (recomendação oficial do @supabase/ssr). */
export async function middleware(req: NextRequest) {
  const url = urlSupabase();
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) return NextResponse.next();

  let resp = NextResponse.next({ request: req });
  const supabase = createServerClient(url, chave, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => req.cookies.set(name, value));
        resp = NextResponse.next({ request: req });
        lista.forEach(({ name, value, options }) => resp.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();

  // Veio do e-mail de lembrete sem login: depois de entrar, volta para o curso.
  const voltar = req.cookies.get("tecpro_voltar")?.value;
  if (data.user && voltar && req.nextUrl.pathname === "/minha-conta" && /^\/minha-conta\/cursos\/[a-z0-9-]+$/i.test(voltar)) {
    const ir = NextResponse.redirect(new URL(voltar, req.url));
    resp.cookies.getAll().forEach((c) => ir.cookies.set(c));
    ir.cookies.delete("tecpro_voltar");
    return ir;
  }
  return resp;
}

export const config = { matcher: ["/minha-conta/:path*"] };
