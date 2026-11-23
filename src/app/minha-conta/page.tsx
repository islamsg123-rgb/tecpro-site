import type { Metadata } from "next";
import Link from "next/link";
import { cursosDoAluno, exigirAluno } from "@/lib/area-aluno";
import { CapaCurso } from "@/components/CapaCurso";
import { BarraProgresso } from "@/components/aluno/Progresso";
import { IconeCertificado, IconePlay, IconeSeta } from "@/components/Icones";

export const metadata: Metadata = { title: "Meus cursos", robots: { index: false } };

export default async function MeusCursos() {
  const aluno = await exigirAluno();
  const cursos = await cursosDoAluno(aluno.email);
  const emAndamento = cursos.find((c) => c.pct > 0 && c.pct < 100) ?? cursos.find((c) => c.pct < 100);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-extrabold text-marca-900 sm:text-4xl">Meus cursos</h1>

      {cursos.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-lg font-semibold text-marca-900">Você ainda não tem cursos por aqui.</p>
          <p className="mt-2 text-slate-500">
            Se acabou de comprar, o acesso aparece assim que o pagamento for confirmado. Confira se entrou com o mesmo e-mail da compra.
          </p>
          <Link href="/cursos" className="mt-6 inline-block rounded-full bg-laranja-500 px-7 py-3 font-bold text-marca-900">Ver cursos</Link>
        </div>
      ) : (
        <>
          {emAndamento?.proxima && (
            <Link
              href={`/minha-conta/cursos/${emAndamento.curso.slug}/aulas/${encodeURIComponent(emAndamento.proxima.id)}`}
              className="group relative mt-8 flex flex-col gap-6 overflow-hidden rounded-3xl bg-marca-900 p-7 text-white sm:flex-row sm:items-center sm:p-9"
            >
              <div className="fundo-grade absolute inset-0" />
              <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-laranja-500/25 blur-3xl" />
              <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-laranja-500 text-marca-900 transition group-hover:scale-105">
                <IconePlay className="h-8 w-8" />
              </span>
              <div className="relative min-w-0 flex-1">
                <p className="text-sm font-semibold text-laranja-500">Continue de onde parou</p>
                <p className="mt-1 font-display text-xl font-bold sm:text-2xl">{emAndamento.proxima.titulo}</p>
                <p className="mt-1 text-sm text-slate-300">{emAndamento.curso.nome}</p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="max-w-xs flex-1"><BarraProgresso pct={emAndamento.pct} claro /></div>
                  <span className="text-sm font-semibold">{emAndamento.pct}%</span>
                </div>
              </div>
              <IconeSeta className="relative hidden h-7 w-7 text-white/60 sm:block" />
            </Link>
          )}

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cursos.map((c) => (
              <Link
                key={c.curso.id}
                href={`/minha-conta/cursos/${c.curso.slug}`}
                className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-xl"
              >
                <CapaCurso curso={c.curso} comTitulo={false} />
                <div className="flex flex-1 flex-col p-6">
                  <h2 className="text-lg font-bold leading-snug text-marca-900">{c.curso.nome}</h2>
                  <p className="mt-1 text-sm text-slate-500">{c.feitas} de {c.total} aulas concluídas</p>
                  <div className="mt-auto pt-5">
                    <div className="flex items-center gap-3">
                      <BarraProgresso pct={c.pct} />
                      <span className="w-10 text-right text-sm font-bold text-marca-900">{c.pct}%</span>
                    </div>
                    {c.pct === 100 && (
                      <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-green-700">
                        <IconeCertificado className="h-5 w-5" /> Curso concluído
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
