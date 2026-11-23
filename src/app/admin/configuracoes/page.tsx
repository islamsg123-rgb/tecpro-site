import type { Metadata } from "next";
import { obterConfigLoja } from "@/lib/dados";
import { salvarConfiguracoes } from "../acoes";

export const metadata: Metadata = { title: "Configurações" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ salvo?: string; erro?: string }> };

export default async function Configuracoes({ searchParams }: Props) {
  const [{ salvo, erro }, loja] = await Promise.all([searchParams, obterConfigLoja()]);
  const vitalicio = loja.mesesDeAcesso === null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold text-marca-900">Configurações</h1>
      <p className="mt-2 text-slate-600">Regras que valem para todas as novas matrículas.</p>

      <form action={salvarConfiguracoes} className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-lg font-bold text-marca-900">Prazo de acesso do aluno</h2>
        <p className="mt-1 text-sm text-slate-500">
          Por quanto tempo o aluno pode assistir ao curso depois da compra. Vale para quem se matricular a partir de agora;
          quem já é aluno mantém o prazo que tinha.
        </p>

        <div className="mt-5 space-y-3">
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 p-4 has-[:checked]:border-marca-900 has-[:checked]:bg-marca-50">
            <input type="radio" name="prazo" value="vitalicio" defaultChecked={vitalicio} className="h-4 w-4 accent-marca-900" />
            <span className="font-semibold text-marca-900">Vitalício</span>
            <span className="text-sm text-slate-500">(sem data para acabar)</span>
          </label>
          <label className="flex cursor-pointer flex-wrap items-center gap-3 rounded-2xl border border-slate-200 p-4 has-[:checked]:border-marca-900 has-[:checked]:bg-marca-50">
            <input type="radio" name="prazo" value="meses" defaultChecked={!vitalicio} className="h-4 w-4 accent-marca-900" />
            <span className="font-semibold text-marca-900">Por</span>
            <input
              type="number"
              name="meses"
              min={1}
              max={120}
              defaultValue={loja.mesesDeAcesso ?? 12}
              className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-marca-900"
            />
            <span className="font-semibold text-marca-900">meses</span>
          </label>
        </div>

        {erro === "meses" && <p className="mt-3 text-sm text-red-700">Informe um número de meses entre 1 e 120.</p>}
        {salvo && <p className="mt-3 text-sm font-semibold text-green-700">Salvo!</p>}

        <button className="mt-6 rounded-full bg-laranja-500 px-7 py-3 font-bold text-marca-900 hover:bg-laranja-400">Salvar</button>
      </form>
    </div>
  );
}
