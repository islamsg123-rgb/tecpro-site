import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatarPreco, getCursoPorSlug, getCursos, getModulos } from "@/lib/cursos";
import { CapaCurso } from "@/components/CapaCurso";
import { CartaoCurso } from "@/components/CartaoCurso";
import { Duvidas } from "@/components/Duvidas";
import {
  IconeCadeado, IconeCelular, IconeCertificado, IconeCheck, IconeChevron, IconePlay, IconeRelogio,
} from "@/components/Icones";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getCursos()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const curso = await getCursoPorSlug((await params).slug);
  return curso ? { title: curso.nome, description: curso.resumo } : {};
}

export default async function PaginaCurso({ params }: Props) {
  const curso = await getCursoPorSlug((await params).slug);
  if (!curso) notFound();
  const [modulos, todos] = await Promise.all([getModulos(curso.id), getCursos()]);
  const totalAulas = modulos.reduce((n, m) => n + m.aulas.length, 0);
  const relacionados = todos.filter((c) => c.id !== curso.id && c.categoria === curso.categoria).concat(
    todos.filter((c) => c.id !== curso.id && c.categoria !== curso.categoria),
  ).slice(0, 3);
  const preco = formatarPreco(curso.precoCentavos);

  const itens = [
    { i: IconeRelogio, t: `${curso.cargaHoraria} horas de carga horária` },
    { i: IconePlay, t: `${totalAulas} aulas em vídeo` },
    { i: IconeCelular, t: "Acesso pelo celular e computador" },
    { i: IconeCertificado, t: "Certificado de conclusão" },
  ];

  return (
    <>
      <section className="relative overflow-hidden bg-marca-900 text-white">
        <div className="fundo-grade absolute inset-0" />
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-marca-500/30 blur-[110px]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:pb-24">
          <nav className="flex items-center gap-2 text-sm text-slate-400">
            <Link href="/cursos" className="hover:text-white">Cursos</Link>
            <IconeChevron className="h-4 w-4 -rotate-90" />
            <Link href={`/cursos?categoria=${encodeURIComponent(curso.categoria)}`} className="hover:text-white">{curso.categoria}</Link>
          </nav>
          <div className="lg:max-w-[calc(100%-420px)]">
            <h1 className="mt-6 text-4xl font-extrabold leading-tight sm:text-5xl">{curso.nome}</h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-300">{curso.resumo}</p>
            <ul className="mt-8 flex flex-wrap gap-3 text-sm">
              {itens.map(({ i: I, t }) => (
                <li key={t} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-slate-200">
                  <I className="h-4 w-4 text-laranja-500" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-32 pt-10 sm:px-6 lg:grid-cols-[1fr_380px] lg:pb-24">
        <div className="min-w-0">
          <section className="rounded-3xl border border-slate-200 bg-white p-7 sm:p-9">
            <h2 className="text-2xl font-bold text-marca-900">Sobre o curso</h2>
            <div
              className="conteudo-html mt-4 leading-relaxed text-slate-600"
              // A descrição vem da plataforma parceira em HTML.
              dangerouslySetInnerHTML={{ __html: curso.descricao }}
            />
          </section>

          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <h2 className="text-2xl font-bold text-marca-900">Conteúdo do curso</h2>
              <p className="text-sm text-slate-500">{modulos.length} módulos · {totalAulas} aulas</p>
            </div>
            <div className="mt-5 space-y-3">
              {modulos.map((m, i) => (
                <details key={m.nome} open={i === 0} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <summary className="flex cursor-pointer list-none items-center gap-4 px-6 py-5 hover:bg-marca-50/60">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-marca-900 font-display text-sm font-bold text-laranja-500">
                      {i + 1}
                    </span>
                    <span className="flex-1 font-semibold text-marca-900">{m.nome}</span>
                    <span className="hidden text-sm text-slate-500 sm:inline">{m.aulas.length} aulas</span>
                    <IconeChevron className="seta h-5 w-5 text-slate-400 transition" />
                  </summary>
                  <ol className="border-t border-slate-100 px-6 py-2">
                    {m.aulas.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 py-3 text-sm text-slate-600">
                        <IconePlay className="h-5 w-5 shrink-0 text-slate-300" /> {a.titulo}
                        <IconeCadeado className="ml-auto h-4 w-4 shrink-0 text-slate-300" />
                      </li>
                    ))}
                  </ol>
                </details>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-bold text-marca-900">Dúvidas sobre o curso</h2>
            <div className="mt-5">
              <Duvidas
                perguntas={[
                  { p: "Quando começo a estudar?", r: "Assim que o pagamento for confirmado, você recebe o acesso por e-mail e pode começar na hora." },
                  { p: "Preciso de algum conhecimento prévio?", r: "Não. O curso foi pensado para quem está começando e evolui passo a passo." },
                  { p: "Como funciona o certificado?", r: `Ao concluir as ${totalAulas} aulas, você emite o certificado de ${curso.cargaHoraria} horas na área do aluno.` },
                ]}
              />
            </div>
          </section>
        </div>

        {/* Cartão de compra */}
        <aside className="lg:-mt-72">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-marca-900/10 lg:sticky lg:top-24">
            <CapaCurso curso={curso} />
            <div className="p-7">
              <p className="text-sm text-slate-500">Investimento</p>
              <p className="font-display text-4xl font-extrabold text-marca-900">{preco}</p>
              <p className="mt-1 text-sm text-slate-500">no Pix, boleto ou cartão de crédito</p>
              <Link
                href={`/checkout/${curso.slug}`}
                className="mt-6 block rounded-full bg-laranja-500 py-4 text-center font-bold text-marca-900 shadow-lg shadow-laranja-500/30 transition hover:bg-laranja-400"
              >
                Quero me matricular
              </Link>
              <ul className="mt-6 space-y-3 text-sm text-slate-600">
                {["Acesso liberado após o pagamento", "Estude no seu ritmo", "Certificado ao concluir"].map((t) => (
                  <li key={t} className="flex items-center gap-2"><IconeCheck className="h-5 w-5 text-laranja-600" /> {t}</li>
                ))}
              </ul>
              <p className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-xs text-slate-400">
                <IconeCadeado className="h-4 w-4" /> Pagamento 100% seguro
              </p>
            </div>
          </div>
        </aside>
      </div>

      {relacionados.length > 0 && (
        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2 className="text-3xl font-extrabold text-marca-900">Você também pode gostar</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relacionados.map((c) => <CartaoCurso key={c.id} curso={c} />)}
            </div>
          </div>
        </section>
      )}

      {/* Barra de compra fixa no celular */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div>
          <p className="text-xs text-slate-500">{curso.cargaHoraria}h · Certificado</p>
          <p className="font-display text-xl font-bold text-marca-900">{preco}</p>
        </div>
        <Link href={`/checkout/${curso.slug}`} className="rounded-full bg-laranja-500 px-6 py-3 text-sm font-bold text-marca-900">
          Matricular
        </Link>
      </div>
    </>
  );
}
