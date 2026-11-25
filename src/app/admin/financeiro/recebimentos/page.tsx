import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/lib/admin";
import { formatarPreco } from "@/lib/formatar";
import { cobrancasParaRelatorio, mesDoPagamento, nomeMes } from "@/lib/painel-resumo";
import { TabelaVendas } from "@/components/admin/TabelaVendas";
import { Titulo, Vazio } from "@/components/admin/Blocos";
import { BotaoExportar } from "@/components/admin/BotaoExportar";
import { financasDaVenda, obterTaxas } from "@/lib/taxas";

export const metadata: Metadata = { title: "Extrato de vendas" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ mes?: string; forma?: string; situacao?: string; tipo?: string; busca?: string }> };

export default async function Recebimentos({ searchParams }: Props) {
  await exigirAdmin("financeiro");
  const { mes = "", forma = "", situacao = "", tipo = "", busca = "" } = await searchParams;
  const [todas, taxas] = await Promise.all([cobrancasParaRelatorio(), obterTaxas()]);
  const termo = busca.trim().toLowerCase();
  const lista = todas.filter((c) => {
    if (mes && mesDoPagamento(c) !== mes) return false;
    if (forma && c.forma !== forma) return false;
    if (situacao && c.situacao !== situacao) return false;
    if (tipo && c.produto?.tipo !== tipo) return false;
    if (termo && !`${c.cliente ?? ""} ${c.descricao ?? ""} ${c.id}`.toLowerCase().includes(termo)) return false;
    return true;
  });
  const meses = Array.from(new Set(todas.map(mesDoPagamento))).sort().reverse();
  const pagas = lista.filter((c) => c.situacao === "pago");
  const sel = "rounded-full border border-slate-300 bg-white px-3 py-2";

  return (
    <>
      <Titulo acao={<BotaoExportar tipo="vendas" />} descricao="Cada matrícula e cada certificado vendido: forma de pagamento, situação, a taxa do Mercado Pago, quanto fica para a Tecpro e o dia em que o dinheiro cai. Use os filtros para achar um pagamento.">
        Extrato de vendas
      </Titulo>
      <form className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <select name="mes" defaultValue={mes} className={sel} aria-label="Mês">
          <option value="">Todos os meses</option>
          {meses.map((m) => <option key={m} value={m}>{nomeMes(m)}</option>)}
        </select>
        <select name="tipo" defaultValue={tipo} className={sel} aria-label="Tipo">
          <option value="">Matrículas e certificados</option>
          <option value="curso">Só matrículas</option>
          <option value="certificado">Só certificados</option>
        </select>
        <select name="forma" defaultValue={forma} className={sel} aria-label="Forma">
          <option value="">Todas as formas</option>
          <option value="PIX">Pix</option>
          <option value="CREDIT_CARD">Cartão</option>
          <option value="BOLETO">Boleto</option>
        </select>
        <select name="situacao" defaultValue={situacao} className={sel} aria-label="Situação">
          <option value="">Todas as situações</option>
          <option value="pago">Pago</option>
          <option value="aguardando">Aguardando</option>
          <option value="vencido">Vencido</option>
          <option value="estornado">Estornado</option>
        </select>
        <input name="busca" defaultValue={busca} placeholder="Nome, e-mail ou curso" className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 sm:w-56" />
        <button className="rounded-full bg-marca-900 px-4 py-2 font-semibold text-white">Filtrar</button>
        {(mes || forma || situacao || tipo || busca) && <Link href="/admin/financeiro/recebimentos" className="px-2 text-slate-500 underline">limpar</Link>}
      </form>
      <p className="mb-4 text-sm text-slate-600">
        {lista.length} {lista.length === 1 ? "cobrança" : "cobranças"} · pagas: <strong className="text-marca-900">{formatarPreco(pagas.reduce((s, c) => s + c.valorCentavos, 0))}</strong>
        {" "}· ficam para a Tecpro: <strong className="text-emerald-700">{pagas.some((c) => financasDaVenda(c, taxas).estimado) ? "≈ " : ""}{formatarPreco(pagas.reduce((s, c) => s + financasDaVenda(c, taxas).liquidoCentavos, 0))}</strong>
      </p>
      {lista.length ? <TabelaVendas vendas={lista} taxas={taxas} /> : <Vazio>Nenhuma cobrança com esses filtros.</Vazio>}
    </>
  );
}
