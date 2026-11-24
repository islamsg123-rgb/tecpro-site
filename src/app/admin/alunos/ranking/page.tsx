import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/lib/admin";
import { diasDesde } from "@/lib/admin-relatorios";
import { calcularRanking, PERIODOS, PONTOS, type Periodo, type PosicaoRanking } from "@/lib/ranking";
import { Titulo, Vazio } from "@/components/admin/Blocos";
import { Dica } from "@/components/admin/Dica";

export const metadata: Metadata = { title: "Ranking dos alunos" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ periodo?: string }> };

const fichaDe = (email: string) => `/admin/alunos/ficha?email=${encodeURIComponent(email)}`;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function quandoEstudou(iso: string) {
  const d = diasDesde(iso);
  if (d === null) return "—";
  if (d === 0) return "hoje";
  if (d === 1) return "ontem";
  return `há ${d} dias`;
}

/** Conta que mostra de onde saiu a pontuação. */
function Conta({ a }: { a: PosicaoRanking }) {
  const linhas: [string, number, number][] = [
    ["aulas concluídas", a.aulas, PONTOS.aula],
    ["provas aprovadas", a.provas, PONTOS.prova],
    ["cursos concluídos", a.cursos, PONTOS.curso],
    ["dias de estudo", a.dias, PONTOS.dia],
  ];
  return (
    <span className="block min-w-52">
      <span className="mb-1 block font-semibold">Como chegou a {a.pontos} pontos:</span>
      {linhas.map(([rotulo, n, p]) => (
        <span key={rotulo} className="flex justify-between gap-4">
          <span>{n} {rotulo} × {p}</span>
          <span className="font-semibold">{n * p}</span>
        </span>
      ))}
      <span className="mt-1 flex justify-between gap-4 border-t border-white/20 pt-1 font-semibold">
        <span>Total</span>
        <span>{a.pontos}</span>
      </span>
    </span>
  );
}

const MEDALHA = {
  1: { cor: "from-amber-300 to-amber-500 text-amber-950", borda: "border-amber-300", altura: "sm:pt-10", rotulo: "1º lugar" },
  2: { cor: "from-slate-200 to-slate-400 text-slate-800", borda: "border-slate-300", altura: "sm:pt-6", rotulo: "2º lugar" },
  3: { cor: "from-orange-300 to-orange-500 text-orange-950", borda: "border-orange-300", altura: "sm:pt-6", rotulo: "3º lugar" },
} as const;

function Podio({ a }: { a: PosicaoRanking }) {
  const m = MEDALHA[a.posicao as 1 | 2 | 3];
  const primeiro = a.posicao === 1;
  return (
    <div className={`relative flex flex-col items-center rounded-2xl border-2 ${m.borda} bg-white px-5 pb-5 pt-8 text-center ${m.altura} ${primeiro ? "shadow-lg sm:order-2" : a.posicao === 2 ? "sm:order-1" : "sm:order-3"}`}>
      <Dica texto={`${m.rotulo} no ranking deste período.`} className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-full">
        <span className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${m.cor} font-display text-xl font-extrabold shadow ring-4 ring-white`} aria-label={m.rotulo}>
          {a.posicao}º
        </span>
      </Dica>
      {primeiro && (
        <svg viewBox="0 0 24 24" className="mb-1 h-7 w-7 text-amber-500" fill="currentColor" aria-hidden>
          <path d="M5 4h14v3a5 5 0 0 1-4 4.9V14h2v2H7v-2h2v-2.1A5 5 0 0 1 5 7zm-3 1h2v2a2 2 0 0 0 1 1.7v2.1A4 4 0 0 1 2 7zm18 0h2v2a4 4 0 0 1-3 3.8V8.7A2 2 0 0 0 20 7zM6 18h12v2H6z" />
        </svg>
      )}
      <Link href={fichaDe(a.email)} className="line-clamp-2 font-display text-lg font-bold text-marca-900 underline decoration-laranja-500 underline-offset-4 hover:text-marca-700">
        {a.nome}
      </Link>
      <Dica texto={<Conta a={a} />} className="mt-2 rounded-lg">
        <span className="flex cursor-help flex-col items-center">
          <span className="font-display text-4xl font-extrabold leading-tight text-marca-900">{a.pontos}</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">pontos</span>
        </span>
      </Dica>
      <p className="mt-3 text-sm text-slate-600">
        {plural(a.aulas, "aula", "aulas")} · {plural(a.dias, "dia de estudo", "dias de estudo")}
        {a.cursos > 0 && <> · {plural(a.cursos, "curso concluído", "cursos concluídos")}</>}
      </p>
      <p className="mt-1 text-xs text-slate-400">estudou {quandoEstudou(a.ultimaAtividade)}</p>
    </div>
  );
}

function Cabecalho({ children, dica, direita = false }: { children: React.ReactNode; dica: string; direita?: boolean }) {
  return (
    <th className={`px-4 py-3 font-semibold ${direita ? "text-right" : ""}`}>
      <Dica texto={dica} className="rounded">
        <span className="cursor-help border-b border-dotted border-slate-400">{children}</span>
      </Dica>
    </th>
  );
}

export default async function Ranking({ searchParams }: Props) {
  await exigirAdmin("alunos");
  const { periodo: p } = await searchParams;
  const periodo: Periodo = p === "7" || p === "geral" ? p : "30";
  const ranking = await calcularRanking(periodo);
  const podio = ranking.slice(0, 3);
  const nomePeriodo = PERIODOS.find((x) => x.id === periodo)!.rotulo.toLowerCase();

  const regras = [
    { rotulo: "Aula concluída", pontos: PONTOS.aula, dica: "Cada aula terminada. O site só conclui a aula quando o aluno assiste pelo menos 80% do vídeo e acerta toda a prova, então não dá para pular." },
    { rotulo: "Prova aprovada", pontos: PONTOS.prova, dica: "Cada prova de aula acertada por completo. Aulas sem prova não dão estes pontos." },
    { rotulo: "Curso concluído", pontos: PONTOS.curso, dica: "Bônus por terminar todas as aulas de um curso. Conta no período em que a última aula foi feita." },
    { rotulo: "Dia de estudo", pontos: PONTOS.dia, dica: "Cada dia diferente em que o aluno estudou alguma coisa. Premia quem estuda sempre, e não só quem faz tudo num dia só." },
  ];

  return (
    <>
      <Titulo
        descricao={<>Os alunos mais dedicados, do que mais estudou para o que menos estudou. A pontuação junta aulas concluídas, provas aprovadas, cursos terminados e quantos dias diferentes a pessoa estudou. Deixe o mouse em cima dos pontos para ver a conta. Clique no nome para abrir a ficha.</>}
      >
        Ranking dos alunos
      </Titulo>

      <div className="mb-6 flex flex-wrap gap-2">
        {PERIODOS.map((f) => (
          <Link
            key={f.id}
            href={f.id === "30" ? "/admin/alunos/ranking" : `/admin/alunos/ranking?periodo=${f.id}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${periodo === f.id ? "bg-marca-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-marca-900"}`}
          >
            {f.rotulo}
          </Link>
        ))}
      </div>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-bold text-marca-900">Como a pontuação funciona</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {regras.map((r) => (
            <Dica key={r.rotulo} texto={r.dica} bloco>
              <div className="h-full rounded-xl bg-marca-50 px-4 py-3">
                <p className="font-display text-2xl font-extrabold text-marca-900">+{r.pontos}</p>
                <p className="text-sm text-slate-600">{r.rotulo}</p>
              </div>
            </Dica>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          O tempo com a página aberta não entra na conta: o site não mede isso de forma confiável (a pessoa pode deixar a aba aberta e sair).
        </p>
      </section>

      {!ranking.length ? (
        <Vazio>{periodo === "geral" ? "Nenhum aluno estudou ainda." : `Ninguém estudou nos ${nomePeriodo}. Tente outro período.`}</Vazio>
      ) : (
        <>
          <h2 className="mb-8 text-xl font-bold text-marca-900">Top 3 · {nomePeriodo}</h2>
          <div className="mb-10 grid items-end gap-10 sm:grid-cols-3 sm:gap-4">
            {podio.map((a) => <Podio key={a.email} a={a} />)}
          </div>

          <h2 className="text-xl font-bold text-marca-900">Classificação completa</h2>
          <p className="mt-1 text-sm text-slate-500">
            {plural(ranking.length, "aluno estudou", "alunos estudaram")} {periodo === "geral" ? "desde o início" : `nos ${nomePeriodo}`}. Quem não estudou no período não aparece.
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <Cabecalho dica="Posição no ranking. Em caso de empate, fica na frente quem estudou mais recentemente.">Posição</Cabecalho>
                  <Cabecalho dica="Clique no nome para abrir a ficha do aluno.">Aluno</Cabecalho>
                  <Cabecalho dica="Soma de tudo. Deixe o mouse em cima do número para ver a conta." direita>Pontos</Cabecalho>
                  <Cabecalho dica={`Aulas concluídas no período (${PONTOS.aula} pontos cada).`} direita>Aulas</Cabecalho>
                  <Cabecalho dica={`Provas de aula acertadas por completo no período (${PONTOS.prova} pontos cada).`} direita>Provas</Cabecalho>
                  <Cabecalho dica={`Cursos terminados no período (${PONTOS.curso} pontos cada).`} direita>Cursos</Cabecalho>
                  <Cabecalho dica={`Dias diferentes em que estudou no período (${PONTOS.dia} pontos cada).`} direita>Dias</Cabecalho>
                  <Cabecalho dica="Última vez que fez alguma coisa numa aula.">Estudou</Cabecalho>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ranking.map((a) => (
                  <tr key={a.email} className={a.posicao <= 3 ? "bg-amber-50/40 hover:bg-amber-50" : "hover:bg-marca-50/50"}>
                    <td className="px-4 py-3">
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${a.posicao <= 3 ? `bg-gradient-to-br ${MEDALHA[a.posicao as 1 | 2 | 3].cor}` : "bg-slate-100 text-slate-600"}`}>
                        {a.posicao}º
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link href={fichaDe(a.email)} className="text-marca-900 underline decoration-laranja-500 underline-offset-4 hover:text-marca-700">{a.nome}</Link>
                      {a.nome !== a.email && <span className="block text-xs font-normal text-slate-500">{a.email}</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Dica texto={<Conta a={a} />} className="rounded">
                        <span className="cursor-help font-display text-base font-bold text-marca-900">{a.pontos}</span>
                      </Dica>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{a.aulas}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{a.provas}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{a.cursos}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{a.dias}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{quandoEstudou(a.ultimaAtividade)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
