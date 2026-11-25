import type { Cobranca } from "@/lib/pagamentos/tipos";
import { formatarPreco } from "@/lib/formatar";
import { EtiquetaSituacao, nomeForma } from "./EtiquetaSituacao";
import Link from "next/link";
import { matricularDeNovo } from "@/app/admin/acoes";
import { financasDaVenda, type TaxasPagamento } from "@/lib/taxas";
import { Dica } from "./Dica";

function data(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Lista de vendas. Com `taxas`, mostra também a taxa, quanto fica para a Tecpro e o dia em que o dinheiro cai. */
export function TabelaVendas({ vendas, taxas }: { vendas: Cobranca[]; taxas?: TaxasPagamento }) {
  if (!vendas.length) {
    return <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Nenhuma venda ainda.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className={`w-full text-left text-sm ${taxas ? "min-w-[1180px]" : "min-w-[860px]"}`}>
        <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            {!taxas && <th className="px-5 py-3 font-semibold">Data</th>}
            <th className="whitespace-nowrap px-5 py-3 font-semibold">Pago em</th>
            <th className="px-5 py-3 font-semibold">Descrição</th>
            <th className="px-5 py-3 font-semibold">Cliente</th>
            <th className="px-5 py-3 font-semibold">Forma</th>
            <th className="px-5 py-3 text-right font-semibold">Valor</th>
            {taxas && (
              <>
                <th className="px-5 py-3 text-right font-semibold"><Dica texto="O que o Mercado Pago cobrou. Com ≈ é estimativa (o Mercado Pago ainda não informou a taxa exata).">Taxa</Dica></th>
                <th className="px-5 py-3 text-right font-semibold">Fica p/ Tecpro</th>
                <th className="px-5 py-3 font-semibold"><Dica texto="Dia em que o dinheiro fica disponível para saque no Mercado Pago.">Cai em</Dica></th>
              </>
            )}
            <th className="px-5 py-3 font-semibold">Situação</th>
            <th className="px-5 py-3 font-semibold"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {vendas.map((v) => (
            <tr key={v.id} className="hover:bg-marca-50/50">
              {!taxas && <td className="whitespace-nowrap px-5 py-3 text-slate-500">{data(v.criadoEm)}</td>}
              <td className="whitespace-nowrap px-5 py-3 text-slate-500">{v.situacao === "pago" ? data(v.pagoEm) : v.situacao === "aguardando" ? `vence ${data(v.vencimento)}` : "—"}</td>
              <td className="min-w-[220px] px-5 py-3 font-medium text-marca-900">{(v.descricao ?? v.id).replace(/^Curso online: /, "")}</td>
              <td className="px-5 py-3 text-slate-600">
                {v.clienteEmail ? (
                  <Link href={`/admin/alunos/ficha?email=${encodeURIComponent(v.clienteEmail)}`} className="hover:text-marca-900 hover:underline">{v.cliente ?? v.clienteEmail}</Link>
                ) : (v.cliente ?? "—")}
              </td>
              <td className="px-5 py-3 text-slate-600">{nomeForma[v.forma] ?? v.forma}</td>
              <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-marca-900">{formatarPreco(v.valorCentavos)}</td>
              {taxas && (() => {
                if (v.situacao !== "pago") return <><td className="px-5 py-3 text-right text-slate-400">—</td><td className="px-5 py-3 text-right text-slate-400">—</td><td className="px-5 py-3 text-slate-400">—</td></>;
                const f = financasDaVenda(v, taxas);
                const aprox = f.estimado ? "≈ " : "";
                return (
                  <>
                    <td className="whitespace-nowrap px-5 py-3 text-right text-red-700">{aprox}{formatarPreco(f.taxaCentavos)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-emerald-700">{aprox}{formatarPreco(f.liquidoCentavos)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500">{f.liberaEm ? data(f.liberaEm) : "—"}</td>
                  </>
                );
              })()}
              <td className="px-5 py-3"><EtiquetaSituacao s={v.situacao} /></td>
              <td className="px-5 py-3">
                {v.situacao === "pago" && v.produto?.tipo === "curso" && (
                  <form action={matricularDeNovo}>
                    <input type="hidden" name="cobrancaId" value={v.id} />
                    <button className="whitespace-nowrap rounded-full border border-marca-100 px-3 py-1 text-xs font-semibold text-marca-700 hover:bg-marca-50">
                      Matricular de novo
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
