import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/lib/admin";
import { obterConfigLoja } from "@/lib/dados";
import { listarDepoimentos } from "@/lib/dados/painel";
import { AvisoSql, Caixa, Titulo, Vazio } from "@/components/admin/Blocos";
import { CampoFoto } from "@/components/admin/CampoFoto";
import { alternarDepoimento, excluirDepoimento, salvarDepoimentoAcao } from "../../acoes";

export const metadata: Metadata = { title: "Depoimentos" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ salvo?: string; erro?: string; editar?: string }> };

const erros: Record<string, string> = {
  campos: "Preencha o nome e o depoimento.",
  foto: "A foto não pôde ser usada. Tente outra imagem.",
  banco: "Não foi possível salvar. Confira se o SQL novo foi rodado no Supabase.",
};

export default async function Depoimentos({ searchParams }: Props) {
  await exigirAdmin("loja");
  const [{ lista, tabelaFaltando }, loja, { salvo, erro, editar }] = await Promise.all([listarDepoimentos(), obterConfigLoja(), searchParams]);
  const d = lista.find((x) => String(x.id) === editar);
  const campo = "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal";

  return (
    <>
      <Titulo descricao="Fotos, nomes e falas de alunos que aparecem na página inicial do site, na seção “O que dizem nossos alunos”.">Depoimentos</Titulo>
      {tabelaFaltando && <AvisoSql />}
      {!loja.mostrarDepoimentos && (
        <p className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Os depoimentos estão <strong>escondidos</strong> no site. Ligue em <Link href="/admin/configuracoes" className="font-semibold text-marca-700 underline">Configurações da loja</Link>.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div>
          {!lista.length ? (
            <Vazio>Nenhum depoimento ainda. Cadastre o primeiro ao lado.</Vazio>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {lista.map((x) => (
                <li key={x.id} className={`flex flex-col rounded-2xl border bg-white p-5 ${x.ativo ? "border-slate-200" : "border-dashed border-slate-300 opacity-60"}`}>
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-marca-100 font-bold text-marca-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {x.foto ? <img src={x.foto} alt="" className="h-full w-full object-cover" /> : x.nome[0]}
                    </span>
                    <span>
                      <span className="block font-bold text-marca-900">{x.nome}</span>
                      <span className="block text-xs text-slate-500">{x.detalhe}</span>
                    </span>
                  </div>
                  <p className="mt-3 flex-1 text-sm text-slate-700">“{x.texto}”</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                    <a href={`/admin/loja/depoimentos?editar=${x.id}`} className="rounded-full border border-slate-300 px-3 py-1.5 text-marca-900">Editar</a>
                    <form action={alternarDepoimento}><input type="hidden" name="id" value={x.id} /><button className="rounded-full border border-slate-300 px-3 py-1.5 text-marca-900">{x.ativo ? "Esconder" : "Mostrar no site"}</button></form>
                    <form action={excluirDepoimento}><input type="hidden" name="id" value={x.id} /><button className="rounded-full border border-red-200 px-3 py-1.5 text-red-700">Excluir</button></form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Caixa titulo={d ? `Editar depoimento de ${d.nome}` : "Novo depoimento"}>
          <form action={salvarDepoimentoAcao} className="space-y-4 text-sm" key={d?.id ?? "novo"}>
            {d && <input type="hidden" name="id" value={d.id} />}
            <CampoFoto atual={d?.foto ?? null} />
            <label className="block font-semibold text-marca-900">Nome
              <input name="nome" required defaultValue={d?.nome} className={campo} />
            </label>
            <label className="block font-semibold text-marca-900">Curso ou cidade <span className="font-normal text-slate-400">(opcional)</span>
              <input name="detalhe" defaultValue={d?.detalhe ?? ""} placeholder="Ex.: Aluna de Auxiliar Administrativo" className={campo} />
            </label>
            <label className="block font-semibold text-marca-900">Depoimento
              <textarea name="texto" required rows={5} maxLength={1200} defaultValue={d?.texto} className={campo} />
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2"><input type="checkbox" name="ativo" defaultChecked={d ? d.ativo : true} className="h-4 w-4 accent-marca-900" /> Mostrar no site</label>
              <label className="flex items-center gap-2">Ordem <input type="number" name="ordem" defaultValue={d?.ordem ?? 0} className="w-20 rounded-xl border border-slate-300 px-2 py-1.5" /></label>
            </div>
            {erro && <p className="text-red-700">{erros[erro] ?? "Não foi possível salvar."}</p>}
            {salvo && <p className="font-semibold text-green-700">Salvo!</p>}
            <div className="flex items-center gap-3">
              <button className="rounded-full bg-laranja-500 px-6 py-2.5 font-bold text-marca-900 hover:bg-laranja-400">{d ? "Salvar" : "Cadastrar"}</button>
              {d && <a href="/admin/loja/depoimentos" className="text-slate-500 underline">cancelar</a>}
            </div>
          </form>
        </Caixa>
      </div>
    </>
  );
}
