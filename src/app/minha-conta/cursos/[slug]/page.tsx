import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { lembrarDeComprar } from "@/lib/lembrete-certificado";
import { cursoDoAluno, exigirAluno } from "@/lib/area-aluno";
import { AnelProgresso } from "@/components/aluno/Progresso";
import { CartaoCertificado } from "@/components/aluno/CartaoCertificado";
import { situacaoCertificado } from "@/lib/certificados";
import { obterAluno, obterConfigLoja, saldoCreditos } from "@/lib/dados";
import { IconeCadeado, IconeCheck, IconeChevron, IconePlay } from "@/components/Icones";

export const metadata: Metadata = { title: "Meu curso", robots: { index: false } };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ erroNome?: string }> };

export default async function MeuCurso({ params, searchParams }: Props) {
  const aluno = await exigirAluno();
  const { slug } = await params;
  const c = await cursoDoAluno(aluno.email, slug);
  const [cert, registro, { erroNome }, creditos, loja] = await Promise.all([
    situacaoCertificado(aluno.email, c), obterAluno(aluno.email), searchParams, saldoCreditos(aluno.email).catch(() => 0), obterConfigLoja(),
  ]);
  const nomeSugerido = registro?.nome ?? "";
  // Viu a tela do certificado e ainda não comprou: e-mail de parabéns daqui a 1 hora (cancelado se comprar antes).
  if (cert.estado === "aguardando_pagamento") after(() => lembrarDeComprar(aluno.email, c.curso.id));
  const link = (id: string) => `/minha-conta/cursos/${slug}/aulas/${encodeURIComponent(id)}`;

  return (
    <>
      <section className="relative overflow-hidden bg-marca-900 text-white">
        <div className="fundo-grade absolute inset-0" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <Link href="/minha-conta" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
              <IconeChevron className="h-4 w-4 rotate-90" /> Meus cursos
            </Link>
            <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{c.curso.nome}</h1>
            <p className="mt-2 text-slate-300">{c.feitas} de {c.total} aulas concluídas · {c.curso.cargaHoraria} horas</p>
            {c.proxima && (
              <Link href={link(c.proxima.id)} className="mt-6 inline-flex items-center gap-2 rounded-full bg-laranja-500 px-7 py-3.5 font-bold text-marca-900 hover:bg-laranja-400">
                <IconePlay className="h-5 w-5" /> {c.feitas === 0 ? "Começar curso" : c.pct === 100 ? "Rever aulas" : "Continuar"}
              </Link>
            )}
          </div>
          <AnelProgresso pct={c.pct} />
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {c.modulos.map((m, i) => {
            const feitas = m.aulas.filter((a) => c.concluidas.has(a.id)).length;
            return (
              <div key={m.nome} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center gap-4 border-b border-slate-100 px-6 py-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-marca-900 font-display text-sm font-bold text-laranja-500">{i + 1}</span>
                  <span className="flex-1 font-semibold text-marca-900">{m.nome}</span>
                  <span className="text-sm text-slate-500">{feitas}/{m.aulas.length}</span>
                </div>
                <ol>
                  {m.aulas.map((a) => {
                    const ok = c.concluidas.has(a.id);
                    if (c.aulas.indexOf(a) > c.liberadaAte)
                      return (
                        <li key={a.id} className="flex items-center gap-3 px-6 py-3.5 text-sm text-slate-400" title="Conclua as aulas anteriores para liberar">
                          <IconeCadeado className="h-6 w-6 shrink-0" />
                          <span>{a.titulo}</span>
                        </li>
                      );
                    return (
                      <li key={a.id}>
                        <Link href={link(a.id)} className="flex items-center gap-3 px-6 py-3.5 text-sm hover:bg-marca-50">
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${ok ? "bg-green-500 text-white" : "border-2 border-slate-200"}`}>
                            {ok && <IconeCheck className="h-4 w-4" />}
                          </span>
                          <span className={ok ? "text-slate-500" : "font-medium text-marca-900"}>{a.titulo}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </div>

        <CartaoCertificado s={cert} slug={slug} faltam={c.total - c.feitas} nomeSugerido={nomeSugerido} erroNome={erroNome === "1"} creditos={creditos} whatsappSuporte={loja.whatsapp} emailSuporte={loja.emailContato} email={aluno.email} cursoNome={c.curso.nome} />
      </div>
    </>
  );
}
