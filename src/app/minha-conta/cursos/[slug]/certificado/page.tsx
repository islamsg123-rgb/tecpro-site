import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { lembrarDeComprar } from "@/lib/lembrete-certificado";
import { redirect } from "next/navigation";
import { cursoDoAluno, exigirAluno } from "@/lib/area-aluno";
import { situacaoCertificado } from "@/lib/certificados";
import { obterAluno, saldoCreditos } from "@/lib/dados";
import { opcoesParcelas } from "@/lib/config-loja";
import { formatarPreco } from "@/lib/formatar";
import { infoCheckout } from "@/lib/pagamentos";
import { pacotesCertificado } from "@/lib/pacotes-certificado";
import { FormularioCheckout } from "@/components/checkout/FormularioCheckout";
import { TotalResumo } from "@/components/checkout/TotalResumo";
import { IconeCertificado, IconeCheck, IconeChevron } from "@/components/Icones";
import { usarCreditoCertificado } from "@/app/minha-conta/acoes";

export const metadata: Metadata = { title: "Emitir certificado", robots: { index: false } };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ pacote?: string }> };

export default async function EmitirCertificado({ params, searchParams }: Props) {
  const aluno = await exigirAluno();
  const [{ slug }, { pacote: escolhido = "" }] = await Promise.all([params, searchParams]);
  const c = await cursoDoAluno(aluno.email, slug);
  const s = await situacaoCertificado(aluno.email, c);
  if (s.estado !== "aguardando_pagamento" || s.regra.modo !== "pago") redirect(`/minha-conta/cursos/${slug}#certificado`);
  const [pacotes, registro, creditos] = await Promise.all([pacotesCertificado(), obterAluno(aluno.email), saldoCreditos(aluno.email)]);
  const pacote = pacotes.find((p) => p.id === escolhido);
  const pagamento = await infoCheckout();
  // Viu a tela do certificado e ainda não comprou: e-mail de parabéns daqui a 1 hora (cancelado se comprar antes).
  if (s.estado === "aguardando_pagamento") after(() => lembrarDeComprar(aluno.email, c.curso.id));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href={pacote ? `/minha-conta/cursos/${slug}/certificado` : `/minha-conta/cursos/${slug}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-marca-900">
        <IconeChevron className="h-4 w-4 rotate-90" /> {pacote ? "Ver as outras opções" : c.curso.nome}
      </Link>

      {!pacote ? (
        <>
          <div className="mt-6 text-center">
            <IconeCertificado className="mx-auto h-10 w-10 text-laranja-600" />
            <p className="mt-3 text-sm font-bold uppercase tracking-widest text-laranja-600">Parabéns, você concluiu!</p>
            <h1 className="mt-2 text-3xl font-extrabold text-marca-900 sm:text-4xl">Emita seu certificado</h1>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600">
              Certificado digital de <strong className="text-marca-900">{c.curso.nome}</strong> ({c.curso.cargaHoraria} horas), em PDF e com código de validação.
              Nos pacotes, os certificados que sobrarem ficam guardados para os próximos cursos que você concluir.
            </p>
          </div>

          {creditos > 0 && (
            <form action={usarCreditoCertificado} className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-between gap-4 rounded-3xl border-2 border-green-500 bg-green-50 p-6">
              <input type="hidden" name="slug" value={slug} />
              <p className="text-marca-900">
                Você tem <strong>{creditos} {creditos === 1 ? "certificado disponível" : "certificados disponíveis"}</strong> do seu pacote.
              </p>
              <button className="rounded-full bg-green-600 px-6 py-3 font-bold text-white hover:bg-green-700">Usar 1 agora</button>
            </form>
          )}

          <div className="mt-10 grid gap-6 md:grid-cols-3 md:items-stretch">
            {pacotes.map((p) => (
              <div key={p.id} className={`relative flex flex-col rounded-3xl border bg-white p-7 ${p.destaque ? "border-2 border-laranja-500 shadow-xl shadow-laranja-500/10" : "border-slate-200"}`}>
                {p.destaque && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-laranja-500 px-4 py-1 text-xs font-bold uppercase tracking-wider text-marca-900">{p.destaque}</span>
                )}
                <h2 className="text-lg font-bold text-marca-900">{p.nome}{p.quantidade > 1 ? ` — ${p.quantidade} certificados` : ""}</h2>
                <div className="mt-4">
                  {p.quantidade > 1 && <p className="text-sm text-slate-400 line-through">De {formatarPreco(p.precoCheioCentavos)}</p>}
                  <p className="font-display text-4xl font-extrabold text-marca-900">{formatarPreco(p.precoCentavos)}</p>
                </div>
                <ul className="mt-5 flex-1 space-y-2.5 text-sm text-slate-700">
                  <li className="flex gap-2"><IconeCheck className="h-5 w-5 shrink-0 text-green-600" /> {p.quantidade === 1 ? "1 certificado digital" : `${p.quantidade} certificados digitais`}</li>
                  <li className="flex gap-2">
                    <IconeCheck className="h-5 w-5 shrink-0 text-green-600" />
                    {p.quantidade === 1 ? "Pagamento único" : `${formatarPreco(p.porCertificadoCentavos)} por certificado`}
                  </li>
                </ul>
                {p.economiaCentavos > 0 && (
                  <p className="mt-5 rounded-xl bg-green-50 px-3 py-2 text-center text-sm font-semibold text-green-800">
                    Economize {formatarPreco(p.economiaCentavos)} — {p.descontoPct}% de desconto
                  </p>
                )}
                <Link
                  href={`/minha-conta/cursos/${slug}/certificado?pacote=${p.id}`}
                  className={`mt-5 block rounded-full py-3.5 text-center font-bold ${p.destaque ? "bg-laranja-500 text-marca-900 hover:bg-laranja-400" : "bg-marca-900 text-white hover:bg-marca-800"}`}
                >
                  {p.quantidade === 1 ? "Emitir certificado" : "Escolher pacote"}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-slate-500">Pix, boleto ou cartão em até 12x. O certificado é liberado assim que o pagamento é confirmado.</p>
        </>
      ) : (
        <>
          <h1 className="mt-4 text-3xl font-extrabold text-marca-900">Liberar certificado</h1>
          {(pagamento.gateway === "simulador" || pagamento.emTeste) && (
            <p className="mt-4 rounded-2xl border border-laranja-500/40 bg-laranja-300/20 p-4 text-sm text-marca-900">
              <strong>Modo de teste:</strong> nenhum valor será cobrado.
              {pagamento.emTeste && <> No cartão, use um cartão de teste do Mercado Pago com o nome <strong>APRO</strong>.</>}
            </p>
          )}
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
            <FormularioCheckout
              pagamento={pagamento}
              tipo="certificado"
              pacote={pacote.id}
              cursoId={c.curso.id}
              precoCentavos={pacote.precoCentavos}
              parcelas={opcoesParcelas(pacote.precoCentavos)}
              nomeInicial={registro?.nome ?? undefined}
              emailInicial={aluno.email}
            />
            <aside className="order-first rounded-3xl border border-slate-200 bg-white p-6 lg:order-none">
              <IconeCertificado className="h-8 w-8 text-laranja-600" />
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-laranja-600">{pacote.nome}</p>
              <h2 className="mt-1 font-bold text-marca-900">{c.curso.nome}</h2>
              <p className="mt-1 text-sm text-slate-500">{c.curso.cargaHoraria} horas · PDF com código de validação</p>
              {pacote.quantidade > 1 && (
                <p className="mt-3 rounded-xl bg-marca-50 p-3 text-sm text-marca-900">
                  {pacote.quantidade} certificados: 1 para este curso e <strong>{pacote.quantidade - 1} para os próximos</strong> cursos gratuitos que você concluir.
                </p>
              )}
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="font-semibold text-slate-600">Total</span>
                <TotalResumo valorCentavos={pacote.precoCentavos} riscadoCentavos={pacote.quantidade > 1 ? pacote.precoCheioCentavos : undefined} />
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
