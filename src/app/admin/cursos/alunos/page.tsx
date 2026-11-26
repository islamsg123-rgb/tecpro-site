import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/lib/admin";
import { calcularTurmas, type Turma } from "@/lib/turmas";
import { DIAS_PARADO } from "@/lib/ranking";
import { CapaCurso } from "@/components/CapaCurso";
import { Numero, Titulo, Vazio } from "@/components/admin/Blocos";
import { Dica } from "@/components/admin/Dica";
import { Itens, Recolhivel } from "@/components/ListaRecolhida";

export const metadata: Metadata = { title: "Alunos por curso" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ tipo?: string; busca?: string; vazios?: string }> };

const TIPOS = [
  { id: "", rotulo: "Todos" },
  { id: "gratuitos", rotulo: "Gratuitos" },
  { id: "pagos", rotulo: "Pagos" },
];

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function montarLink(p: { tipo?: string; busca?: string; vazios?: string }) {
  const q = new URLSearchParams();
  if (p.tipo) q.set("tipo", p.tipo);
  if (p.busca) q.set("busca", p.busca);
  if (p.vazios) q.set("vazios", p.vazios);
  const s = q.toString();
  return `/admin/cursos/alunos${s ? `?${s}` : ""}`;
}

function Mini({ n, rotulo, cor, dica }: { n: number; rotulo: string; cor: string; dica: string }) {
  return (
    <Dica texto={dica} className="rounded-xl">
      <span className={`flex min-w-[76px] cursor-help flex-col items-center rounded-xl px-2 py-1.5 ${n ? cor : "bg-slate-50 text-slate-300"}`}>
        <span className="font-display text-lg font-bold leading-none">{n}</span>
        <span className="mt-1 text-[11px] font-semibold leading-tight">{rotulo}</span>
      </span>
    </Dica>
  );
}

function LinhaTurma({ t }: { t: Turma }) {
  const href = `/admin/cursos/alunos/${encodeURIComponent(t.curso.id)}`;
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-marca-700">
      <div className="flex flex-wrap items-center gap-4">
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-4" style={{ minWidth: "min(100%, 260px)" }}>
          <div className="w-20 shrink-0 overflow-hidden rounded-lg"><CapaCurso curso={t.curso} comTitulo={false} /></div>
          <div className="min-w-0">
            <p className="font-bold leading-snug text-marca-900 underline decoration-laranja-500 underline-offset-4">{t.curso.nome}</p>
            <p className="mt-1 text-xs text-slate-500">
              <span className={`mr-2 rounded-full px-2 py-0.5 font-semibold ${t.curso.gratuito ? "bg-green-100 text-green-800" : "bg-marca-50 text-marca-900"}`}>{t.curso.gratuito ? "Gratuito" : "Pago"}</span>
              {t.curso.categoria} · código {t.curso.id}
            </p>
          </div>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Dica texto="Total de alunos neste curso: quem se inscreveu e quem já abriu alguma aula." className="rounded-xl">
            <Link href={href} className="flex min-w-[84px] flex-col items-center rounded-xl bg-marca-900 px-3 py-1.5 text-white">
              <span className="font-display text-2xl font-bold leading-none">{t.total}</span>
              <span className="mt-1 text-[11px] font-semibold">{t.total === 1 ? "aluno" : "alunos"}</span>
            </Link>
          </Dica>
          <Mini n={t.nunca} rotulo="não começou" cor="bg-amber-50 text-amber-800" dica="Se inscreveram e ainda não abriram nenhuma aula." />
          <Mini n={t.andamento} rotulo="estudando" cor="bg-slate-100 text-slate-700" dica="Já começaram e ainda não terminaram todas as aulas." />
          <Mini n={t.concluiram} rotulo="concluíram" cor="bg-blue-50 text-blue-800" dica="Terminaram todas as aulas do curso (com ou sem certificado)." />
          <Mini n={t.certificados} rotulo="certificado" cor="bg-green-50 text-green-800" dica="Terminaram e já emitiram o certificado deste curso." />
          <Mini n={t.parados} rotulo={`parados ${DIAS_PARADO}+ dias`} cor="bg-red-50 text-red-700" dica={`Começaram, não terminaram e não estudam este curso há ${DIAS_PARADO} dias ou mais.`} />
        </div>
      </div>
    </li>
  );
}

export default async function AlunosPorCurso({ searchParams }: Props) {
  await exigirAdmin("cursos");
  const sp = await searchParams;
  const tipo = TIPOS.some((t) => t.id === sp.tipo) ? sp.tipo ?? "" : "";
  const busca = (sp.busca ?? "").trim();
  const mostrarVazios = sp.vazios === "1";
  const turmas = await calcularTurmas();

  const doTipo = turmas.filter((t) => (tipo === "gratuitos" ? t.curso.gratuito : tipo === "pagos" ? !t.curso.gratuito : true));
  const termo = semAcento(busca);
  const achados = termo ? doTipo.filter((t) => semAcento(`${t.curso.nome} ${t.curso.id} ${t.curso.categoria}`).includes(termo)) : doTipo;
  const comAlunos = achados.filter((t) => t.total > 0);
  const vazios = achados.filter((t) => t.total === 0);
  const lista = mostrarVazios ? achados : comAlunos;

  const matriculas = turmas.reduce((s, t) => s + t.total, 0);
  const alunosUnicos = new Set(turmas.flatMap((t) => t.alunos.map((a) => a.email))).size;
  const cursosComAlunos = turmas.filter((t) => t.total > 0).length;
  const maior = turmas[0];

  return (
    <>
      <Titulo
        descricao={<>Cada curso funciona como uma turma: aqui você vê quantos alunos tem em cada um e em que pé estão. Os cursos com mais alunos aparecem primeiro. Clique no curso para ver a lista de alunos dele.</>}
      >
        Alunos por curso
      </Titulo>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Numero rotulo="Matrículas" valor={String(matriculas)} detalhe="somando todos os cursos" dica="Soma dos alunos de todos os cursos. Um aluno em 3 cursos conta 3 vezes aqui." />
        <Numero rotulo="Alunos diferentes" valor={String(alunosUnicos)} cor="verde" dica="Pessoas diferentes com pelo menos um curso. Cada pessoa conta uma vez só." />
        <Numero rotulo="Cursos com alunos" valor={`${cursosComAlunos} de ${turmas.length}`} cor="laranja" dica="Quantos cursos do catálogo já têm pelo menos um aluno." />
        <Numero
          rotulo="Curso com mais alunos"
          valor={maior && maior.total ? String(maior.total) : "0"}
          detalhe={maior && maior.total ? maior.curso.nome : "nenhum ainda"}
          cor="cinza"
          href={maior && maior.total ? `/admin/cursos/alunos/${encodeURIComponent(maior.curso.id)}` : undefined}
          dica="O curso que tem mais alunos hoje."
        />
      </div>

      <form className="mb-5 flex flex-wrap items-center gap-2" action="/admin/cursos/alunos">
        {TIPOS.map((t) => (
          <Link
            key={t.id}
            href={montarLink({ tipo: t.id, busca, vazios: mostrarVazios ? "1" : "" })}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tipo === t.id ? "bg-marca-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-marca-900"}`}
          >
            {t.rotulo}
          </Link>
        ))}
        {tipo && <input type="hidden" name="tipo" value={tipo} />}
        {mostrarVazios && <input type="hidden" name="vazios" value="1" />}
        <input
          name="busca"
          defaultValue={busca}
          placeholder="Procurar curso pelo nome"
          className="min-w-[200px] flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm outline-none focus:border-marca-500 focus:ring-4 focus:ring-marca-100 sm:max-w-xs"
        />
        <button className="rounded-full bg-marca-900 px-4 py-2 text-sm font-bold text-white hover:bg-marca-800">Procurar</button>
        {busca && <Link href={montarLink({ tipo, vazios: mostrarVazios ? "1" : "" })} className="text-sm font-semibold text-slate-500 underline">limpar</Link>}
      </form>

      {!lista.length ? (
        <Vazio>{busca ? `Nenhum curso com alunos encontrado para "${busca}".` : "Nenhum curso tem alunos ainda."}</Vazio>
      ) : (
        <Recolhivel total={lista.length}>
          <ul className="space-y-3"><Itens>{lista.map((t) => <LinhaTurma key={t.curso.id} t={t} />)}</Itens></ul>
        </Recolhivel>
      )}

      {vazios.length > 0 && (
        <p className="mt-5 text-center text-sm text-slate-500">
          {mostrarVazios ? (
            <Link href={montarLink({ tipo, busca })} className="font-semibold text-marca-700 underline">Esconder os {vazios.length} cursos sem alunos</Link>
          ) : (
            <>{vazios.length} {vazios.length === 1 ? "curso ainda não tem" : "cursos ainda não têm"} alunos. <Link href={montarLink({ tipo, busca, vazios: "1" })} className="font-semibold text-marca-700 underline">Mostrar também</Link></>
          )}
        </p>
      )}

      <p className="mt-8 max-w-3xl text-xs text-slate-400">
        Entra na conta quem se inscreveu no curso pelo site (grátis ou pago) ou já abriu alguma aula dele. Quem foi cadastrado só pelo painel aparece quando abrir a primeira aula.
        Curso tirado do aluno na ficha não conta.
      </p>
    </>
  );
}
