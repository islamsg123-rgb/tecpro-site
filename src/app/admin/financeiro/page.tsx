import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/admin";
import { formatarPreco } from "@/lib/formatar";
import { saldoDisponivel } from "@/lib/pagamentos";
import { cobrancasParaRelatorio, nomeMes, resumoFinanceiro } from "@/lib/painel-resumo";
import { Caixa, GraficoMensal, Numero, PorForma, Titulo } from "@/components/admin/Blocos";
import { BotaoExportar } from "@/components/admin/BotaoExportar";
import { obterTaxas } from "@/lib/taxas";

export const metadata: Metadata = { title: "Resumo do mês" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ mes?: string }> };

export default async function Financeiro({ searchParams }: Props) {
  await exigirAdmin("financeiro");
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
  const pedido = (await searchParams).mes ?? "";
  const mes = /^\d{4}-\d{2}$/.test(pedido) ? pedido : hoje;
  const [cobrancas, saldo, taxas] = await Promise.all([cobrancasParaRelatorio(), saldoDisponivel(), obterTaxas()]);
  const r = resumoFinanceiro(cobrancas, mes, taxas);
  const meses = resumoFinanceiro(cobrancas, hoje).mensal.map((m) => m.mes).reverse();

  return (
    <>
      <Titulo
        acao={<BotaoExportar tipo="vendas" />}
        descricao="Tudo o que entrou e o que está para entrar, direto do sistema de pagamento (Mercado Pago e/ou Asaas). Os valores contam a data em que o aluno pagou."
      >
        Resumo do mês
      </Titulo>

      <form className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="mes" className="font-semibold text-marca-900">Mês:</label>
        <select id="mes" name="mes" defaultValue={mes} className="rounded-full border border-slate-300 bg-white px-4 py-2">
          {meses.map((m) => <option key={m} value={m}>{nomeMes(m)}</option>)}
        </select>
        <button className="rounded-full bg-marca-900 px-4 py-2 font-semibold text-white">Ver</button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Numero rotulo={`Recebido em ${nomeMes(mes)}`} valor={formatarPreco(r.recebidoMesCentavos)} detalhe={`mês anterior: ${formatarPreco(r.recebidoMesAnteriorCentavos)}`} cor="verde" dica="Total pago pelos clientes no mês escolhido, antes de descontar as taxas." />
        <Numero rotulo="Líquido (após taxas)" valor={formatarPreco(r.liquidoMesCentavos)} detalhe={`taxas: ${formatarPreco(r.recebidoMesCentavos - r.liquidoMesCentavos)}`} dica="O que sobra para a Tecpro depois das taxas do Mercado Pago ou do Asaas." />
        <Numero rotulo="A receber" valor={formatarPreco(r.aReceberCentavos)} detalhe="Pix e boletos ainda no prazo" href="/admin/financeiro/recebimentos?situacao=aguardando" cor="laranja" dica="Pix e boletos já gerados que ainda não venceram." />
        <Numero rotulo="Não pagos no prazo" valor={formatarPreco(r.emAtrasoCentavos)} detalhe="Pix e boletos não pagos" href="/admin/financeiro/devedores" cor="vermelho" dica="Pix e boletos que passaram do prazo sem pagamento. Veja em Recuperar vendas." />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Numero rotulo="Matrículas pagas" valor={String(r.matriculasMes)} detalhe="cursos pagos no mês" href={`/admin/financeiro/recebimentos?mes=${mes}&tipo=curso&situacao=pago`} dica="Quantos cursos foram comprados e pagos neste mês." />
        <Numero rotulo="Certificados pagos" valor={String(r.certificadosMes)} detalhe="emissões pagas no mês" href={`/admin/financeiro/recebimentos?mes=${mes}&tipo=certificado&situacao=pago`} dica="Quantos certificados (ou pacotes de certificados) foram pagos neste mês." />
        <Numero rotulo="Ticket médio" valor={formatarPreco(r.ticketMedioCentavos)} detalhe="valor médio por pagamento" dica="O valor médio de cada pagamento recebido no mês (total dividido pela quantidade)." />
        <Numero rotulo="Saldo para saque" valor={saldo === null ? "—" : formatarPreco(saldo)} detalhe={saldo === null ? "veja no app do Mercado Pago" : "disponível no Asaas"} cor="cinza" dica="Dinheiro já liberado para transferir para a sua conta. O do Mercado Pago só aparece no app dele." />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Caixa titulo="Faturamento dos últimos 12 meses" className="lg:col-span-2">
          <GraficoMensal meses={r.mensal} />
        </Caixa>
        <Caixa titulo={`Por forma de pagamento (${nomeMes(mes)})`}>
          <PorForma porForma={r.porForma} />
          {r.estornadoMesCentavos > 0 && <p className="mt-5 text-sm text-red-700">Estornos no mês: {formatarPreco(r.estornadoMesCentavos)}</p>}
        </Caixa>
      </div>

      <Caixa titulo="Mês a mês" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
              <tr><th className="py-2 font-semibold">Mês</th><th className="py-2 text-right font-semibold">Pagamentos</th><th className="py-2 text-right font-semibold">Faturamento</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...r.mensal].reverse().map((m) => (
                <tr key={m.mes}>
                  <td className="py-2 font-medium text-marca-900">{nomeMes(m.mes)}</td>
                  <td className="py-2 text-right text-slate-600">{m.quantidade}</td>
                  <td className="py-2 text-right font-semibold text-marca-900">{formatarPreco(m.centavos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Caixa>
      <p className="mt-4 text-xs text-slate-400">Considera as {cobrancas.length} cobranças mais recentes. Para extratos completos e saques, use o painel do Mercado Pago (ou do Asaas).</p>
    </>
  );
}
