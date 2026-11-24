import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BotaoEnviar } from "./BotaoEnviar";
import { confirmarLink } from "./acao";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

type Props = { searchParams: Promise<{ token_hash?: string; type?: string; para?: string }> };

/**
 * Página do link do e-mail. Ela NÃO entra sozinha: só quando o aluno aperta o botão.
 * Assim, robôs que abrem os links do e-mail para checar vírus não gastam o link antes dele.
 */
export default async function Confirmar({ searchParams }: Props) {
  const { token_hash, type, para } = await searchParams;
  if (!token_hash || !type) redirect("/entrar?erro=link");
  const senha = para === "senha";
  return (
    <section className="flex min-h-[calc(100vh-72px)] items-center justify-center px-4 py-16">
      <form action={confirmarLink} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-marca-900/5 sm:p-10">
        <input type="hidden" name="token_hash" value={token_hash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="para" value={senha ? "senha" : "conta"} />
        <h1 className="text-3xl font-extrabold text-marca-900">{senha ? "Criar sua senha" : "Entrar na sua conta"}</h1>
        <p className="mt-3 text-slate-600">
          {senha ? "Toque no botão para confirmar e ir para a tela de criar a senha." : "Toque no botão para confirmar e entrar na Área do aluno."}
        </p>
        <BotaoEnviar>{senha ? "Continuar para criar a senha" : "Entrar na minha conta"}</BotaoEnviar>
      </form>
    </section>
  );
}
