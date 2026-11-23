import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cursoDoAluno, exigirAluno } from "@/lib/area-aluno";
import { BarraProgresso } from "@/components/aluno/Progresso";
import { apostilaDoCurso, conteudoDaAula } from "@/lib/conteudo-escola";
import { provaDaAula } from "@/lib/provas";
import { AulaInterativa } from "@/components/aluno/AulaInterativa";
import { situacaoDaAula } from "@/lib/regras-aula";
import { IconeCadeado, IconeCheck, IconeChevron, IconeSeta } from "@/components/Icones";

export const metadata: Metadata = { title: "Aula", robots: { index: false } };

type Props = { params: Promise<{ slug: string; aulaId: string }> };

export default async function Aula({ params }: Props) {
  const aluno = await exigirAluno();
  const { slug, aulaId: bruto } = await params;
  const aulaId = decodeURIComponent(bruto);
  const c = await cursoDoAluno(aluno.email, slug);
  const i = c.aulas.findIndex((a) => a.id === aulaId);
  if (i < 0) notFound();
  // Aula bloqueada: manda para a primeira aula ainda não concluída.
  if (i > c.liberadaAte) redirect(`/minha-conta/cursos/${slug}/aulas/${encodeURIComponent(c.aulas[c.liberadaAte].id)}`);
  const aula = c.aulas[i];
  const anterior = c.aulas[i - 1];
  const proxima = c.aulas[i + 1];
  const feita = c.concluidas.has(aula.id);
  const conteudo = conteudoDaAula(c.curso.id, i, aula.titulo);
  const apostila = apostilaDoCurso(c.curso.id);
  const prova = provaDaAula(c.curso.nome, i, aula.titulo);
  const sit = await situacaoDaAula(aluno.email, c, i);
  const link = (id: string) => `/minha-conta/cursos/${slug}/aulas/${encodeURIComponent(id)}`;

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0">
        <Link href={`/minha-conta/cursos/${slug}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-marca-900">
          <IconeChevron className="h-4 w-4 rotate-90" /> {c.curso.nome}
        </Link>

        <p className="mt-6 text-sm font-semibold text-laranja-600">{aula.modulo} · Aula {i + 1} de {c.total}</p>
        <h1 className="mt-1 text-2xl font-extrabold text-marca-900 sm:text-3xl">{aula.titulo}</h1>

        <AulaInterativa
          slug={slug}
          aulaId={aula.id}
          titulo={aula.titulo}
          embed={conteudo?.embed ?? null}
          tipo={sit.tipo}
          feita={feita}
          videoOk={sit.videoOk}
          provaOk={sit.provaOk}
          faltamSegundos={sit.faltamSegundos}
          proximaId={proxima?.id ?? null}
          perguntas={prova}
          apostila={apostila}
        />

        <div className="mt-8 flex gap-2">
          {anterior && (
            <Link href={link(anterior.id)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:border-marca-900">
              <IconeChevron className="h-4 w-4 rotate-90" /> Anterior
            </Link>
          )}
          {proxima && feita && (
            <Link href={link(proxima.id)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:border-marca-900">
              Próxima <IconeSeta className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      <aside className="h-fit overflow-hidden rounded-3xl border border-slate-200 bg-white lg:sticky lg:top-24">
        <div className="border-b border-slate-100 p-5">
          <p className="text-sm font-semibold text-marca-900">Seu progresso</p>
          <div className="mt-2 flex items-center gap-3"><BarraProgresso pct={c.pct} /><span className="text-sm font-bold text-marca-900">{c.pct}%</span></div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {c.modulos.map((m) => (
            <div key={m.nome}>
              <p className="bg-slate-50 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">{m.nome}</p>
              {m.aulas.map((a) => {
                const ok = c.concluidas.has(a.id);
                const atual = a.id === aula.id;
                if (c.aulas.indexOf(a) > c.liberadaAte)
                  return (
                    <span key={a.id} className="flex items-center gap-3 px-5 py-3 text-sm text-slate-400" title="Conclua as aulas anteriores para liberar">
                      <IconeCadeado className="h-5 w-5 shrink-0" />
                      {a.titulo}
                    </span>
                  );
                return (
                  <Link key={a.id} href={link(a.id)} className={`flex items-center gap-3 px-5 py-3 text-sm ${atual ? "bg-laranja-500/10 font-semibold text-marca-900" : "text-slate-600 hover:bg-marca-50"}`}>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${ok ? "bg-green-500 text-white" : atual ? "border-2 border-laranja-500" : "border-2 border-slate-200"}`}>
                      {ok && <IconeCheck className="h-3.5 w-3.5" />}
                    </span>
                    {a.titulo}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
