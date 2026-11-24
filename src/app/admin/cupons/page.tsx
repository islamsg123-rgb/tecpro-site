import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/admin";
import { getCursos } from "@/lib/cursos";
import { listarCupons, type Cupom } from "@/lib/dados/carrinhos";
import { formatarPreco } from "@/lib/formatar";
import { alternarCupom, criarCupom, excluirCupom } from "../acoes";

export const metadata: Metadata = { title: "Cupons" };
export const dynamic = "force-dynamic";

const erros: Record<string, string> = {
  codigo: "Código inválido: use de 3 a 30 letras ou números, sem espaço (ex.: VOLTA20).",
  valor: "Desconto inválido: percentual de 1 a 100, ou valor a partir de R$ 5,00.",
  validade: "Data de validade inválida.",
  limite: "Limite de usos inválido.",
  banco: "Não foi possível salvar. Confira se o arquivo carrinhos-e-cupons.sql já foi rodado no Supabase.",
};
const aplica: Record<Cupom["aplicaEm"], string> = { tudo: "Cursos e certificados", cursos: "Só cursos", certificados: "Só certificados" };

type Props = { searchParams: Promise<{ erro?: string; criado?: string }> };

export default async function Cupons({ searchParams }: Props) {
  await exigirAdmin("vendas");
  const [{ lista, tabelaFaltando }, cursos, sp] = await Promise.all([listarCupons(), getCursos(), searchParams]);
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const campo = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm";

  return (
    <>
      <h1 className="text-3xl font-extrabold text-marca-900">Cupons de desconto</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-500">
        O aluno digita o cupom no checkout, na etapa do pagamento. O valor final nunca fica abaixo de R$ 5,00 (mínimo para cobrança).
        O uso é contado quando o Pix, boleto ou cartão é gerado.
      </p>
      {tabelaFaltando && (
        <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong>Falta um passo no Supabase:</strong> rode o arquivo <code>carrinhos-e-cupons.sql</code> no SQL Editor do Supabase.
        </p>
      )}

      <form action={criarCupom} className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
        <h2 className="text-lg font-bold text-marca-900 sm:col-span-2 lg:col-span-4">Novo cupom</h2>
        <label className="block text-sm font-semibold text-marca-900">Código
          <input name="codigo" required placeholder="VOLTA20" className={`${campo} uppercase`} />
        </label>
        <label className="block text-sm font-semibold text-marca-900">Tipo de desconto
          <select name="tipo" className={campo}>
            <option value="percentual">Percentual (%)</option>
            <option value="valor">Valor fixo (R$)</option>
          </select>
        </label>
        <label className="block text-sm font-semibold text-marca-900">Desconto
          <input name="valor" required inputMode="decimal" placeholder="20 (%) ou 30,00 (R$)" className={campo} />
        </label>
        <label className="block text-sm font-semibold text-marca-900">Vale para
          <select name="aplicaEm" className={campo}>
            <option value="tudo">Cursos e certificados</option>
            <option value="cursos">Só cursos</option>
            <option value="certificados">Só certificados</option>
          </select>
        </label>
        <label className="block text-sm font-semibold text-marca-900 lg:col-span-2">Curso
          <select name="cursoId" className={campo}>
            <option value="">Todos os cursos</option>
            {cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold text-marca-900">Válido até (opcional)
          <input type="date" name="validade" className={campo} />
        </label>
        <label className="block text-sm font-semibold text-marca-900">Limite de usos (opcional)
          <input name="limite" inputMode="numeric" placeholder="sem limite" className={campo} />
        </label>
        <div className="sm:col-span-2 lg:col-span-4">
          <button className="rounded-full bg-marca-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-marca-800">Criar cupom</button>
          {sp.criado && <span className="ml-3 text-sm font-medium text-green-700">Cupom {sp.criado} criado.</span>}
          {sp.erro && <span className="ml-3 text-sm font-medium text-red-700">{erros[sp.erro] ?? "Não foi possível salvar."}</span>}
        </div>
      </form>

      {!lista.length ? (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Nenhum cupom criado ainda.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Código</th>
                <th className="px-5 py-3 font-semibold">Desconto</th>
                <th className="px-5 py-3 font-semibold">Vale para</th>
                <th className="px-5 py-3 font-semibold">Validade</th>
                <th className="px-5 py-3 font-semibold">Usos</th>
                <th className="px-5 py-3 font-semibold">Situação</th>
                <th className="px-5 py-3 font-semibold"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lista.map((c) => {
                const vencido = Boolean(c.validade && c.validade < hoje);
                const esgotado = c.limiteUsos !== null && c.usos >= c.limiteUsos;
                const situacao = !c.ativo ? ["Pausado", "bg-slate-100 text-slate-600"] : vencido ? ["Vencido", "bg-red-100 text-red-700"] : esgotado ? ["Esgotado", "bg-red-100 text-red-700"] : ["Ativo", "bg-green-100 text-green-800"];
                return (
                  <tr key={c.codigo}>
                    <td className="px-5 py-3 font-mono font-bold text-marca-900">{c.codigo}</td>
                    <td className="px-5 py-3">{c.tipo === "percentual" ? `${c.valor}%` : formatarPreco(c.valor)}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {aplica[c.aplicaEm]}
                      {c.cursoId && <span className="block text-xs text-slate-500">{cursos.find((x) => x.id === c.cursoId)?.nome ?? `curso ${c.cursoId}`}</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{c.validade ? new Date(`${c.validade}T12:00:00`).toLocaleDateString("pt-BR") : "sem prazo"}</td>
                    <td className="px-5 py-3 text-slate-600">{c.usos}{c.limiteUsos !== null ? ` de ${c.limiteUsos}` : ""}</td>
                    <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${situacao[1]}`}>{situacao[0]}</span></td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <form action={alternarCupom} className="inline">
                        <input type="hidden" name="codigo" value={c.codigo} />
                        <button className="font-semibold text-marca-700 hover:underline">{c.ativo ? "Pausar" : "Ativar"}</button>
                      </form>
                      <form action={excluirCupom} className="ml-4 inline">
                        <input type="hidden" name="codigo" value={c.codigo} />
                        <button className="font-semibold text-red-600 hover:underline">Apagar</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
