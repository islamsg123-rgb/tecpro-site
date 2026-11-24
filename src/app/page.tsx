import type { Curso } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import { getCursosPublicos } from "@/lib/cursos";
import { formatarPreco } from "@/lib/formatar";
import { CartaoCurso } from "@/components/CartaoCurso";
import { Duvidas } from "@/components/Duvidas";
import { obterConfigLoja } from "@/lib/dados";
import { listarDepoimentos } from "@/lib/dados/painel";
import {
  IconeBusca, IconeCadeado, IconeCategoria, IconeCelular, IconeCertificado, IconeChapeu,
  IconeCheck, IconeCarrinho, IconePix, IconePlay, IconeSeta,
} from "@/components/Icones";

const passos = [
  { icone: IconeCarrinho, titulo: "Escolha seu curso", texto: "Veja o conteúdo completo, a carga horária e o que você vai aprender antes de comprar." },
  { icone: IconePix, titulo: "Pague como preferir", texto: "Pix, boleto ou cartão de crédito em ambiente seguro. O acesso é liberado após a confirmação." },
  { icone: IconePlay, titulo: "Estude e conclua", texto: "Assista às aulas no celular ou no computador, no seu ritmo, e acompanhe seu progresso." },
  { icone: IconeCertificado, titulo: "Receba o certificado", texto: "Ao concluir o curso, emita seu certificado direto na área do aluno." },
];

const perguntas = [
  { p: "Como recebo o acesso ao curso?", r: "Assim que o pagamento é confirmado, você recebe por e-mail os dados de acesso à área do aluno. No Pix e no cartão, isso costuma levar poucos minutos." },
  { p: "Por quanto tempo posso assistir às aulas?", r: "Você estuda no seu ritmo, nos horários que preferir. O prazo de acesso aparece na página de cada curso." },
  { p: "O curso tem certificado?", r: "Sim. Ao concluir todas as aulas, você emite o certificado de conclusão na área do aluno." },
  { p: "Posso estudar pelo celular?", r: "Pode. A plataforma funciona no celular, tablet e computador, com qualquer navegador." },
  { p: "Quais as formas de pagamento?", r: "Pix, boleto bancário e cartão de crédito." },
];

export default async function Inicio() {
  const [cursos, loja, { lista: depoimentos }] = await Promise.all([
    getCursosPublicos(),
    obterConfigLoja(),
    listarDepoimentos(true).catch(() => ({ lista: [] })),
  ]);
  const destaques = cursos.slice(0, 6);
  const gratuitos = cursos.filter((c) => c.gratuito);
  const pagos = cursos.filter((c) => !c.gratuito);
  const categorias = Array.from(new Set(cursos.map((c) => c.categoria)));
  const vitrine = cursos[0];

  return (
    <>
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden bg-marca-900 text-white">
        <div className="fundo-grade absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]" />
        <div className="absolute -left-40 top-20 h-[28rem] w-[28rem] rounded-full bg-marca-500/30 blur-[120px]" />
        <div className="absolute -right-20 -top-20 h-[26rem] w-[26rem] rounded-full bg-laranja-500/20 blur-[120px]" />

        <div className="relative mx-auto grid max-w-7xl gap-14 px-4 pb-24 pt-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-200">
              <IconeChapeu className="h-4 w-4 text-laranja-500" /> Cursos online com certificado
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-6xl">
              Aprenda hoje a profissão que vai <span className="text-laranja-500">mudar seu amanhã</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
              Cursos práticos e diretos ao ponto, para você estudar no seu ritmo, de onde estiver, e sair com certificado.
            </p>

            <form action="/cursos" className="mt-9 flex max-w-xl items-center gap-2 rounded-full bg-white p-2 shadow-2xl shadow-black/30">
              <IconeBusca className="ml-3 h-5 w-5 shrink-0 text-slate-400" />
              <input
                name="busca"
                type="search"
                placeholder="O que você quer aprender?"
                aria-label="Buscar curso"
                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-marca-900 outline-none placeholder:text-slate-400"
              />
              <button className="shrink-0 rounded-full bg-laranja-500 px-6 py-3 text-sm font-bold text-marca-900 transition hover:bg-laranja-400">
                Buscar
              </button>
            </form>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-300">
              {["Acesso 24h", "Certificado de conclusão", "Pix, boleto ou cartão"].map((t) => (
                <span key={t} className="flex items-center gap-2">
                  <IconeCheck className="h-5 w-5 text-laranja-500" /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Composição de cartões ilustrando a experiência do aluno */}
          {vitrine && (
            <div className="relative mx-auto hidden w-full max-w-md lg:block">
              <div className="flutuar relative rounded-3xl border border-white/10 bg-white/[0.06] p-3 shadow-2xl backdrop-blur-xl">
                <div className="relative overflow-hidden rounded-2xl">
                  <div className="aspect-video bg-gradient-to-br from-marca-700 to-marca-950" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-laranja-500 text-marca-900 shadow-xl shadow-laranja-500/40">
                      <IconePlay className="h-8 w-8" />
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/10">
                    <div className="h-full w-2/3 bg-laranja-500" />
                  </div>
                </div>
                <div className="px-2 pb-2 pt-4">
                  <p className="text-xs text-slate-400">Aula 7 de 12</p>
                  <p className="mt-1 font-display font-semibold">{vitrine.nome}</p>
                </div>
              </div>

              <div className="flutuar-lento absolute -bottom-16 -left-12 flex items-center gap-3 rounded-2xl bg-white p-4 text-marca-900 shadow-2xl">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-laranja-500/15 text-laranja-600">
                  <IconeCertificado />
                </span>
                <div>
                  <p className="text-sm font-bold">Certificado liberado!</p>
                  <p className="text-xs text-slate-500">Curso concluído com sucesso</p>
                </div>
              </div>

              <div className="flutuar-lento absolute -right-8 -top-8 rounded-2xl bg-white px-5 py-4 text-marca-900 shadow-2xl">
                <p className="text-xs text-slate-500">Seu progresso</p>
                <p className="font-display text-2xl font-bold">67%</p>
                <div className="mt-2 h-1.5 w-28 rounded-full bg-slate-100">
                  <div className="h-full w-2/3 rounded-full bg-laranja-500" />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ===== ÁREAS ===== */}
      <section className="relative z-10 mx-auto -mt-10 max-w-7xl px-4 sm:px-6">
        <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-xl shadow-marca-900/5 sm:grid-cols-2 lg:grid-cols-4">
          {categorias.slice(0, 4).map((cat) => {
            const qtd = cursos.filter((c) => c.categoria === cat).length;
            return (
              <Link
                key={cat}
                href={`/cursos?categoria=${encodeURIComponent(cat)}`}
                className="group flex items-center gap-4 rounded-2xl p-4 transition hover:bg-marca-50"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-marca-900 text-laranja-500 transition group-hover:bg-laranja-500 group-hover:text-marca-900">
                  <IconeCategoria categoria={cat} />
                </span>
                <span>
                  <span className="block font-semibold text-marca-900">{cat}</span>
                  <span className="text-xs text-slate-500">{qtd} {qtd === 1 ? "curso" : "cursos"}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ===== DESTAQUES, GRATUITOS E PAGOS ===== */}
      <VitrineCursos titulo="Mais procurados" cursos={destaques} link="/cursos" textoLink="Ver todos os cursos" />
      <VitrineCursos
        titulo="Cursos gratuitos"
        subtitulo="Comece agora mesmo: é só fazer seu cadastro."
        cursos={gratuitos.slice(0, 6)}
        link="/cursos?tipo=gratuitos"
        textoLink="Ver todos os gratuitos"
        fundoBranco
      />
      <VitrineCursos
        titulo="Cursos pagos"
        subtitulo="Formações completas, com certificado incluso."
        cursos={pagos.slice(0, 6)}
        link="/cursos?tipo=pagos"
        textoLink="Ver todos os pagos"
      />

      {/* ===== COMO FUNCIONA ===== */}
      <section id="como-funciona" className="scroll-mt-20 bg-white py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-laranja-600">Como funciona</p>
            <h2 className="mt-2 text-3xl font-extrabold text-marca-900 sm:text-4xl">Do primeiro clique ao certificado</h2>
          </div>
          <ol className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {passos.map((p, i) => (
              <li key={p.titulo} className="relative rounded-3xl border border-slate-200 bg-marca-50/50 p-7">
                <span className="absolute right-6 top-5 font-display text-5xl font-extrabold text-marca-900/[0.06]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-marca-900 text-laranja-500">
                  <p.icone />
                </span>
                <h3 className="mt-6 text-lg font-bold text-marca-900">{p.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ===== SOBRE ===== */}
      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div className="relative">
          <div className="absolute -inset-4 -z-10 rotate-2 rounded-[2rem] bg-laranja-500/20" />
          <Image
            src="/tecpro-sala.jpg"
            alt="Alunos em sala de aula da Tecpro Multi Ensino"
            width={1920}
            height={1080}
            className="rounded-[2rem] shadow-2xl"
          />
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-laranja-600">Sobre a Tecpro</p>
          <h2 className="mt-2 text-3xl font-extrabold text-marca-900 sm:text-4xl">Uma escola de verdade, agora também no seu celular</h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            A Tecpro Multi Ensino oferece cursos livres, profissionalizantes, certificação por competência e EJA.
            Levamos a mesma seriedade da sala de aula para o ensino online.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              { i: IconeCelular, t: "Estude de qualquer lugar" },
              { i: IconeCertificado, t: "Certificado de conclusão" },
              { i: IconeCadeado, t: "Compra 100% segura" },
              { i: IconeChapeu, t: "Conteúdo para o mercado" },
            ].map(({ i: I, t }) => (
              <li key={t} className="flex items-center gap-3 rounded-2xl bg-white p-4 font-semibold text-marca-900 shadow-sm">
                <I className="h-6 w-6 text-laranja-600" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ===== CERTIFICADO ===== */}
      <section id="certificado" className="scroll-mt-20 px-4 sm:px-6">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-marca-900 px-8 py-16 text-white sm:px-14">
          <div className="fundo-grade absolute inset-0" />
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-laranja-500/25 blur-[100px]" />
          <div className="relative grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-laranja-500">Certificado</p>
              <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Concluiu? Seu certificado sai na hora.</h2>
              <p className="mt-5 max-w-lg text-lg text-slate-300">
                Acompanhe seu progresso aula a aula. Quando terminar, o certificado com seu nome, o curso e a carga horária fica disponível na sua área do aluno.
              </p>
              <Link href="/cursos" className="mt-8 inline-flex items-center gap-2 rounded-full bg-laranja-500 px-7 py-3.5 font-bold text-marca-900 transition hover:bg-laranja-400">
                Escolher meu curso <IconeSeta className="h-5 w-5" />
              </Link>
            </div>
            {/* Prévia ilustrativa do certificado */}
            <div className="mx-auto w-full max-w-md -rotate-2 rounded-2xl bg-white p-2 text-marca-900 shadow-2xl">
              <div className="rounded-xl border-2 border-laranja-500/60 p-7 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-laranja-600">Certificado de conclusão</p>
                <p className="mt-5 text-xs text-slate-500">Certificamos que</p>
                <p className="mt-1 font-display text-2xl font-bold">Seu Nome Aqui</p>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  concluiu o curso <strong className="text-marca-900">{vitrine?.nome ?? "Curso Tecpro"}</strong>, com carga horária de {vitrine?.cargaHoraria ?? 40} horas.
                </p>
                <div className="mt-6 flex items-end justify-between border-t border-slate-200 pt-4 text-left">
                  <div className="rounded-md bg-marca-900 px-2 py-1.5">
                    <Image src="/logo-tecpro-transparente.png" alt="" width={88} height={32} />
                  </div>
                  <p className="text-[10px] text-slate-400">Código de validação<br /><span className="font-mono text-marca-900">TP-XXXX-XXXX</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== DEPOIMENTOS (painel: Loja virtual > Depoimentos) ===== */}
      {loja.mostrarDepoimentos && depoimentos.length > 0 && (
        <section id="depoimentos" className="mx-auto max-w-7xl scroll-mt-20 px-4 pt-24 sm:px-6">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-laranja-600">Depoimentos</p>
            <h2 className="mt-2 text-3xl font-extrabold text-marca-900 sm:text-4xl">O que dizem nossos alunos</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {depoimentos.slice(0, 9).map((d) => (
              <figure key={d.id} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                <span className="font-display text-5xl leading-none text-laranja-500" aria-hidden>“</span>
                <blockquote className="mt-2 flex-1 text-slate-700">{d.texto}</blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-marca-100 font-bold text-marca-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {d.foto ? <img src={d.foto} alt={`Foto de ${d.nome}`} className="h-full w-full object-cover" /> : d.nome[0]}
                  </span>
                  <span>
                    <span className="block font-bold text-marca-900">{d.nome}</span>
                    {d.detalhe && <span className="block text-sm text-slate-500">{d.detalhe}</span>}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* ===== DÚVIDAS ===== */}
      <section id="duvidas" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-24 sm:px-6">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-laranja-600">Dúvidas</p>
          <h2 className="mt-2 text-3xl font-extrabold text-marca-900 sm:text-4xl">Perguntas frequentes</h2>
        </div>
        <div className="mt-10">
          <Duvidas perguntas={perguntas} />
        </div>
        {vitrine && (
          <p className="mt-10 text-center text-slate-600">
            {cursos.some((c) => c.gratuito) ? (
              <>Temos cursos <strong className="text-marca-900">gratuitos</strong>.{" "}</>
            ) : (
              <>Cursos a partir de <strong className="text-marca-900">{formatarPreco(Math.min(...cursos.map((c) => c.precoCentavos)))}</strong>.{" "}</>
            )}
            <Link href="/cursos" className="font-bold text-marca-700 underline decoration-laranja-500 decoration-2 underline-offset-4">
              Ver todos
            </Link>
          </p>
        )}
      </section>
    </>
  );
}

/** Uma faixa de cursos da página inicial (título, botão "ver todos" e até 6 cartões). */
function VitrineCursos({
  titulo, subtitulo, cursos, link, textoLink, fundoBranco = false,
}: {
  titulo: string; subtitulo?: string; cursos: Curso[]; link: string; textoLink: string; fundoBranco?: boolean;
}) {
  if (!cursos.length) return null;
  return (
    <section className={fundoBranco ? "bg-white" : ""}>
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-laranja-600">Cursos</p>
            <h2 className="mt-2 text-3xl font-extrabold text-marca-900 sm:text-4xl">{titulo}</h2>
            {subtitulo && <p className="mt-2 text-slate-500">{subtitulo}</p>}
          </div>
          <Link href={link} className="flex items-center gap-2 text-sm font-bold text-marca-700 hover:text-laranja-600">
            {textoLink} <IconeSeta className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cursos.map((c) => (
            <CartaoCurso key={c.id} curso={c} />
          ))}
        </div>
      </div>
    </section>
  );
}
