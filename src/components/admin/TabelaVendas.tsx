import type { Cobranca } from "@/lib/pagamentos/tipos";
import { formatarPreco } from "@/lib/formatar";
import { EtiquetaSituacao, nomeForma } from "./EtiquetaSituacao";
import { matricularDeNovo } from "@/app/admin/acoes";

function data(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function TabelaVendas({ vendas }: { vendas: Cobranca[] }) {
  if (!vendas.length) {
    return <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Nenhuma venda ainda.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-5 py-3 font-semibold">Data</th>
            <th className="px-5 py-3 font-semibold">Descrição</th>
            <th className="px-5 py-3 font-semibold">Cliente</th>
            <th className="px-5 py-3 font-semibold">Forma</th>
            <th className="px-5 py-3 text-right font-semibold">Valor</th>
            <th className="px-5 py-3 font-semibold">Situação</th>
            <th className="px-5 py-3 font-semibold"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {vendas.map((v) => (
            <tr key={v.id} className="hover:bg-marca-50/50">
              <td className="whitespace-nowrap px-5 py-3 text-slate-500">{data(v.criadoEm)}</td>
              <td className="px-5 py-3 font-medium text-marca-900">{v.descricao ?? v.id}</td>
              <td className="px-5 py-3 text-slate-600">{v.cliente ?? "—"}</td>
              <td className="px-5 py-3 text-slate-600">{nomeForma[v.forma] ?? v.forma}</td>
              <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-marca-900">{formatarPreco(v.valorCentavos)}</td>
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
