import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cursoDoAluno, exigirAluno } from "@/lib/area-aluno";
import { alternarAula } from "@/app/minha-conta/acoes";
import { BarraProgresso } from "@/components/aluno/Progresso";
import { apostilaDoCurso, conteudoDaAula } from "@/lib/conteudo-escola";
import { provaDaAula } from "@/lib/provas";
import { ProvaAula } from "@/components/aluno/ProvaAula";
import { IconeCheck, IconeChevron, IconePlay, IconeSeta } from "@/components/Icones";

export const metadata: Metadata = { title: "Aula", robots: { index: false } };

type Props = { params: Promise<{ slug: string; aulaId: string }> };

export default async function Aula({ params }: Props) {
  const aluno = await exigirAluno();
  const { slug, aulaId: bruto } = await params;
  const aulaId = decodeURIComponent(bruto);
  const c = await cursoDoAluno(aluno.email, slug);
  const i = c.aulas.findIndex((a) => a.id === aulaId);
  if (i < 0) notFound();
  const aula = c.aulas[i];
  const anterior = c.aulas[i - 1];
  const proxima = c.aulas[i + 1];
  const feita = c.concluidas.has(aula.id);
  const conteudo = conteudoDaAula(c.curso.id, i, aula.titulo);
  const apostila = apostilaDoCurso(c.curso.id);
  const prova = provaDaAula(c.curso.nome, i, aula.titulo);
  const link = (id: string) => `/minha-conta/cursos/${slug}/aulas/${encodeURIComponent(id)}`;

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0">
        <Link href={`/minha-conta/cursos/${slug}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-marca-900">
          <IconeChevron className="h-4 w-4 rotate-90" /> {c.curso.nome}
        </Link>

        {conteudo ? (
          <div className="mt-4 aspect-video overflow-hidden rounded-3xl bg-marca-950">
            <iframe
              src={conteudo.embed ?? undefined}
              title={aula.titulo}
              className="h-full w-full border-0"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : (
        <div className="relative mt-4 flex aspect-video items-center justify-center overflow-hidden rounded-3xl bg-marca-950 text-center text-white">
          <div className="fundo-grade absolute inset-0" />
          <div className="relative px-6">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-laranja-500"><IconePlay className="h-8 w-8" /></span>
            <p className="mt-4 font-semibold">O vídeo desta aula aparece aqui</p>
            <p className="mt-1 text-sm text-slate-400">Aguardando os vídeos da Escola Avançada</p>
          </div>
        </div>
        )}

        <p className="mt-6 text-sm font-semibold text-laranja-600">{aula.modulo} · Aula {i + 1} de {c.total}</p>
        <h1 className="mt-1 text-2xl font-extrabold text-marca-900 sm:text-3xl">{aula.titulo}</h1>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <form action={alternarAula}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="aulaId" value={aula.id} />
            <input type="hidden" name="concluir" value={feita ? "0" : "1"} />
            {!feita && proxima && <input type="hidden" name="irPara" value={proxima.id} />}
            <button
              className={`inline-flex items-center gap-2 rounded-full px-6 py-3 font-bold transition ${
                feita ? "border-2 border-green-600 text-green-700 hover:bg-green-50" : "bg-laranja-500 text-marca-900 hover:bg-laranja-400"
              }`}
            >
              <IconeCheck className="h-5 w-5" /> {feita ? "Aula concluída" : proxima ? "Concluir e ir para a próxima" : "Concluir aula"}
            </button>
          </form>
          {apostila && (
            <a href={apostila} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border-2 border-marca-900 px-5 py-2.5 text-sm font-bold text-marca-900 hover:bg-marca-50">
              Baixar apostila (PDF)
            </a>
          )}
          <div className="ml-auto flex gap-2">
            {anterior && (
              <Link href={link(anterior.id)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:border-marca-900">
                <IconeChevron className="h-4 w-4 rotate-90" /> Anterior
              </Link>
            )}
            {proxima && (
              <Link href={link(proxima.id)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:border-marca-900">
                Próxima <IconeSeta className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>

        {prova.length > 0 && <ProvaAula key={aula.id} slug={slug} aulaId={aula.id} perguntas={prova} />}
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
