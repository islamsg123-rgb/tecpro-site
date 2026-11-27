import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/lib/admin";
import { formatarPreco } from "@/lib/formatar";
import { cobrancasParaRelatorio } from "@/lib/painel-resumo";
import { listarVendasRegistradas } from "@/lib/dados/avisos-venda";
import { detalheOrigem } from "@/lib/origem";
import { financasDaVenda, obterTaxas } from "@/lib/taxas";
import { nomeForma } from "@/components/admin/EtiquetaSituacao";
import { Caixa, Numero, Titulo, Vazio } from "@/components/admin/Blocos";
import type { Cobranca } from "@/lib/pagamentos/tipos";
import { Itens, Recolhivel } from "@/components/ListaRecolhida";

export const metadata: Metadata = { title: "Hoje" };
export const dynamic = "force-dynamic";

const diaBR = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const somaDias = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00-03:00`);
  d.setDate(d.getDate() + n);
  return diaBR(d);
};
const nomeDia = (dia: string) => new Date(`${dia}T12:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", timeZone: "America/Sao_Paulo" }).replace(".", "");

/**
 * Financeiro > Hoje: a primeira tela do dinheiro. Quanto vendeu hoje, quanto fica para a Tecpro,
 * a comparação com ontem, cada venda do dia (com horário e de onde veio) e o que vai cair na conta.
 */
export default async function Hoje() {
  await exigirAdmin("financeiro");
  const hoje = diaBR(new Date());
  const ontem = somaDias(hoje, -1);
  const [cobrancas, taxas, registros] = await Promise.all([
    cobrancasParaRelatorio().catch(() => [] as Cobranca[]),
    obterTaxas(),
    listarVendasRegistradas(new Date(`${somaDias(hoje, -1)}T00:00:00-03:00`).toISOString()).catch(() => []),
  ]);
  const registro = new Map(registros.map((r) => [r.cobrancaId, r]));
  const pagas = cobrancas.filter((c) => c.situacao === "pago");
  const doDia = (d: string) => pagas.filter((c) => (c.pagoEm ?? "").slice(0, 10) === d);
  const soma = (l: Cobranca[]) => l.reduce((s, c) => s + c.valorCentavos, 0);

  const vendasHoje = doDia(hoje).sort((a, b) => (registro.get(b.id)?.em ?? "").localeCompare(registro.get(a.id)?.em ?? ""));
  const totalHoje = soma(vendasHoje);
  const totalOntem = soma(doDia(ontem));
  const fin = vendasHoje.map((c) => financasDaVenda(c, taxas));
  const liquidoHoje = fin.reduce((s, f) => s + f.liquidoCentavos, 0);
  const algumEstimado = fin.some((f) => f.estimado);
  const variacao = totalOntem ? Math.round(((totalHoje - totalOntem) / totalOntem) * 100) : null;
  const pendentesHoje = cobrancas.filter((c) => c.situacao === "aguardando" && String(c.criadoEm ?? "").slice(0, 10) === hoje);

  // Últimos 7 dias, dia a dia.
  const semana = Array.from({ length: 7 }, (_, i) => somaDias(hoje, i - 6)).map((d) => ({ dia: d, centavos: soma(doDia(d)), qtd: doDia(d).length }));
  const maxSemana = Math.max(1, ...semana.map((s) => s.centavos));

  // Dinheiro que ainda vai ficar disponível (cartão segura alguns dias, conforme o plano do Mercado Pago).
  const aCair = new Map<string, number>();
  for (const c of pagas) {
    const f = financasDaVenda(c, taxas);
    if (f.liberaEm && f.liberaEm > hoje) aCair.set(f.liberaEm, (aCair.get(f.liberaEm) ?? 0) + f.liquidoCentavos);
  }
  const proximos = [...aCair].sort(([a], [b]) => a.localeCompare(b)).slice(0, 8);

  return (
    <>
      <Titulo descricao="O dinheiro do dia: quanto entrou, quanto fica para a Tecpro depois das taxas e cada venda com o horário e de onde a pessoa veio. A página se atualiza ao abrir; o aviso com som avisa quando entrar venda nova.">
        Hoje
      </Titulo>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Numero rotulo="Vendido hoje" valor={formatarPreco(totalHoje)} detalhe={`${vendasHoje.length} ${vendasHoje.length === 1 ? "venda" : "vendas"}`} cor="verde" dica="Soma dos pagamentos confirmados hoje (cartão aprovado, Pix e boletos pagos)." />
        <Numero
          rotulo="Fica para a Tecpro"
          valor={formatarPreco(liquidoHoje)}
          detalhe={`taxas: ${formatarPreco(totalHoje - liquidoHoje)}${algumEstimado ? " (estimadas)" : ""}`}
          dica="O que sobra depois das taxas do Mercado Pago. Quando o Mercado Pago ainda não informou a taxa exata, usamos a estimativa de Financeiro > Taxas e prazos."
        />
        <Numero
          rotulo="Comparado a ontem"
          valor={variacao === null ? "—" : `${variacao >= 0 ? "+" : ""}${variacao}%`}
          detalhe={`ontem: ${formatarPreco(totalOntem)}`}
          cor={variacao !== null && variacao < 0 ? "vermelho" : "laranja"}
          dica="Diferença entre o que entrou hoje até agora e o dia de ontem inteiro."
        />
        <Numero
          rotulo="Pix e boletos de hoje esperando"
          valor={formatarPreco(soma(pendentesHoje))}
          detalhe={`${pendentesHoje.length} gerados e ainda não pagos`}
          href="/admin/financeiro/devedores"
          cor="cinza"
          dica="Pessoas que geraram Pix ou boleto hoje e ainda não pagaram. Se passar do prazo, aparecem em Recuperar vendas."
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Caixa titulo="Vendas de hoje" className="lg:col-span-2" acao={<Link href="/admin/financeiro/recebimentos" className="text-sm font-semibold text-marca-700 hover:underline">Extrato completo →</Link>}>
          {!vendasHoje.length ? (
            <Vazio>Nenhuma venda hoje ainda. Assim que entrar uma, ela aparece aqui (e o painel toca o aviso).</Vazio>
          ) : (
            <Recolhivel total={vendasHoje.length}><ul className="divide-y divide-slate-100"><Itens>
              {vendasHoje.map((c, i) => {
                const r = registro.get(c.id);
                const f = fin[i];
                const hora = r ? new Date(r.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "—";
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                    <span className="w-12 shrink-0 font-mono text-xs text-slate-500">{hora}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-marca-900">
                        {c.clienteEmail ? <Link href={`/admin/alunos/ficha?email=${encodeURIComponent(c.clienteEmail)}`} className="hover:underline">{(c.cliente ?? "").split(" · ")[0] || c.clienteEmail}</Link> : (c.cliente ?? "Cliente")}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {c.descricao} · {nomeForma[c.forma] ?? c.forma} · {detalheOrigem(r?.origem ?? null)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold text-marca-900">{formatarPreco(c.valorCentavos)}</span>
                      <span className="block text-xs text-emerald-700">fica {f.estimado ? "≈ " : ""}{formatarPreco(f.liquidoCentavos)}</span>
                    </span>
                  </li>
                );
              })}
            </Itens></ul></Recolhivel>
          )}
        </Caixa>

        <div className="space-y-6">
          <Caixa titulo="Últimos 7 dias">
            <div className="flex h-36 items-end gap-2" role="img" aria-label="Vendas dos últimos 7 dias">
              {semana.map((s) => (
                <div key={s.dia} className="group relative flex h-full flex-1 flex-col justify-end">
                  <div className={`rounded-t-md ${s.dia === hoje ? "bg-emerald-500" : "bg-marca-700/70 group-hover:bg-marca-700"}`} style={{ height: `${Math.max(s.centavos ? 4 : 1, (s.centavos / maxSemana) * 100)}%` }} />
                  <span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-marca-900 px-2 py-1 text-xs text-white group-hover:block">
                    {formatarPreco(s.centavos)} · {s.qtd}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              {semana.map((s) => <span key={s.dia} className="flex-1 text-center text-[10px] text-slate-500">{nomeDia(s.dia)}</span>)}
            </div>
          </Caixa>

          <Caixa titulo="Vai cair na conta">
            {!proximos.length ? (
              <p className="text-sm text-slate-500">Nada pendente: o dinheiro das vendas já está disponível no Mercado Pago (ou ainda não houve vendas no cartão).</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {proximos.map(([d, v]) => (
                  <li key={d} className="flex justify-between gap-3">
                    <span className="text-slate-600">{new Date(`${d}T12:00:00-03:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" })}</span>
                    <span className="font-semibold text-marca-900">{formatarPreco(v)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-500">
              O prazo depende do plano escolhido no Mercado Pago. Ajuste em <Link href="/admin/financeiro/taxas" className="underline">Taxas e prazos</Link>.
            </p>
          </Caixa>
        </div>
      </div>
    </>
  );
}
