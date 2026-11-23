import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Login do aluno.
 * Com Supabase configurado: login por link mágico enviado ao e-mail (sem senha).
 * Sem Supabase: MODO DEMONSTRAÇÃO, entra direto com qualquer e-mail (só para testes; nunca publicar assim).
 */

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const loginEmDemonstracao = !URL_SUPABASE || !CHAVE_PUBLICA;

const COOKIE_DEMO = "tecpro_demo_email";

export async function supabaseDoServidor() {
  const jar = await cookies();
  return createServerClient(URL_SUPABASE!, CHAVE_PUBLICA!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          /* chamado de um Server Component: o middleware cuida de renovar a sessão */
        }
      },
    },
  });
}

export interface Aluno {
  email: string;
}

export async function alunoLogado(): Promise<Aluno | null> {
  if (loginEmDemonstracao) {
    const email = (await cookies()).get(COOKIE_DEMO)?.value;
    return email ? { email } : null;
  }
  const { data } = await (await supabaseDoServidor()).auth.getUser();
  return data.user?.email ? { email: data.user.email.toLowerCase() } : null;
}

export async function entrarDemonstracao(email: string) {
  (await cookies()).set(COOKIE_DEMO, email.trim().toLowerCase(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function sairDemonstracao() {
  (await cookies()).delete(COOKIE_DEMO);
}
