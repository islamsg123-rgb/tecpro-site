import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/admin";
import { obterConfigLoja } from "@/lib/dados";
import { Titulo } from "@/components/admin/Blocos";
import { OnlineAgora } from "@/components/admin/OnlineAgora";

export const metadata: Metadata = { title: "Online agora" };
export const dynamic = "force-dynamic";

/** Detalhes do "Online agora" (aberto pelo botão "Ver no Analytics" da plaquinha do canto). */
export default async function PaginaOnline() {
  const acesso = await exigirAdmin();
  const loja = await obterConfigLoja();
  const ga = loja.googleAnalyticsId;
  return (
    <>
      <Titulo descricao="Quem está no site neste momento e onde. Para o histórico completo de visitas (dias, cidades, de onde vieram), use o Google Analytics.">
        Online agora
      </Titulo>
      <OnlineAgora />
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
