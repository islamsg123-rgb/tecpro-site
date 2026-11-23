import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cursoDoAluno, exigirAluno } from "@/lib/area-aluno";
import { situacaoCertificado } from "@/lib/certificados";
import { obterAluno } from "@/lib/dados";
import { opcoesParcelas } from "@/lib/config-loja";
import { formatarPreco } from "@/lib/formatar";
import { pagamentoEmSimulacao } from "@/lib/pagamentos";
import { FormularioCheckout } from "@/components/checkout/FormularioCheckout";
import { IconeCertificado, IconeChevron } from "@/components/Icones";

export const metadata: Metadata = { title: "Pagar certificado", robots: { index: false } };

type Props = { params: Promise<{ slug: string }> };

export default async function PagarCertificado({ params }: Props) {
  const aluno = await exigirAluno();
  const { slug } = await params;
  const c = await cursoDoAluno(aluno.email, slug);
  const s = await situacaoCertificado(aluno.email, c);
  if (s.estado !== "aguardando_pagamento" || s.regra.modo !== "pago") redirect(`/minha-conta/cursos/${slug}#certificado`);
  const preco = s.regra.precoCentavos;
  const registro = await obterAluno(aluno.email);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href={`/minha-conta/cursos/${slug}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-marca-900">
        <IconeChevron className="h-4 w-4 rotate-90" /> {c.curso.nome}
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold text-marca-900">Liberar certificado</h1>
      {pagamentoEmSimulacao && (
        <p className="mt-4 rounded-2xl border border-laranja-500/40 bg-laranja-300/20 p-4 text-sm text-marca-900">
          <strong>Modo de teste:</strong> nenhum valor será cobrado.
        </p>
      )}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
        <FormularioCheckout
          tipo="certificado"
          cursoId={c.curso.id}
          precoCentavos={preco}
          parcelas={opcoesParcelas(preco)}
          nomeInicial={registro?.nome ?? undefined}
          emailInicial={aluno.email}
        />
        <aside className="order-first rounded-3xl border border-slate-200 bg-white p-6 lg:order-none">
          <IconeCertificado className="h-8 w-8 text-laranja-600" />
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-laranja-600">Certificado de conclusão</p>
          <h2 className="mt-1 font-bold text-marca-900">{c.curso.nome}</h2>
          <p className="mt-1 text-sm text-slate-500">{c.curso.cargaHoraria} horas · PDF com código de validação</p>
          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="font-semibold text-slate-600">Total</span>
            <span className="font-display text-2xl font-extrabold text-marca-900">{formatarPreco(preco)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
