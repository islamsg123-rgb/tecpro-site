import Link from "next/link";
import { formatarPreco } from "@/lib/formatar";
import { nomeMes } from "@/lib/painel-resumo";

/** Peças visuais reaproveitadas nas páginas do painel. */

export function Titulo({ children, acao, descricao }: { children: React.ReactNode; acao?: React.ReactNode; descricao?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-marca-900">{children}</h1>
        {acao}
      </div>
      {descricao && <p className="mt-2 max-w-3xl text-sm text-slate-500">{descricao}</p>}
    </div>
  );
}

export function Numero({ rotulo, valor, detalhe, href, cor = "marca" }: { rotulo: string; valor: string; detalhe?: string; href?: string; cor?: "marca" | "verde" | "laranja" | "vermelho" | "cinza" }) {
  const barra = { marca: "bg-marca-700", verde: "bg-emerald-500", laranja: "bg-laranja-500", vermelho: "bg-red-500", cinza: "bg-slate-400" }[cor];
  const conteudo = (
    <>
      <span className={`absolute inset-y-4 left-0 w-1 rounded-r ${barra}`} aria-hidden />
      <p className="text-sm text-slate-500">{rotulo}</p>
      <p className="mt-1.5 font-display text-2xl font-bold text-marca-900 sm:text-3xl">{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
    </>
  );
  const cls = "relative block rounded-2xl border border-slate-200 bg-white p-5 pl-6";
  return href ? <Link href={href} className={`${cls} transition-colors hover:border-marca-700`}>{conteudo}</Link> : <div className={cls}>{conteudo}</div>;
}

export function Caixa({ titulo, acao, children, className = "" }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-marca-900">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

export function LinkVerTudo({ href, children = "Ver tudo" }: { href: string; children?: React.ReactNode }) {
  return <Link href={href} className="text-sm font-semibold text-marca-700 hover:text-laranja-600">{children} →</Link>;
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{children}</p>;
}

/** Aviso quando a tabela nova ainda não foi criada no Supabase. */
export function AvisoSql({ arquivo = "painel-completo.sql" }: { arquivo?: string }) {
  return (
    <p className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <strong>Falta um passo no banco:</strong> rode o arquivo <code>{arquivo}</code> no Supabase (SQL Editor &gt; New query &gt; colar &gt; Run).
      Até lá, esta parte não consegue salvar.
    </p>
  );
}

/** Faturamento dos últimos meses em barras. */
export function GraficoMensal({ meses }: { meses: { mes: string; centavos: number; quantidade: number }[] }) {
  const max = Math.max(1, ...meses.map((m) => m.centavos));
  return (
    <div>
      <div className="flex h-44 items-end gap-1.5 sm:gap-2" role="img" aria-label="Faturamento por mês">
        {meses.map((m, i) => {
          const ultimo = i === meses.length - 1;
          return (
            <div key={m.mes} className="group relative flex h-full flex-1 flex-col justify-end">
              <div
                className={`rounded-t-md ${ultimo ? "bg-laranja-500" : "bg-marca-700/80 group-hover:bg-marca-700"}`}
                style={{ height: `${Math.max(m.centavos ? 3 : 0.5, (m.centavos / max) * 100)}%` }}
              />
              <span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-marca-900 px-2 py-1 text-xs text-white group-hover:block">
                {formatarPreco(m.centavos)} · {m.quantidade} pag.
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-2">
        {meses.map((m) => (
          <span key={m.mes} className="flex-1 text-center text-[10px] text-slate-500 sm:text-xs">{nomeMes(m.mes)}</span>
        ))}
      </div>
    </div>
  );
}

/** Quanto entrou por Pix, cartão e boleto. */
export function PorForma({ porForma }: { porForma: Record<string, { centavos: number; quantidade: number }> }) {
  const linhas = [
    { k: "PIX", rotulo: "Pix", cor: "bg-emerald-500" },
    { k: "CREDIT_CARD", rotulo: "Cartão de crédito", cor: "bg-marca-700" },
    { k: "BOLETO", rotulo: "Boleto", cor: "bg-laranja-500" },
  ];
  const total = Math.max(1, linhas.reduce((s, l) => s + (porForma[l.k]?.centavos ?? 0), 0));
  return (
    <ul className="space-y-4">
      {linhas.map((l) => {
        const v = porForma[l.k] ?? { centavos: 0, quantidade: 0 };
        return (
          <li key={l.k}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold text-marca-900">{l.rotulo}</span>
              <span className="text-slate-500">
                <strong className="text-marca-900">{formatarPreco(v.centavos)}</strong> · {v.quantidade} {v.quantidade === 1 ? "pagamento" : "pagamentos"}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 rounded-full bg-slate-100">
              <div className={`h-2.5 rounded-full ${l.cor}`} style={{ width: `${(v.centavos / total) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const corSituacao = {
  ativo: "bg-green-100 text-green-800",
  inativo: "bg-red-100 text-red-700",
  interessado: "bg-blue-100 text-blue-800",
} as const;

export function EtiquetaAluno({ s }: { s: keyof typeof corSituacao }) {
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${corSituacao[s]}`}>{s}</span>;
}

export const dataCurta = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
