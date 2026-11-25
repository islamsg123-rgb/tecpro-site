import { urlSupabase } from "@/lib/supabase-url";
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Login do aluno.
 * Com Supabase configurado: e-mail e senha (caminho principal) ou código/link enviado ao e-mail.
 * Sem Supabase: MODO DEMONSTRAÇÃO, entra direto com qualquer e-mail (só para testes; nunca publicar assim).
 */

const URL_SUPABASE = urlSupabase();
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
  /** true quando a pessoa já criou uma senha (ou já entrou com senha). Serve para não insistir no aviso "crie sua senha". */
  temSenha: boolean;
}

const COOKIE_DEMO_SENHA = "tecpro_demo_senha";

/** Cookie do "Agora não" no aviso "Crie sua senha" (esconde o aviso por alguns dias). */
export const COOKIE_AVISO_SENHA = "tecpro_aviso_senha";

/** Marca no cadastro do Supabase que a pessoa tem senha (só serve para o aviso; não é usado para segurança). */
export const MARCA_TEM_SENHA = "tem_senha";

export async function alunoLogado(): Promise<Aluno | null> {
  if (loginEmDemonstracao) {
    const jar = await cookies();
    const email = jar.get(COOKIE_DEMO)?.value;
    return email ? { email, temSenha: jar.get(COOKIE_DEMO_SENHA)?.value === "1" } : null;
  }
  const { data } = await (await supabaseDoServidor()).auth.getUser();
  const u = data.user;
  return u?.email ? { email: u.email.toLowerCase(), temSenha: u.user_metadata?.[MARCA_TEM_SENHA] === true } : null;
}

/** Modo demonstração: lembra que a "senha" foi criada (nada é salvo de verdade). */
export async function marcarSenhaDemonstracao() {
  (await cookies()).set(COOKIE_DEMO_SENHA, "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
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
  (await cookies()).delete(COOKIE_DEMO_SENHA);
}

/** Cookie curto que diz para onde ir depois que a pessoa clica no link do e-mail (ex.: tela de criar senha). */
export const COOKIE_DEPOIS_DO_LINK = "tecpro_depois_link";
const DESTINOS_PERMITIDOS = ["/minha-conta/senha"];
/** Só aceita destinos conhecidos, para o cookie nunca levar a outro site. */
export function destinoDepoisDoLink(valor: string | undefined): string {
  return valor && DESTINOS_PERMITIDOS.includes(valor) ? valor : "/minha-conta";
}


/** Mostra o aviso "Crie sua senha" para quem entrou pelo e-mail e ainda não tem senha. */
export async function mostrarAvisoSenha(aluno: Aluno): Promise<boolean> {
  return !aluno.temSenha && !(await cookies()).get(COOKIE_AVISO_SENHA);
}
