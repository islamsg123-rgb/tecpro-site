import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatarPreco, getCursoPorSlug } from "@/lib/cursos";
import { opcoesParcelas } from "@/lib/config-loja";
import { pagamentoEmSimulacao } from "@/lib/pagamentos";
import { CapaCurso } from "@/components/CapaCurso";
import { FormularioCheckout } from "@/components/checkout/FormularioCheckout";
import { IconeCadeado, IconeCertificado, IconeCheck, IconeChevron, IconeRelogio } from "@/components/Icones";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Finalizar matrícula", robots: { index: false } };

export default async function Checkout({ params }: Props) {
  const curso = await getCursoPorSlug((await params).slug);
  if (!curso) notFound();

  return (
    <div className="bg-[#f3f6fb]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <Link href={`/cursos/${curso.slug}`} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-marca-900">
          <IconeChevron className="h-4 w-4 rotate-90" /> Voltar para o curso
        </Link>
        <h1 className="mt-4 text-3xl font-extrabold text-marca-900 sm:text-4xl">Finalizar matrícula</h1>
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <IconeCadeado className="h-4 w-4 text-green-600" /> Ambiente seguro. Seus dados são protegidos.
        </p>

        {pagamentoEmSimulacao && (
          <div className="mt-6 rounded-2xl border border-laranja-500/40 bg-laranja-300/20 p-4 text-sm text-marca-900">
            <strong>Modo de teste:</strong> nenhum valor será cobrado. Use qualquer CPF válido.
            No cartão, qualquer número válido é aprovado; o 4000 0000 0000 0002 simula recusa. O Pix é “pago” sozinho em 20 segundos.
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
          <FormularioCheckout cursoId={curso.id} precoCentavos={curso.precoCentavos} parcelas={opcoesParcelas(curso.precoCentavos)} />

          <aside className="order-first overflow-hidden rounded-3xl border border-slate-200 bg-white lg:sticky lg:top-24 lg:order-none">
            <div className="flex gap-4 p-5 lg:block lg:p-0">
              <div className="w-28 shrink-0 overflow-hidden rounded-xl lg:w-full lg:rounded-none">
                <CapaCurso curso={curso} comTitulo={false} />
              </div>
              <div className="min-w-0 lg:p-6 lg:pb-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-laranja-600">Seu curso</p>
                <h2 className="mt-1 font-bold leading-snug text-marca-900">{curso.nome}</h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                  <IconeRelogio className="h-4 w-4" /> {curso.cargaHoraria} horas
                </p>
              </div>
            </div>
            <div className="hidden px-6 pt-5 lg:block">
              <ul className="space-y-2.5 text-sm text-slate-600">
                {["Acesso liberado após o pagamento", "Aulas no celular e computador", "Estude no seu ritmo"].map((t) => (
                  <li key={t} className="flex items-center gap-2"><IconeCheck className="h-4 w-4 text-laranja-600" /> {t}</li>
                ))}
                <li className="flex items-center gap-2"><IconeCertificado className="h-4 w-4 text-laranja-600" /> Certificado de conclusão</li>
              </ul>
            </div>
            <div className="mx-5 mb-5 mt-1 flex items-center justify-between border-t border-slate-100 pt-4 lg:mx-6 lg:mb-6 lg:mt-6 lg:pt-5">
              <span className="font-semibold text-slate-600">Total</span>
              <span className="font-display text-2xl font-extrabold text-marca-900">{formatarPreco(curso.precoCentavos)}</span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
