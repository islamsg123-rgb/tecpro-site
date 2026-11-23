import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Renova a sessão do Supabase nas páginas do aluno (recomendação oficial do @supabase/ssr). */
export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
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
  await supabase.auth.getUser();
  return resp;
}

export const config = { matcher: ["/minha-conta/:path*"] };
