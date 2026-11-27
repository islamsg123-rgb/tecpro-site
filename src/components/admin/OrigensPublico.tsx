import Link from "next/link";
import { CANAIS, nomeCampanha, nomeOrigem, type Canal } from "@/lib/origem";
import type { ResumoOrigens } from "@/lib/dados/online";
import { Itens, Recolhivel } from "@/components/ListaRecolhida";

/**
 * "De onde vem o público": visitas ao site por origem (Google, Instagram, Facebook, WhatsApp, e-mail, direto...).
 * Os números vêm do próprio site (não do Google Analytics), então aparecem na hora.
 */

export const PERIODOS_ORIGEM = { hoje: "Hoje", sete: "Últimos 7 dias", trinta: "Últimos 30 dias" } as const;
export type PeriodoOrigem = keyof typeof PERIODOS_ORIGEM;

const COR: Record<Canal, string> = {
  google: "#3b82f6",
  instagram: "#ec4899",
  facebook: "#4338ca",
  whatsapp: "#10b981",
  youtube: "#ef4444",
  tiktok: "#0f172a",
  email: "#f59e0b",
  outro: "#a78bfa",
  direto: "#94a3b8",
};
const REDES: Canal[] = ["instagram", "facebook", "whatsapp", "youtube", "tiktok"];

const nomeCurto = (canal: Canal, anuncio: boolean) =>
  canal === "direto" ? "Direto" : nomeOrigem({ canal, anuncio });
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const visitasTxt = (n: number) => (n === 1 ? "1 visita" : `${n.toLocaleString("pt-BR")} visitas`);

export function OrigensPublico({ dados, periodo }: { dados: ResumoOrigens; periodo: PeriodoOrigem }) {
  // Agrupa por canal + anúncio (a campanha e o site ficam nos detalhes).
  const porCanal = new Map<string, { canal: Canal; anuncio: boolean; visitas: number; pessoas: number }>();
  for (const g of dados.grupos) {
    const k = `${g.canal}|${g.anuncio}`;
    const x = porCanal.get(k) ?? { canal: g.canal, anuncio: g.anuncio, visitas: 0, pessoas: 0 };
    x.visitas += g.visitas;
    x.pessoas += g.pessoas; // aproximado: a mesma pessoa por 2 campanhas conta 2
    porCanal.set(k, x);
  }
  const linhas = [...porCanal.values()].sort((a, b) => b.visitas - a.visitas);
  const total = dados.visitas;
  const redes = linhas.filter((l) => REDES.includes(l.canal)).reduce((s, l) => s + l.visitas, 0);
  const google = linhas.filter((l) => l.canal === "google").reduce((s, l) => s + l.visitas, 0);
  const principal = linhas.find((l) => l.canal !== "direto");

  const somar = (lista: { nome: string; n: number }[]) => {
    const m = new Map<string, number>();
    for (const x of lista) m.set(x.nome, (m.get(x.nome) ?? 0) + x.n);
    return [...m].map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n);
  };
  const sites = somar(dados.grupos.filter((g) => g.canal === "outro" && g.site).map((g) => ({ nome: g.site, n: g.visitas })));
  const campanhas = somar(
    dados.grupos.filter((g) => g.campanha).map((g) => ({ nome: `${nomeCurto(g.canal, g.anuncio)} · ${nomeCampanha(g.campanha)}`, n: g.visitas })),
  );

  // Barras por dia (7 ou 30 dias), cada cor uma origem.
  const diasLista: string[] = [];
  if (periodo !== "hoje") {
    const n = periodo === "sete" ? 7 : 30;
    const hoje = new Date(`${new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })}T12:00:00Z`);
    for (let i = n - 1; i >= 0; i--) diasLista.push(new Date(hoje.getTime() - i * 86400_000).toISOString().slice(0, 10));
  }
  const porDia = new Map<string, Map<Canal, number>>();
  for (const d of dados.dias) {
    const m = porDia.get(d.dia) ?? new Map<Canal, number>();
    m.set(d.canal, (m.get(d.canal) ?? 0) + d.visitas);
    porDia.set(d.dia, m);
  }
  const maxDia = Math.max(1, ...diasLista.map((d) => [...(porDia.get(d)?.values() ?? [])].reduce((s, n) => s + n, 0)));
  const ordemCanais = [...new Set(linhas.map((l) => l.canal))];

  return (
    <section id="origens" className="mb-6 min-w-0 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-marca-900">De onde vem o público</h2>
          <p className="text-xs text-slate-500">Por onde as pessoas chegaram ao site: Google, redes sociais, e-mails, direto...</p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm" aria-label="Período">
          {(Object.keys(PERIODOS_ORIGEM) as PeriodoOrigem[]).map((p) => (
            <Link
              key={p}
              href={`/admin/online?periodo=${p}#origens`}
              scroll={false}
              className={`rounded-full px-4 py-1.5 font-semibold ${p === periodo ? "bg-marca-900 text-white" : "border border-slate-300 bg-white text-marca-900 hover:border-marca-900"}`}
            >
              {PERIODOS_ORIGEM[p]}
            </Link>
          ))}
        </nav>
      </div>

      {dados.tabelaFaltando ? (
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Falta um passo no banco:</strong> rode o arquivo <code>origens-publico.sql</code> no Supabase (SQL Editor &gt; New query &gt; colar &gt; Run). Depois disso, as visitas começam a ser contadas.
        </p>
      ) : !total ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Ainda sem visitas contadas neste período. A contagem começa a partir de agora: cada pessoa que abrir o site aparece aqui com o lugar de onde veio.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Cartao rotulo="Visitas" valor={total.toLocaleString("pt-BR")} detalhe={`${dados.pessoas.toLocaleString("pt-BR")} ${dados.pessoas === 1 ? "pessoa diferente" : "pessoas diferentes"}`} />
            <Cartao rotulo="Principal origem" valor={principal ? nomeCurto(principal.canal, principal.anuncio) : "Direto"} detalhe={principal ? `${pct(principal.visitas, total)}% das visitas` : "ninguém veio de link ainda"} />
            <Cartao rotulo="Redes sociais" valor={`${pct(redes, total)}%`} detalhe={visitasTxt(redes)} />
            <Cartao rotulo="Google" valor={`${pct(google, total)}%`} detalhe={visitasTxt(google)} />
          </div>

          <ul className="mt-5 space-y-3">
            {linhas.map((l) => (
              <li key={`${l.canal}|${l.anuncio}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 font-semibold text-marca-900">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COR[l.canal] }} aria-hidden />
                    {l.canal === "direto" ? "Direto (digitou o endereço)" : nomeCurto(l.canal, l.anuncio)}
                  </span>
                  <span className="text-slate-600">
                    {visitasTxt(l.visitas)} · <strong className="text-marca-900">{pct(l.visitas, total)}%</strong>
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct(l.visitas, total))}%`, background: COR[l.canal] }} />
                </div>
              </li>
            ))}
          </ul>

          {diasLista.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Visitas por dia</p>
              <div className="flex h-32 items-end gap-[3px]" role="img" aria-label="Visitas por dia, cada cor é uma origem">
                {diasLista.map((d) => {
                  const m = porDia.get(d);
                  const soma = [...(m?.values() ?? [])].reduce((s, n) => s + n, 0);
                  return (
                    <div key={d} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.slice(8, 10)}/${d.slice(5, 7)}: ${visitasTxt(soma)}`}>
                      {soma === 0 ? (
                        <div className="h-[2px] rounded bg-slate-200" />
                      ) : (
                        <div className="flex flex-col-reverse overflow-hidden rounded-t" style={{ height: `${(soma / maxDia) * 100}%` }}>
                          {ordemCanais.map((c) => (m?.get(c) ? <div key={c} style={{ flexGrow: m.get(c), background: COR[c] }} /> : null))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                <span>{diasLista[0].slice(8, 10)}/{diasLista[0].slice(5, 7)}</span>
                <span>hoje</span>
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Detalhe titulo="Páginas por onde entraram" vazio="Nenhuma ainda." itens={dados.entradas.map((e) => ({ nome: e.entrada, n: e.visitas }))} />
            <Detalhe titulo="Campanhas e e-mails" vazio="Nenhum link marcado ainda. Use o gerador de links ao divulgar." itens={campanhas} />
            <Detalhe titulo="Outros sites" vazio="Ninguém veio de outros sites." itens={sites} />
          </div>
        </>
      )}

      <p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
        <strong>Dica:</strong> o WhatsApp e alguns aplicativos não avisam de onde a pessoa veio, então ela aparece como <em>Direto</em>.
        Para saber com certeza, divulgue com os links do gerador (Financeiro &gt; De onde vêm as vendas), por exemplo terminando em
        <code className="mx-1 rounded bg-white px-1">?origem=whatsapp</code>. A equipe do painel não conta nas visitas.
        Origens: {Object.values(CANAIS).slice(0, 6).join(", ")}...
      </p>
    </section>
  );
}

function Cartao({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p className="mt-1 truncate font-display text-xl font-bold text-marca-900">{valor}</p>
      <p className="truncate text-xs text-slate-500">{detalhe}</p>
    </div>
  );
}

function Detalhe({ titulo, itens, vazio }: { titulo: string; itens: { nome: string; n: number }[]; vazio: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</p>
      {!itens.length ? (
        <p className="text-sm text-slate-400">{vazio}</p>
      ) : (
        <Recolhivel total={itens.length} mostrar={10}>
          <ul className="space-y-1 text-sm">
            <Itens>
              {itens.map((x) => (
                <li key={x.nome} className="flex justify-between gap-3">
                  <span className="truncate text-slate-700" title={x.nome}>{x.nome}</span>
                  <span className="shrink-0 font-semibold text-marca-900">{x.n}</span>
                </li>
              ))}
            </Itens>
          </ul>
        </Recolhivel>
      )}
    </div>
  );
}
