import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/admin";
import { formatarPreco } from "@/lib/formatar";
import { getCursos } from "@/lib/cursos";
import { listarVendasRegistradas } from "@/lib/dados/avisos-venda";
import { CANAIS, nomeOrigem } from "@/lib/origem";
import { SITE_OFICIAL } from "@/lib/site";
import { Caixa, Numero, Titulo, Vazio } from "@/components/admin/Blocos";
import { GeradorLinks } from "@/components/admin/GeradorLinks";
import { inicioUltimosDias } from "@/lib/dias";

export const metadata: Metadata = { title: "De onde vêm as vendas" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ periodo?: string }> };

const PERIODOS = { hoje: "Hoje", sete: "Últimos 7 dias", trinta: "Últimos 30 dias", mes: "Este mês" } as const;
type Periodo = keyof typeof PERIODOS;

function inicioDoPeriodo(p: Periodo): string {
  const hojeBR = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  if (p === "hoje") return new Date(`${hojeBR}T00:00:00-03:00`).toISOString();
  if (p === "mes") return new Date(`${hojeBR.slice(0, 7)}-01T00:00:00-03:00`).toISOString();
  return inicioUltimosDias(p === "sete" ? 7 : 30);
}

export default async function OrigemDasVendas({ searchParams }: Props) {
  await exigirAdmin("financeiro");
  const pedido = (await searchParams).periodo;
  const periodo: Periodo = pedido && pedido in PERIODOS ? (pedido as Periodo) : "trinta";
  const [vendas, cursos] = await Promise.all([listarVendasRegistradas(inicioDoPeriodo(periodo)).catch(() => []), getCursos()]);

  // Agrupa por canal (+ anúncio ou não).
  const grupos = new Map<string, { nome: string; qtd: number; total: number; campanhas: Map<string, number> }>();
  for (const v of vendas) {
    const chave = v.origem ? `${v.origem.canal}|${v.origem.anuncio ? 1 : 0}` : "nenhuma";
    const g = grupos.get(chave) ?? { nome: v.origem ? nomeOrigem(v.origem) : "Direto ou não identificado", qtd: 0, total: 0, campanhas: new Map() };
    g.qtd++;
    g.total += v.valorCentavos ?? 0;
    if (v.origem?.campanha) g.campanhas.set(v.origem.campanha, (g.campanhas.get(v.origem.campanha) ?? 0) + 1);
    grupos.set(chave, g);
  }
  const linhas = [...grupos.values()].sort((a, b) => b.total - a.total || b.qtd - a.qtd);
  const total = vendas.reduce((s, v) => s + (v.valorCentavos ?? 0), 0);
  const identificadas = vendas.filter((v) => v.origem).length;
  const melhor = linhas.find((l) => !l.nome.startsWith("Direto"));

  const paginas = [
    { rotulo: "Página inicial", caminho: "/" },
    { rotulo: "Todos os cursos", caminho: "/cursos" },
    { rotulo: "Cursos gratuitos", caminho: "/cursos?tipo=gratuitos" },
    ...cursos.filter((c) => c.visivel).map((c) => ({ rotulo: `Curso: ${c.nome}`, caminho: `/cursos/${c.slug}` })),
  ];
  // O link de "cursos gratuitos" já tem "?": o gerador junta com "&".
  const paginasSemQuery = paginas.map((p) => (p.caminho.includes("?") ? { ...p, caminho: p.caminho.split("?")[0] } : p));

  return (
    <>
      <Titulo descricao="Por onde chegou quem comprou: Instagram, Facebook, Google, WhatsApp... Conta a partir do dia em que esta função foi publicada. Para saber com certeza, divulgue sempre com os links do gerador abaixo.">
        De onde vêm as vendas
      </Titulo>

      <form className="mb-6 flex flex-wrap gap-2 text-sm">
        {(Object.keys(PERIODOS) as Periodo[]).map((p) => (
          <button key={p} name="periodo" value={p} className={`rounded-full px-4 py-2 font-semibold ${p === periodo ? "bg-emerald-500 text-neutral-950" : "border border-slate-300 bg-white text-marca-900 hover:border-emerald-500"}`}>
            {PERIODOS[p]}
          </button>
        ))}
      </form>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Numero rotulo="Vendas no período" valor={String(vendas.length)} detalhe={formatarPreco(total)} cor="verde" dica="Pagamentos confirmados no período escolhido." />
        <Numero rotulo="Com origem conhecida" valor={vendas.length ? `${Math.round((identificadas / vendas.length) * 100)}%` : "—"} detalhe={`${identificadas} de ${vendas.length}`} dica="Quantas vendas têm o lugar de onde a pessoa veio. O resto entrou digitando o endereço ou por um link sem marca." />
        <Numero rotulo="O que mais vende" valor={melhor?.nome ?? "—"} detalhe={melhor ? `${melhor.qtd} ${melhor.qtd === 1 ? "venda" : "vendas"} · ${formatarPreco(melhor.total)}` : "ainda sem dados"} cor="laranja" dica="O lugar que trouxe mais dinheiro no período." />
      </div>

      <Caixa titulo="Vendas por origem">
        {!linhas.length ? (
          <Vazio>Nenhuma venda no período ainda. Assim que entrar a primeira, ela aparece aqui com o lugar de onde a pessoa veio.</Vazio>
        ) : (
          <ul className="space-y-4">
            {linhas.map((l) => (
              <li key={l.nome}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold text-marca-900">{l.nome}</span>
                  <span className="text-slate-600">
                    {l.qtd} {l.qtd === 1 ? "venda" : "vendas"} · <strong className="text-marca-900">{formatarPreco(l.total)}</strong>
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${total ? Math.max(2, (l.total / total) * 100) : 0}%` }} />
                </div>
                {l.campanhas.size > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    Campanhas: {[...l.campanhas].map(([c, n]) => `${c} (${n})`).join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Caixa>

      <Caixa titulo="Gerador de links para divulgar" className="mt-6">
        <p className="mb-4 text-sm text-slate-600">
          Escolha onde vai postar e copie o link. Quem clicar e comprar aparece aqui com essa origem. Use um link diferente para cada lugar
          ({Object.values(CANAIS).slice(0, 4).join(", ")}...).
        </p>
        <GeradorLinks site={SITE_OFICIAL} paginas={paginasSemQuery.filter((p, i, a) => a.findIndex((x) => x.caminho === p.caminho) === i)} />
      </Caixa>
    </>
  );
}
