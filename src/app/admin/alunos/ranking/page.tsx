import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/lib/admin";
import { dataHoraBR } from "@/lib/admin-relatorios";
import { calcularProgresso, filtrar, FILTROS, QUASE, type CursoDoAluno, type Filtro, type ProgressoAluno, type SituacaoCurso } from "@/lib/ranking";
import { Titulo, Vazio } from "@/components/admin/Blocos";
import { Dica } from "@/components/admin/Dica";

export const metadata: Metadata = { title: "Progresso dos alunos" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ filtro?: string }> };

const fichaDe = (email: string) => `/admin/alunos/ficha?email=${encodeURIComponent(email)}`;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function quandoEstudou(a: ProgressoAluno) {
  const d = a.diasSemEstudar;
  if (!a.ultimaAtividade) return "—";
  if (d === 0) return "hoje";
  if (d === 1) return "ontem";
  return `há ${d} dias`;
}

const ETIQUETA: Record<SituacaoCurso, { texto: string; classe: string; barra: string; dica: string }> = {
  quase: { texto: "Quase terminando", classe: "bg-amber-100 text-amber-800", barra: "bg-laranja-500", dica: `Já passou de ${QUASE}% das aulas. Falta pouco para terminar.` },
  concluido_sem_certificado: { texto: "Concluiu · sem certificado", classe: "bg-blue-100 text-blue-800", barra: "bg-blue-500", dica: "Terminou todas as aulas e ainda não emitiu o certificado deste curso." },
  concluido_com_certificado: { texto: "Certificado emitido", classe: "bg-green-100 text-green-800", barra: "bg-green-500", dica: "Terminou o curso e já emitiu o certificado." },
  andamento: { texto: "Em andamento", classe: "bg-slate-100 text-slate-600", barra: "bg-marca-700", dica: `Começou o curso e ainda está abaixo de ${QUASE}%.` },
};

function LinhaCurso({ c }: { c: CursoDoAluno }) {
  const e = ETIQUETA[c.situacao];
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700" title={c.nome}>{c.nome}</span>
        <Dica texto={e.dica} className="rounded-full">
          <span className={`cursor-help whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${e.classe}`}>{e.texto}</span>
        </Dica>
      </div>
      <div className="mt-1.5 flex items-center gap-3">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={c.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.nome}: ${c.pct}%`}>
          <div className={`h-full rounded-full ${e.barra}`} style={{ width: `${Math.max(c.pct, 2)}%` }} />
        </div>
        <Dica texto={`${c.feitas} de ${c.total} aulas concluídas. Última atividade neste curso: ${dataHoraBR(c.ultimaAtividade)}.`} className="rounded">
          <span className="w-24 cursor-help text-right text-sm">
            <span className="font-display text-base font-bold text-marca-900">{c.pct}%</span>
            <span className="ml-1 text-xs text-slate-400">{c.feitas}/{c.total}</span>
          </span>
        </Dica>
      </div>
    </li>
  );
}

function CartaoAluno({ a, posicao }: { a: ProgressoAluno; posicao: number }) {
  return (
    <li className={`rounded-2xl border bg-white p-4 sm:p-5 ${a.parado ? "border-red-200" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600" aria-label={`Posição ${posicao}`}>{posicao}</span>
          <div className="min-w-0">
            <Link href={fichaDe(a.email)} className="font-display text-lg font-bold text-marca-900 underline decoration-laranja-500 underline-offset-4 hover:text-marca-700">{a.nome}</Link>
            {a.nome !== a.email && <span className="block truncate text-xs text-slate-500">{a.email}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Dica texto="Quantos cursos este aluno já começou (abriu pelo menos uma aula)." className="rounded-full">
            <span className="cursor-help rounded-full bg-marca-50 px-3 py-1 font-semibold text-marca-900">{plural(a.cursos.length, "curso", "cursos")}</span>
          </Dica>
          <Dica texto={a.ultimaAtividade ? `Última vez que fez alguma coisa numa aula: ${dataHoraBR(a.ultimaAtividade)}.` : "Ainda não estudou."} className="rounded-full">
            <span className={`cursor-help rounded-full px-3 py-1 font-semibold ${a.parado ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
              {a.parado ? "Parado · " : ""}estudou {quandoEstudou(a)}
            </span>
          </Dica>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-slate-100 sm:pl-11">
        {a.cursos.map((c) => <LinhaCurso key={c.cursoId} c={c} />)}
      </ul>
    </li>
  );
}

export default async function Progresso({ searchParams }: Props) {
  await exigirAdmin("alunos");
  const { filtro: f } = await searchParams;
  const filtro: Filtro = FILTROS.some((x) => x.id === f) ? (f as Filtro) : "todos";
  const todos = await calcularProgresso();
  const lista = filtrar(todos, filtro);
  const atual = FILTROS.find((x) => x.id === filtro)!;

  return (
    <>
      <Titulo
        descricao={<>Quem está mais perto de terminar aparece em cima. Cada barra é um curso: a porcentagem é quantas aulas o aluno já concluiu do total do curso. Use os filtros para achar quem está quase terminando, quem já terminou e ainda não tem certificado, e quem parou. Clique no nome para abrir a ficha.</>}
      >
        Progresso dos alunos
      </Titulo>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTROS.map((x) => {
          const n = filtrar(todos, x.id).length;
          const ativo = filtro === x.id;
          return (
            <Dica key={x.id} texto={x.dica} className="rounded-full" temLink>
              <Link
                href={x.id === "todos" ? "/admin/alunos/ranking" : `/admin/alunos/ranking?filtro=${x.id}`}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${ativo ? "bg-marca-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-marca-900"}`}
              >
                {x.rotulo}
                <span className={`rounded-full px-2 py-0.5 text-xs ${ativo ? "bg-white/20" : "bg-slate-100 text-slate-700"}`}>{n}</span>
              </Link>
            </Dica>
          );
        })}
      </div>

      {!lista.length ? (
        <Vazio>{filtro === "todos" ? "Nenhum aluno abriu uma aula ainda." : `Nenhum aluno em "${atual.rotulo}" agora.`}</Vazio>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">
            {plural(lista.length, "aluno", "alunos")}{filtro === "todos" ? "" : ` em "${atual.rotulo}"`}, do mais adiantado para o menos adiantado.
          </p>
          <ol className="space-y-3">
            {lista.map((a, i) => <CartaoAluno key={a.email} a={a} posicao={i + 1} />)}
          </ol>
        </>
      )}
    </>
  );
}
