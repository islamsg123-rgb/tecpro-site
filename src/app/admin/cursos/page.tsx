import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/admin";
import { getCursos } from "@/lib/cursos";
import { configuracoesDosCursos } from "@/lib/dados";
import { formatarPreco } from "@/lib/formatar";
import { gratuitoEmMassa, salvarCurso } from "../acoes";
import { CapaCurso } from "@/components/CapaCurso";
import { Itens, Recolhivel } from "@/components/ListaRecolhida";

export const metadata: Metadata = { title: "Cursos" };

type Props = { searchParams: Promise<{ salvo?: string; erro?: string; curso?: string; massa?: string }> };

const reais = (c: number | null | undefined) => (c ? (c / 100).toFixed(2).replace(".", ",") : "");

const erros: Record<string, string> = {
  preco: "Preço inválido. Use um valor como 197,00 (mínimo R$ 5,00), ou deixe vazio para usar o preço da Escola Avançada.",
  certificado: "Para certificado pago, informe o valor (mínimo R$ 5,00).",
  gratuito: "Curso gratuito precisa de certificado pago: escolha \"Pago\" e informe o valor do certificado.",
};

export default async function CursosAdmin({ searchParams }: Props) {
  await exigirAdmin("cursos");
  const [cursos, cfg, sp] = await Promise.all([getCursos(), configuracoesDosCursos(), searchParams]);

  return (
    <>
      <h1 className="text-3xl font-extrabold text-marca-900">Preço e vitrine</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-500">
        Nome, descrição e aulas vêm da Escola Avançada. Aqui você ajusta o que é da Tecpro: preço de venda, se o curso aparece no site,
        se fica em destaque e se é gratuito.
      </p>
      <p className="mt-3 max-w-3xl rounded-2xl border border-laranja-500/40 bg-laranja-300/20 p-4 text-sm text-marca-900">
        <strong>Curso gratuito:</strong> a matrícula é feita sem pagamento e, ao concluir, o aluno escolhe como emitir o certificado:
        individual, pacote de 3 ou pacote de 5 (preços em <a href="/admin/configuracoes#certificados" className="font-semibold underline">Configurações da loja</a>).
        <br /><strong>Curso pago:</strong> o certificado é grátis ao concluir.
      </p>
      <form action={gratuitoEmMassa} className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="min-w-[220px] flex-1">
          <p className="text-sm font-semibold text-marca-900">Todos os cursos de uma vez</p>
          <p className="text-xs text-slate-500">
            Hoje: {cursos.filter((c) => c.gratuito).length} gratuito(s) de {cursos.length}. Preço, vitrine e destaque de cada curso continuam guardados.
          </p>
        </div>
        <button name="acao" value="gratis" className="rounded-full bg-green-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-800">
          Deixar todos gratuitos
        </button>
        <button name="acao" value="pagos" className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 hover:border-marca-900">
          Voltar todos a pagos
        </button>
        {sp.massa && <p className="w-full text-sm font-medium text-green-700">Pronto, todos os cursos foram atualizados.</p>}
      </form>

      <Recolhivel total={cursos.length} mostrar={15} abertoInicial={Boolean(sp.curso)} className="mt-8"><div className="space-y-4"><Itens>
        {cursos.map((c) => {
          const ajuste = cfg.get(c.id);
          const desteCurso = sp.curso === c.id;
          return (
            <form
              key={c.id}
              id={`curso-${c.id}`}
              action={salvarCurso}
              className={`scroll-mt-24 overflow-hidden rounded-2xl border bg-white ${desteCurso && sp.salvo ? "border-green-400 ring-4 ring-green-100" : "border-slate-200"}`}
            >
              <input type="hidden" name="cursoId" value={c.id} />
              <div className="grid gap-6 p-5 lg:grid-cols-[180px_1fr_1fr_1fr_auto] lg:items-start">
                <div className="flex gap-4 lg:block">
                  <div className="w-28 shrink-0 overflow-hidden rounded-xl lg:w-full"><CapaCurso curso={c} comTitulo={false} /></div>
                  <div className="lg:mt-3">
                    <p className="font-bold leading-snug text-marca-900">{c.nome}</p>
                    <p className="text-xs text-slate-500">{c.categoria} · {c.cargaHoraria}h · código {c.id}</p>
                    <a href={`/admin/cursos/alunos/${encodeURIComponent(c.id)}`} className="mt-1 inline-block text-xs font-semibold text-marca-700 underline hover:text-laranja-600">Ver alunos deste curso →</a>
                  </div>
                </div>

                <label className="block">
                  <span className="block text-sm font-semibold text-marca-900">Preço de venda (R$)</span>
                  <input
                    name="preco"
                    inputMode="decimal"
                    defaultValue={reais(ajuste?.precoCentavos)}
                    placeholder={reais(c.precoEscolaCentavos)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-marca-500 focus:ring-4 focus:ring-marca-100"
                  />
                  <span className="mt-1 block text-xs text-slate-500">
                    {c.gratuito ? "Não é usado enquanto o curso for gratuito." : `Vazio = preço da Escola Avançada (${formatarPreco(c.precoEscolaCentavos)})`}
                  </span>
                </label>

                <fieldset className="space-y-3">
                  <legend className="text-sm font-semibold text-marca-900">Vitrine</legend>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" name="visivel" defaultChecked={c.visivel} className="h-4 w-4 accent-[#011749]" /> Mostrar no site
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" name="destaque" defaultChecked={c.destaque} className="h-4 w-4 accent-[#ffa500]" /> Destaque (aparece primeiro)
                  </label>
                  <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input type="checkbox" name="gratuito" defaultChecked={c.gratuito} className="mt-0.5 h-4 w-4 accent-[#16a34a]" />
                    <span><strong className="text-green-700">Curso gratuito</strong><br /><span className="text-xs text-slate-500">cobra só o certificado no final</span></span>
                  </label>
                </fieldset>

                <div>
                  <p className="text-sm font-semibold text-marca-900">Certificado</p>
                  <p className="mt-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                    {c.gratuito ? "Pago ao concluir (individual ou pacotes)" : "Grátis ao concluir"}
                  </p>
                </div>

                <div className="lg:pt-6">
                  <button className="w-full rounded-full bg-marca-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-marca-800">Salvar</button>
                </div>
              </div>
              {desteCurso && sp.salvo && <p className="border-t border-green-100 bg-green-50 px-5 py-2.5 text-sm font-medium text-green-800">Salvo. O site já foi atualizado.</p>}
              {desteCurso && sp.erro && sp.erro !== "massa" && <p className="border-t border-red-100 bg-red-50 px-5 py-2.5 text-sm font-medium text-red-700">{erros[sp.erro] ?? "Não foi possível salvar."}</p>}
            </form>
          );
        })}
      </Itens></div></Recolhivel>
    </>
  );
}
