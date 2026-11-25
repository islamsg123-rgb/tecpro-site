import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/admin";
import { obterTaxas, TAXAS_PADRAO } from "@/lib/taxas";
import { Caixa, Titulo } from "@/components/admin/Blocos";
import { salvarTaxasAcao } from "./acoes";

export const metadata: Metadata = { title: "Taxas e prazos" };
export const dynamic = "force-dynamic";

const br = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function Taxas({ searchParams }: { searchParams: Promise<{ salvo?: string }> }) {
  await exigirAdmin("financeiro");
  const [t, { salvo }] = await Promise.all([obterTaxas(), searchParams]);
  const campo = "w-28 rounded-xl border border-slate-300 bg-white px-3 py-2 text-right";
  const linhas: [string, string, string, string, number, string, number][] = [
    ["Pix", "pixPct", "%", "diasPix", t.pixPct, "", t.diasPix],
    ["Cartão de crédito", "cartaoPct", "%", "diasCartao", t.cartaoPct, "", t.diasCartao],
    ["Boleto", "boleto", "R$ por boleto", "diasBoleto", t.boletoCentavos / 100, "", t.diasBoleto],
  ];

  return (
    <>
      <Titulo descricao="Quanto o Mercado Pago cobra em cada forma de pagamento e em quantos dias o dinheiro fica disponível. Servem para calcular quanto fica para a Tecpro quando o Mercado Pago ainda não informou a taxa exata da venda.">
        Taxas e prazos
      </Titulo>
      <Caixa titulo="Suas taxas no Mercado Pago">
        <p className="mb-4 text-sm text-slate-600">
          Confira no app do Mercado Pago em <strong>Seu negócio &gt; Custos</strong> (ou <strong>Tarifas e prazos</strong>) e copie aqui.
          Quando o Mercado Pago informa a taxa real de uma venda, o painel usa a real e ignora estes números.
        </p>
        <form action={salvarTaxasAcao} className="space-y-4 text-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead className="text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="py-2 pr-4 font-semibold">Forma</th><th className="py-2 pr-4 font-semibold">Taxa</th><th className="py-2 font-semibold">Dinheiro disponível em</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linhas.map(([nome, kTaxa, unidade, kDias, taxa, , dias]) => (
                  <tr key={kTaxa}>
                    <td className="py-3 pr-4 font-semibold text-marca-900">{nome}</td>
                    <td className="py-3 pr-4"><input name={kTaxa} defaultValue={br(taxa)} inputMode="decimal" className={campo} aria-label={`Taxa ${nome}`} /> <span className="text-slate-500">{unidade}</span></td>
                    <td className="py-3"><input name={kDias} defaultValue={dias} inputMode="numeric" className={campo} aria-label={`Dias ${nome}`} /> <span className="text-slate-500">dias (0 = na hora)</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            Padrão: Pix {br(TAXAS_PADRAO.pixPct)}%, cartão {br(TAXAS_PADRAO.cartaoPct)}% com dinheiro na hora, boleto R$ {br(TAXAS_PADRAO.boletoCentavos / 100)}.
            No cartão, se você escolheu receber em 14 ou 30 dias, a taxa é menor: coloque a sua taxa e o número de dias.
          </p>
          <div className="flex items-center gap-3">
            <button className="rounded-full bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700">Salvar</button>
            {salvo && <span className="font-semibold text-emerald-700">Salvo!</span>}
          </div>
        </form>
      </Caixa>
    </>
  );
}
