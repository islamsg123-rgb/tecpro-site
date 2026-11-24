import "server-only";
import { getModulos } from "./cursos";
import { listarAlunos, todasAsLinhasDeProgresso, type LinhaProgresso } from "./dados";

/**
 * Ranking dos alunos mais dedicados.
 *
 * Usa só o que o site já registra quando o aluno estuda (tabela "progresso"):
 *  - aula concluída (só conclui com 80% do vídeo assistido e a prova toda certa);
 *  - prova aprovada (linha "aula#prova");
 *  - curso concluído (todas as aulas do curso concluídas);
 *  - dias diferentes em que o aluno estudou (constância).
 * O site NÃO mede o tempo que a pessoa fica com a página aberta, então isso não entra.
 * O que foi marcado pelo "Modo teste" do painel é ignorado.
 */

export const PONTOS = { aula: 10, prova: 5, curso: 50, dia: 15 } as const;

export type Periodo = "7" | "30" | "geral";
export const PERIODOS: { id: Periodo; rotulo: string }[] = [
  { id: "7", rotulo: "Últimos 7 dias" },
  { id: "30", rotulo: "Últimos 30 dias" },
  { id: "geral", rotulo: "Desde o início" },
];

export interface PosicaoRanking {
  posicao: number;
  email: string;
  nome: string;
  pontos: number;
  aulas: number;
  provas: number;
  cursos: number;
  dias: number;
  ultimaAtividade: string;
}

const diaSP = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Tira as linhas gravadas pelo "Modo teste" (mesmo horário da linha "#teste" do curso). */
function semModoTeste(linhas: LinhaProgresso[]): LinhaProgresso[] {
  const teste = new Set(linhas.filter((l) => l.aulaId === "#teste").map((l) => `${l.email}|${l.cursoId}|${l.quando}`));
  if (!teste.size) return linhas;
  return linhas.filter((l) => !teste.has(`${l.email}|${l.cursoId}|${l.quando}`));
}

export async function calcularRanking(periodo: Periodo): Promise<PosicaoRanking[]> {
  const [brutas, alunos] = await Promise.all([todasAsLinhasDeProgresso(), listarAlunos(5000)]);
  const linhas = semModoTeste(brutas);
  const nomes = new Map(alunos.map((a) => [a.email, a.nome]));
  const desde = periodo === "geral" ? 0 : Date.now() - Number(periodo) * 86_400_000;
  const noPeriodo = (iso: string) => new Date(iso).getTime() >= desde;

  // Aulas reais de cada aluno em cada curso (de todo o tempo), para saber quando o curso foi concluído.
  const aulasPorCurso = new Map<string, LinhaProgresso[]>();
  for (const l of linhas) {
    if (l.aulaId.includes("#")) continue;
    const k = `${l.email}|${l.cursoId}`;
    const lista = aulasPorCurso.get(k) ?? [];
    lista.push(l);
    aulasPorCurso.set(k, lista);
  }
  // Total de aulas dos cursos que aparecem no progresso.
  const idsCursos = Array.from(new Set(Array.from(aulasPorCurso.keys()).map((k) => k.split("|")[1])));
  const totais = new Map<string, number>();
  for (let i = 0; i < idsCursos.length; i += 8) {
    await Promise.all(
      idsCursos.slice(i, i + 8).map(async (id) => {
        const mods = await getModulos(id).catch(() => []);
        totais.set(id, mods.reduce((s, m) => s + m.aulas.length, 0));
      }),
    );
  }

  const porAluno = new Map<string, { aulas: number; provas: number; cursos: number; dias: Set<string>; ultima: string }>();
  const doAluno = (email: string) => {
    let a = porAluno.get(email);
    if (!a) porAluno.set(email, (a = { aulas: 0, provas: 0, cursos: 0, dias: new Set(), ultima: "" }));
    return a;
  };

  for (const l of linhas) {
    if (l.aulaId === "#teste" || !noPeriodo(l.quando)) continue;
    const a = doAluno(l.email);
    if (!l.aulaId.includes("#")) a.aulas++;
    else if (l.aulaId.endsWith("#prova")) a.provas++;
    a.dias.add(diaSP(l.quando));
    if (l.quando > a.ultima) a.ultima = l.quando;
  }

  // Curso concluído conta no período em que a última aula foi concluída.
  for (const [k, lista] of aulasPorCurso) {
    const [email, cursoId] = k.split("|");
    const total = totais.get(cursoId) ?? 0;
    if (!total || lista.length < total) continue;
    const terminou = lista.reduce((m, l) => (l.quando > m ? l.quando : m), "");
    if (noPeriodo(terminou)) doAluno(email).cursos++;
  }

  const out = Array.from(porAluno, ([email, a]) => ({
    posicao: 0,
    email,
    nome: nomes.get(email) || email,
    aulas: a.aulas,
    provas: a.provas,
    cursos: a.cursos,
    dias: a.dias.size,
    ultimaAtividade: a.ultima,
    pontos: a.aulas * PONTOS.aula + a.provas * PONTOS.prova + a.cursos * PONTOS.curso + a.dias.size * PONTOS.dia,
  }))
    .filter((a) => a.pontos > 0)
    // Empate: quem estudou mais recentemente fica na frente.
    .sort((a, b) => b.pontos - a.pontos || b.ultimaAtividade.localeCompare(a.ultimaAtividade));

  out.forEach((a, i) => (a.posicao = i + 1));
  return out;
}
