import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCursos } from "@/lib/cursos";
import { formatarPreco } from "@/lib/formatar";
import { consultarCobranca, dadosBoleto, dadosPix } from "@/lib/pagamentos";
import { AcompanharPagamento } from "@/components/checkout/AcompanharPagamento";
import { BotaoCopiar } from "@/components/checkout/BotaoCopiar";
import { IconeCheck, IconeCodigoBarras, IconeEmail, IconePix, IconeSeta } from "@/components/Icones";

export const metadata: Metadata = { title: "Seu pedido", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function dataBR(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export default async function Pedido({ params }: Props) {
  const { id } = await params;
  const cobranca = await consultarCobranca(id);
  if (!cobranca) notFound();
  const curso = (await getCursos()).find((c) => c.id === cobranca.cursoId);
  const nomeCurso = curso?.nome ?? "Curso Tecpro";

  /* ----- Pago ----- */
  if (cobranca.situacao === "pago") {
    return (
      <section className="mx-auto max-w-xl px-4 py-16 text-center sm:py-24">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
          <IconeCheck className="h-10 w-10" />
        </span>
        <h1 className="mt-6 text-3xl font-extrabold text-marca-900 sm:text-4xl">Matrícula confirmada!</h1>
        <p className="mt-4 text-lg text-slate-600">
          Pagamento de <strong className="text-marca-900">{formatarPreco(cobranca.valorCentavos)}</strong> recebido para o curso{" "}
          <strong className="text-marca-900">{nomeCurso}</strong>.
        </p>
        <div className="mt-8 flex items-start gap-4 rounded-3xl border border-slate-200 bg-white p-6 text-left">
          <IconeEmail className="h-7 w-7 shrink-0 text-laranja-600" />
          <div>
            <p className="font-bold text-marca-900">Confira seu e-mail</p>
            <p className="mt-1 text-sm text-slate-600">
              Enviamos o seu login e a sua senha de acesso. Se não encontrar, olhe a caixa de spam ou promoções.
            </p>
          </div>
        </div>
        <Link href="/minha-conta" className="mt-8 inline-flex items-center gap-2 rounded-full bg-laranja-500 px-8 py-4 font-bold text-marca-900 hover:bg-laranja-400">
          Ir para a área do aluno <IconeSeta className="h-5 w-5" />
        </Link>
      </section>
    );
  }

  /* ----- Vencido / estornado ----- */
  if (cobranca.situacao !== "aguardando") {
    return (
      <section className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-3xl font-extrabold text-marca-900">
          {cobranca.situacao === "vencido" ? "Este pagamento venceu" : "Este pagamento foi estornado"}
        </h1>
        <p className="mt-4 text-slate-600">Você pode fazer um novo pedido quando quiser.</p>
        {curso && (
          <Link href={`/checkout/${curso.slug}`} className="mt-8 inline-block rounded-full bg-laranja-500 px-8 py-4 font-bold text-marca-900">
            Fazer novo pedido
          </Link>
        )}
      </section>
    );
  }

  /* ----- Aguardando: Pix ou boleto ----- */
  const ePix = cobranca.forma === "PIX";
  const pix = ePix ? await dadosPix(id) : null;
  const boleto = cobranca.forma === "BOLETO" ? await dadosBoleto(cobranca) : null;

  return (
    <section className="bg-[#f3f6fb] px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-lg">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-marca-900 text-laranja-500">
            {ePix ? <IconePix className="h-7 w-7" /> : <IconeCodigoBarras className="h-7 w-7" />}
          </span>
          <h1 className="mt-5 text-3xl font-extrabold text-marca-900">
            {ePix ? "Pague com Pix para liberar seu acesso" : "Seu boleto está pronto"}
          </h1>
          <p className="mt-3 text-slate-600">
            {nomeCurso} · <strong className="text-marca-900">{formatarPreco(cobranca.valorCentavos)}</strong>
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-marca-900/5 sm:p-8">
          {pix && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${pix.imagemBase64}`}
                alt="QR Code do Pix"
                className="mx-auto h-60 w-60 rounded-2xl border border-slate-100 p-2"
              />
              <ol className="mt-6 space-y-2 text-sm text-slate-600">
                <li>1. Abra o app do seu banco e escolha <strong>Pix</strong>.</li>
                <li>2. Escaneie o QR Code ou use o <strong>Pix copia e cola</strong>.</li>
                <li>3. Confirme o pagamento. Pronto!</li>
              </ol>
              <p className="mt-6 break-all rounded-xl bg-marca-50 p-3 font-mono text-xs text-slate-600">{pix.copiaECola}</p>
              <div className="mt-4">
                <BotaoCopiar texto={pix.copiaECola} rotulo="Copiar código Pix" />
              </div>
            </>
          )}
          {boleto && (
            <>
              <p className="text-sm font-medium text-slate-600">Linha digitável</p>
              <p className="mt-2 break-all rounded-xl bg-marca-50 p-3 font-mono text-sm text-marca-900">{boleto.linhaDigitavel}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <BotaoCopiar texto={boleto.linhaDigitavel} rotulo="Copiar código" />
                <a
                  href={boleto.linkPdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full border-2 border-marca-900 px-6 py-3 font-bold text-marca-900 hover:bg-marca-50"
                >
                  Abrir boleto
                </a>
              </div>
              <p className="mt-5 text-sm text-slate-500">
                Vencimento: <strong className="text-marca-900">{dataBR(cobranca.vencimento)}</strong>. Após o pagamento, a compensação leva até 3 dias úteis.
              </p>
            </>
          )}
          <div className="mt-6 border-t border-slate-100 pt-5 text-center">
            <AcompanharPagamento id={id} />
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Assim que o pagamento for confirmado, enviamos o acesso para o seu e-mail.
        </p>
      </div>
    </section>
  );
}
