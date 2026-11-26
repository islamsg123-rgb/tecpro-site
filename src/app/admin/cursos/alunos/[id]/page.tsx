import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eAdmin, exigirAdmin } from "@/lib/admin";
import { dataHoraBR } from "@/lib/admin-relatorios";
import { calcularTurmas, type AlunoDaTurma, type SituacaoNaTurma } from "@/lib/turmas";
import { DIAS_PARADO, QUASE } from "@/lib/ranking";
import { CapaCurso } from "@/components/CapaCurso";
import { Numero, Vazio } from "@/components/admin/Blocos";
import { Dica } from "@/components/admin/Dica";
import { Itens, Recolhivel } from "@/components/ListaRecolhida";

export const metadata: Metadata = { title: "Alunos do curso" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ filtro?: string }> };

type Filtro = "todos" | "nunca" | "estudando" | "concluiram" | "sem-certificado" | "parados";
const FILTROS: { id: Filtro; rotulo: string; dica: string; passa: (a: AlunoDaTurma) => boolean }[] = [
  { id: "todos", rotulo: "Todos", dica: "Todos os alunos deste curso.", passa: () => true },
  { id: "nunca", rotulo: "Não começaram", dica: "Se inscreveram e ainda não abriram nenhuma aula.", passa: (a) => a.situacao === "nunca" },
  { id: "estudando", rotulo: "Estudando", dica: "Já começaram e ainda não terminaram.", passa: (a) => a.situacao === "andamento" || a.situacao === "quase" },
  { id: "sem-certificado", rotulo: "Concluíram sem certificado", dica: "Terminaram todas as aulas e ainda não emitiram o certificado.", passa: (a) => a.situacao === "concluido_sem_certificado" },
  { id: "concluiram", rotulo: "Certificado emitido", dica: "Terminaram e já emitiram o certificado.", passa: (a) => a.situacao === "concluido_com_certificado" },
  { id: "parados", rotulo: `Parados (${DIAS_PARADO}+ dias)`, dica: `Começaram, não terminaram e não estudam este curso há ${DIAS_PARADO} dias ou mais.`, passa: (a) => a.parado },
];

const ETIQUETA: Record<SituacaoNaTurma, { texto: string; classe: string; barra: string; dica: string }> = {
  nunca: { texto: "Ainda não começou", classe: "bg-amber-100 text-amber-800", barra: "bg-slate-300", dica: "Se inscreveu, mas ainda não abriu nenhuma aula deste curso." },
  andamento: { texto: "Em andamento", classe: "bg-slate-100 text-slate-600", barra: "bg-marca-700", dica: `Começou o curso e ainda está abaixo de ${QUASE}%.` },
  quase: { texto: "Quase terminando", classe: "bg-orange-100 text-orange-800", barra: "bg-laranja-500", dica: `Já passou de ${QUASE}% das aulas. Falta pouco para terminar.` },
  concluido_sem_certificado: { texto: "Concluiu · sem certificado", classe: "bg-blue-100 text-blue-800", barra: "bg-blue-500", dica: "Terminou todas as aulas e ainda não emitiu o certificado deste curso." },
  concluido_com_certificado: { texto: "Certificado emitido", classe: "bg-green-100 text-green-800", barra: "bg-green-500", dica: "Terminou o curso e já emitiu o certificado." },
};

const fichaDe = (email: string) => `/admin/alunos/ficha?email=${encodeURIComponent(email)}`;

function quando(a: AlunoDaTurma) {
  const d = a.dias;
  const txt = d === 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias`;
  return a.situacao === "nunca" ? `inscreveu-se ${txt}` : `estudou ${txt}`;
}

function LinhaAluno({ a }: { a: AlunoDaTurma }) {
  const e = ETIQUETA[a.situacao];
  return (
    <li className={`rounded-2xl border bg-white p-4 ${a.parado ? "border-red-200" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <Link href={fichaDe(a.email)} className="font-display text-base font-bold text-marca-900 underline decoration-laranja-500 underline-offset-4 hover:text-marca-700">{a.nome}</Link>
          {a.nome !== a.email && <span className="block truncate text-xs text-slate-500">{a.email}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Dica texto={e.dica} className="rounded-full">
            <span className={`cursor-help whitespace-nowrap rounded-full px-2.5 py-1 font-semibold ${e.classe}`}>{e.texto}</span>
          </Dica>
          <Dica texto={a.ultimaAtividade ? `Última atividade neste curso: ${dataHoraBR(a.ultimaAtividade)}.` : "Dias desde a inscrição neste curso."} className="rounded-full">
            <span className={`cursor-help whitespace-nowrap rounded-full px-2.5 py-1 font-semibold ${a.parado ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
              {a.parado ? "Parado · " : ""}{quando(a)}
            </span>
          </Dica>
        </div>
      </div>
      {a.situacao !== "nunca" && (
        <div className="mt-3 flex items-center gap-3">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={a.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${a.pct}% do curso`}>
            <div className={`h-full rounded-full ${e.barra}`} style={{ width: `${Math.max(a.pct, 2)}%` }} />
          </div>
          <Dica texto={`${a.feitas} de ${a.total} aulas concluídas.`} className="rounded">
            <span className="w-24 cursor-help text-right text-sm">
              <span className="font-display text-base font-bold text-marca-900">{a.pct}%</span>
              <span className="ml-1 text-xs text-slate-400">{a.feitas}/{a.total}</span>
            </span>
          </Dica>
        </div>
      )}
    </li>
  );
}

export default async function AlunosDoCurso({ params, searchParams }: Props) {
  await exigirAdmin("cursos");
  const [{ id }, { filtro: f }, veAlunos] = await Promise.all([params, searchParams, eAdmin("alunos")]);
  const turma = (await calcularTurmas()).find((t) => t.curso.id === decodeURIComponent(id));
  if (!turma) notFound();
  const filtro = FILTROS.find((x) => x.id === f) ?? FILTROS[0];
  const lista = turma.alunos.filter(filtro.passa);
  const base = `/admin/cursos/alunos/${encodeURIComponent(turma.curso.id)}`;
  const c = turma.curso;

  return (
    <>
      <Link href="/admin/cursos/alunos" className="text-sm font-semibold text-marca-700 hover:text-laranja-600">← Todos os cursos</Link>
      <div className="mb-6 mt-3 flex flex-wrap items-center gap-4">
        <div className="w-28 shrink-0 overflow-hidden rounded-xl"><CapaCurso curso={c} comTitulo={false} /></div>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-marca-900 sm:text-3xl">{c.nome}</h1>
          <p className="mt-1 text-sm text-slate-500">
            <span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-semibold ${c.gratuito ? "bg-green-100 text-green-800" : "bg-marca-50 text-marca-900"}`}>{c.gratuito ? "Gratuito" : "Pago"}</span>
            {c.categoria} · {c.cargaHoraria}h · código {c.id} · <Link href={`/admin/cursos#curso-${c.id}`} className="underline">preço e vitrine</Link>
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Numero rotulo="Alunos" valor={String(turma.total)} dica="Todos os alunos deste curso: quem se inscreveu e quem já abriu alguma aula." />
        <Numero rotulo="Não começaram" valor={String(turma.nunca)} cor="laranja" href={turma.nunca ? `${base}?filtro=nunca` : undefined} dica="Se inscreveram e ainda não abriram nenhuma aula." />
        <Numero rotulo="Estudando" valor={String(turma.andamento)} cor="cinza" href={turma.andamento ? `${base}?filtro=estudando` : undefined} dica="Já começaram e ainda não terminaram." />
        <Numero rotulo="Concluíram" valor={String(turma.concluiram)} detalhe={`${turma.certificados} com certificado`} cor="verde" dica="Terminaram todas as aulas deste curso." />
        <Numero rotulo={`Parados ${DIAS_PARADO}+ dias`} valor={String(turma.parados)} cor="vermelho" href={turma.parados ? `${base}?filtro=parados` : undefined} dica={`Começaram, não terminaram e não estudam este curso há ${DIAS_PARADO} dias ou mais.`} />
      </div>

      {!veAlunos ? (
        <Vazio>Você não tem permissão para ver a lista de alunos. Peça ao dono para liberar a seção Alunos.</Vazio>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            {FILTROS.map((x) => {
              const n = turma.alunos.filter(x.passa).length;
              const ativo = filtro.id === x.id;
              return (
                <Dica key={x.id} texto={x.dica} className="rounded-full" temLink>
                  <Link
                    href={x.id === "todos" ? base : `${base}?filtro=${x.id}`}
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
            <Vazio>{filtro.id === "todos" ? "Este curso ainda não tem alunos." : `Nenhum aluno em "${filtro.rotulo}" neste curso.`}</Vazio>
          ) : (
            <Recolhivel total={lista.length}>
              <ul className="space-y-3"><Itens>{lista.map((a) => <LinhaAluno key={a.email} a={a} />)}</Itens></ul>
            </Recolhivel>
          )}
        </>
      )}
    </>
  );
}
