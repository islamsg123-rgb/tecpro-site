import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/admin";
import { obterConfigLoja } from "@/lib/dados";
import { Titulo } from "@/components/admin/Blocos";
import { OnlineAgora } from "@/components/admin/OnlineAgora";
import { OrigensPublico, PERIODOS_ORIGEM, type PeriodoOrigem } from "@/components/admin/OrigensPublico";
import { resumoOrigens } from "@/lib/dados/online";
import { emailsDaEquipe } from "@/lib/equipe";
import { diaBR } from "@/lib/dias";
import { getCursos } from "@/lib/cursos";

export const metadata: Metadata = { title: "Online agora" };
export const dynamic = "force-dynamic";

/** Detalhes do "Online agora" (aberto pelo botão "Ver no Analytics" da plaquinha do canto). */
type Props = { searchParams: Promise<{ periodo?: string }> };

export default async function PaginaOnline({ searchParams }: Props) {
  const acesso = await exigirAdmin();
  const pedido = (await searchParams).periodo;
  const periodo: PeriodoOrigem = pedido && pedido in PERIODOS_ORIGEM ? (pedido as PeriodoOrigem) : "sete";
  const desde = diaBR(Date.now() - (periodo === "hoje" ? 0 : periodo === "sete" ? 6 : 29) * 86400_000);
  const [loja, equipe] = await Promise.all([obterConfigLoja(), emailsDaEquipe()]);
  const [origens, cursos] = await Promise.all([resumoOrigens(desde, [...equipe]), getCursos().catch(() => [])]);
  // Nome amigável da página de chegada ("/cursos/excel" vira "Curso: Excel").
  const nomeCurso = new Map(cursos.map((c) => [c.slug, c.nome]));
  const nomePagina = (e: string) => {
    const m = e.match(/^\/(cursos|checkout)\/([^/]+)$/);
    if (m && nomeCurso.has(m[2])) return `${m[1] === "cursos" ? "Curso" : "Inscrição"}: ${nomeCurso.get(m[2])}`;
    if (e === "/") return "Página inicial";
    if (e === "/cursos") return "Catálogo de cursos";
    if (e.startsWith("/minha-conta")) return "Área do aluno";
    if (e === "/entrar") return "Entrar";
    return e;
  };
  const somaEntradas = new Map<string, number>();
  for (const x of origens.entradas) somaEntradas.set(nomePagina(x.entrada), (somaEntradas.get(nomePagina(x.entrada)) ?? 0) + x.visitas);
  origens.entradas = [...somaEntradas].map(([entrada, visitas]) => ({ entrada, visitas })).sort((a, b) => b.visitas - a.visitas);
  const ga = loja.googleAnalyticsId;
  return (
    <>
      <Titulo descricao="Quem está no site neste momento, onde está e de onde veio. Para cidades e aparelhos, use o Google Analytics.">
        Online agora
      </Titulo>
      <OnlineAgora />
      <OrigensPublico dados={origens} periodo={periodo} />
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
        <h2 className="text-base font-bold text-marca-900">Google Analytics</h2>
        {ga ? (
          <p className="mt-2 text-slate-600">
            Ligado no site com o código <strong>{ga}</strong>.{" "}
            <a href="https://analytics.google.com/analytics/web/#/realtime" target="_blank" rel="noreferrer" className="font-semibold text-marca-700 underline hover:text-laranja-600">
              Abrir o Google Analytics
            </a>{" "}
            (os números começam a aparecer lá algumas horas depois de ligar).
          </p>
        ) : (
          <p className="mt-2 text-slate-600">
            Ainda não está ligado.{" "}
            {acesso.permissoes.includes("loja") ? (
              <>Cole o código G- em <a href="/admin/configuracoes#site" className="font-semibold text-marca-700 underline">Configurações da loja</a>.</>
            ) : (
              <>Peça ao responsável para colar o código G- em Configurações da loja.</>
            )}
          </p>
        )}
      </section>
    </>
  );
}
