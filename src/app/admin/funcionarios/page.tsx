import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/admin";
import { listarFuncionarios, SECOES, type Secao } from "@/lib/dados/painel";
import { AvisoSql, Caixa, Titulo, Vazio } from "@/components/admin/Blocos";
import { alternarFuncionario, excluirFuncionario, salvarFuncionarioAcao } from "../acoes";
import { Dica } from "@/components/admin/Dica";

export const metadata: Metadata = { title: "Funcionários" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ salvo?: string; erro?: string; editar?: string }> };

const erros: Record<string, string> = {
  email: "Digite um e-mail válido.",
  nome: "Digite o nome da pessoa.",
  dono: "Esse e-mail já é do dono do painel e tem acesso a tudo.",
  banco: "Não foi possível salvar. Confira se o SQL novo foi rodado no Supabase.",
};

export default async function Funcionarios({ searchParams }: Props) {
  const quem = await exigirAdmin("funcionarios");
  const [{ lista, tabelaFaltando }, { salvo, erro, editar }] = await Promise.all([listarFuncionarios(), searchParams]);
  const emEdicao = lista.find((f) => f.email === editar);
  const podeDar = (Object.keys(SECOES) as Secao[]).filter((s) => quem.dono || (quem.permissoes.includes(s) && s !== "funcionarios"));

  return (
    <>
      <Titulo descricao="Cadastre quem trabalha com você. A pessoa entra pelo mesmo endereço do site (botão Entrar), com o e-mail cadastrado aqui, e vê só as partes do painel que você liberar.">
        Funcionários
      </Titulo>
      {tabelaFaltando && <AvisoSql />}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div>
          {!lista.length ? (
            <Vazio>Ninguém cadastrado ainda. Só você tem acesso ao painel.</Vazio>
          ) : (
            <ul className="space-y-3">
              {lista.map((f) => (
                <li key={f.email} className={`rounded-2xl border bg-white p-5 ${f.ativo ? "border-slate-200" : "border-dashed border-slate-300 opacity-70"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-marca-900">{f.nome} {!f.ativo && <Dica texto="Este funcionário não consegue entrar no painel até ser desbloqueado." className="ml-1"><span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">bloqueado</span></Dica>}</p>
                      <p className="text-sm text-slate-500">{f.email}</p>
                      <p className="mt-2 flex flex-wrap gap-1.5">
                        <Dica texto="Todo funcionário vê o Painel rápido (só com os números das partes que ele pode acessar)."><span className="rounded-full bg-marca-50 px-2.5 py-1 text-xs font-semibold text-marca-700">Painel rápido</span></Dica>
                        {f.permissoes.map((p) => <Dica key={p} texto={`Este funcionário pode abrir e mexer na parte ${SECOES[p]} do painel.`}><span className="rounded-full bg-marca-50 px-2.5 py-1 text-xs font-semibold text-marca-700">{SECOES[p]}</span></Dica>)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <a href={`/admin/funcionarios?editar=${encodeURIComponent(f.email)}`} className="rounded-full border border-slate-300 px-3 py-1.5 text-marca-900 hover:border-marca-900">Editar</a>
                      <form action={alternarFuncionario}>
                        <input type="hidden" name="email" value={f.email} />
                        <button className="rounded-full border border-slate-300 px-3 py-1.5 text-marca-900 hover:border-marca-900">{f.ativo ? "Bloquear" : "Desbloquear"}</button>
                      </form>
                      <form action={excluirFuncionario}>
                        <input type="hidden" name="email" value={f.email} />
                        <button className="rounded-full border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50">Excluir</button>
                      </form>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Caixa titulo={emEdicao ? `Editar ${emEdicao.nome}` : "Cadastrar funcionário"}>
          <form action={salvarFuncionarioAcao} className="space-y-4 text-sm">
            <label className="block font-semibold text-marca-900">Nome
              <input name="nome" required defaultValue={emEdicao?.nome} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
            </label>
            <label className="block font-semibold text-marca-900">E-mail de acesso
              <input name="email" type="email" required defaultValue={emEdicao?.email} readOnly={Boolean(emEdicao)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal read-only:bg-slate-50" />
            </label>
            <fieldset>
              <legend className="font-semibold text-marca-900">O que a pessoa pode ver</legend>
              <p className="text-xs text-slate-500">O Painel rápido aparece para todos; os valores em dinheiro só para quem tem Financeiro.</p>
              <div className="mt-2 space-y-2">
                {podeDar.map((s) => (
                  <label key={s} className="flex items-center gap-2">
                    <input type="checkbox" name="permissoes" value={s} defaultChecked={emEdicao ? emEdicao.permissoes.includes(s) : s === "alunos"} className="h-4 w-4 accent-marca-900" />
                    {SECOES[s]}
                  </label>
                ))}
              </div>
            </fieldset>
            {emEdicao && <input type="hidden" name="ativo" value={emEdicao.ativo ? "on" : "off"} />}
            {erro && <p className="text-red-700">{erros[erro] ?? "Não foi possível salvar."}</p>}
            {salvo && <p className="font-semibold text-green-700">Salvo! Avise {salvo} para entrar pelo botão “Entrar” do site.</p>}
            <div className="flex items-center gap-3">
              <button className="rounded-full bg-laranja-500 px-6 py-2.5 font-bold text-marca-900 hover:bg-laranja-400">{emEdicao ? "Salvar" : "Cadastrar"}</button>
              {emEdicao && <a href="/admin/funcionarios" className="text-slate-500 underline">cancelar</a>}
            </div>
          </form>
        </Caixa>
      </div>
    </>
  );
}
