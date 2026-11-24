import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/lib/admin";
import { obterConfigLoja } from "@/lib/dados";
import { listarPesquisas } from "@/lib/dados/painel";
import { AvisoSql, Caixa, dataCurta, Numero, Titulo, Vazio } from "@/components/admin/Blocos";
import { excluirPesquisa } from "../acoes";

export const metadata: Metadata = { title: "Pesquisa de satisfação" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ curso?: string; nota?: string }> };

const estrelas = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

export default async function Pesquisa({ searchParams }: Props) {
  await exigirAdmin("vendas");
  const [{ lista: todas, tabelaFaltando }, loja, { curso = "", nota = "" }] = await Promise.all([listarPesquisas(), obterConfigLoja(), searchParams]);
  const lista = todas.filter((p) => (!curso || p.cursoNome === curso) && (!nota || p.nota === Number(nota)));
  const media = lista.length ? lista.reduce((s, p) => s + p.nota, 0) / lista.length : 0;
  const comNps = lista.filter((p) => p.recomenda !== null);
  // NPS: % de quem dá 9 ou 10 menos % de quem dá 0 a 6.
  const nps = comNps.length
    ? Math.round(((comNps.filter((p) => p.recomenda! >= 9).length - comNps.filter((p) => p.recomenda! <= 6).length) / comNps.length) * 100)
    : null;
  const cursos = Array.from(new Set(todas.map((p) => p.cursoNome).filter(Boolean))) as string[];
  const porNota = [5, 4, 3, 2, 1].map((n) => ({ n, q: lista.filter((p) => p.nota === n).length }));

  return (
    <>
      <Titulo descricao="Respostas do botão “Avaliar o curso” que aparece nas aulas. Responder é opcional para o aluno.">Pesquisa de satisfação</Titulo>
      {tabelaFaltando && <AvisoSql />}
      {!loja.pesquisaNasAulas && (
        <p className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          O botão está <strong>desligado</strong> nas aulas. Ligue em <Link href="/admin/configuracoes" className="font-semibold text-marca-700 underline">Configurações da loja</Link>.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Numero rotulo="Respostas" valor={String(lista.length)} />
        <Numero rotulo="Nota média" valor={lista.length ? `${media.toFixed(1).replace(".", ",")} de 5` : "—"} detalhe={lista.length ? estrelas(Math.round(media)) : undefined} cor="laranja" />
        <Numero rotulo="Indicaria a um amigo (NPS)" valor={nps === null ? "—" : String(nps)} detalhe="de -100 a 100; acima de 50 é muito bom" cor="verde" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <Caixa titulo="Notas">
          <ul className="space-y-2 text-sm">
            {porNota.map(({ n, q }) => (
              <li key={n}>
                <Link href={`/admin/pesquisa?nota=${n}${curso ? `&curso=${encodeURIComponent(curso)}` : ""}`} className="flex items-center gap-2">
                  <span className="w-20 text-laranja-500">{estrelas(n)}</span>
                  <span className="h-2 flex-1 rounded-full bg-slate-100"><span className="block h-2 rounded-full bg-laranja-500" style={{ width: `${lista.length ? (q / lista.length) * 100 : 0}%` }} /></span>
                  <span className="w-8 text-right text-slate-500">{q}</span>
                </Link>
              </li>
            ))}
          </ul>
          <form className="mt-5">
            <label className="text-xs font-semibold text-slate-500" htmlFor="curso">Curso</label>
            <select id="curso" name="curso" defaultValue={curso} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">Todos</option>
              {cursos.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="mt-2 w-full rounded-full bg-marca-900 px-4 py-2 text-sm font-semibold text-white">Filtrar</button>
            {(curso || nota) && <Link href="/admin/pesquisa" className="mt-2 block text-center text-xs text-slate-500 underline">limpar filtros</Link>}
          </form>
        </Caixa>

        <div>
          {!lista.length ? (
            <Vazio>Nenhuma resposta ainda.</Vazio>
          ) : (
            <ul className="space-y-3">
              {lista.map((p) => (
                <li key={p.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg leading-none text-laranja-500" aria-label={`${p.nota} de 5`}>{estrelas(p.nota)}</p>
                      <p className="mt-2 text-sm font-semibold text-marca-900">
                        <Link href={`/admin/alunos/ficha?email=${encodeURIComponent(p.email)}`} className="hover:underline">{p.nome ?? p.email}</Link>
                        <span className="font-normal text-slate-500"> · {dataCurta(p.criadoEm)}</span>
                      </p>
                      <p className="text-xs text-slate-500">{[p.cursoNome, p.aulaTitulo].filter(Boolean).join(" · ")}{p.recomenda !== null ? ` · indicaria: ${p.recomenda}/10` : ""}</p>
                    </div>
                    <form action={excluirPesquisa}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="text-xs text-slate-400 hover:text-red-600">Excluir</button>
                    </form>
                  </div>
                  {p.comentario && <p className="mt-3 whitespace-pre-line text-sm text-slate-700">“{p.comentario}”</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
