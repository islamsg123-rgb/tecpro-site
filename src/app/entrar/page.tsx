import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { alunoLogado, loginEmDemonstracao } from "@/lib/auth";
import { urlSupabase } from "@/lib/supabase-url";
import { FormularioEntrar } from "@/components/aluno/FormularioEntrar";
import { IconeCertificado, IconeGrafico, IconePlay } from "@/components/Icones";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

type Props = { searchParams: Promise<{ erro?: string }> };

export default async function Entrar({ searchParams }: Props) {
  if (await alunoLogado()) redirect("/minha-conta");
  const { erro } = await searchParams;
  return (
    <section className="grid min-h-[calc(100vh-72px)] lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-marca-900 p-14 text-white lg:flex lg:flex-col lg:justify-center">
        <div className="fundo-grade absolute inset-0" />
        <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-laranja-500/20 blur-[100px]" />
        <div className="relative max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight">Bem-vindo de volta! Seus estudos continuam daqui.</h2>
          <ul className="mt-10 space-y-5 text-slate-300">
            {[
              { I: IconePlay, t: "Continue de onde parou" },
              { I: IconeGrafico, t: "Acompanhe seu progresso em cada curso" },
              { I: IconeCertificado, t: "Emita seus certificados" },
            ].map(({ I, t }) => (
              <li key={t} className="flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-laranja-500"><I /></span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-marca-900/5 sm:p-10">
          <FormularioEntrar
            demonstracao={loginEmDemonstracao}
            erroLink={erro === "link"}
            supabase={loginEmDemonstracao ? undefined : { url: urlSupabase()!, chave: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! }}
          />
        </div>
      </div>
    </section>
  );
}
