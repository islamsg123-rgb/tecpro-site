import "server-only";
import { getCursos, getModulos } from "./cursos";
import { listarAlunos, listarCertificados, todasAsLinhasDeProgresso, type LinhaProgresso } from "./dados";
import { diasDesde } from "./dias";

/**
 * Progresso dos alunos (antes era "ranking por pontos").
 *
 * Usa só o que o site já registra quando o aluno estuda (tabela "progresso"):
 * cada aula concluída de cada curso. A porcentagem de um curso é
 * aulas concluídas ÷ total de aulas do curso.
 * Um curso entra na lista do aluno quando ele abriu pelo menos uma aula.
 * O que foi marcado pelo "Modo teste" do painel é ignorado.
 */

/** A partir de quanto o curso conta como "quase terminando". */
export const QUASE = 80;
/** Dias sem estudar para contar como "parado". */
export const DIAS_PARADO = 7;

export type SituacaoCurso = "concluido_com_certificado" | "concluido_sem_certificado" | "quase" | "andamento";

export interface CursoDoAluno {
  cursoId: string;
  nome: string;
  feitas: number;
  total: number;
  pct: number;
  situacao: SituacaoCurso;
  ultimaAtividade: string;
}

export interface ProgressoAluno {
  email: string;
  nome: string;
  cursos: CursoDoAluno[];
  /** Maior porcentagem entre os cursos que ainda não têm certificado (o curso mais adiantado). */
  maiorPct: number;
  aulas: number;
  ultimaAtividade: string;
  diasSemEstudar: number;
  quase: boolean;
  semCertificado: boolean;
  andamento: boolean;
  parado: boolean;
}

export type Filtro = "todos" | "quase" | "andamento" | "sem-certificado" | "parados";
export const FILTROS: { id: Filtro; rotulo: string; dica: string }[] = [
  { id: "todos", rotulo: "Todos", dica: "Todos os alunos que já abriram pelo menos uma aula." },
  { id: "quase", rotulo: "Quase terminando", dica: `Alunos com algum curso entre ${QUASE}% e 99%. Estão perto do fim: bom momento para incentivar e lembrar do certificado.` },
  { id: "andamento", rotulo: "Em andamento", dica: `Alunos com algum curso começado e abaixo de ${QUASE}%.` },
  { id: "sem-certificado", rotulo: "Concluíram sem certificado", dica: "Terminaram pelo menos um curso e ainda não emitiram o certificado dele. São os mais prontos para comprar o certificado." },
  { id: "parados", rotulo: `Parados (${DIAS_PARADO}+ dias)`, dica: `Têm curso não terminado e não estudam há ${DIAS_PARADO} dias ou mais. Precisam de um empurrão.` },
];

/** Tira as linhas gravadas pelo "Modo teste" (mesmo horário da linha "#teste" do curso). */
function semModoTeste(linhas: LinhaProgresso[]): LinhaProgresso[] {
  const teste = new Set(linhas.filter((l) => l.aulaId === "#teste").map((l) => `${l.email}|${l.cursoId}|${l.quando}`));
  if (!teste.size) return linhas.filter((l) => l.aulaId !== "#teste");
  return linhas.filter((l) => l.aulaId !== "#teste" && !teste.has(`${l.email}|${l.cursoId}|${l.quando}`));
}

const PESO: Record<SituacaoCurso, number> = { quase: 0, concluido_sem_certificado: 1, andamento: 2, concluido_com_certificado: 3 };

export async function calcularProgresso(): Promise<ProgressoAluno[]> {
  const [brutas, alunos, certificados, catalogo] = await Promise.all([
    todasAsLinhasDeProgresso(),
    listarAlunos(5000),
    listarCertificados(20000).catch(() => []),
    getCursos().catch(() => []),
  ]);
  const linhas = semModoTeste(brutas);
  const nomes = new Map(alunos.map((a) => [a.email, a.nome]));
  const nomesCursos = new Map(catalogo.map((c) => [c.id, c.nome]));
  const comCertificado = new Set(certificados.map((c) => `${c.email}|${c.cursoId}`));

  // Por aluno e curso: aulas concluídas (sem "#") e última atividade (qualquer linha).
  const porCurso = new Map<string, { feitas: Set<string>; ultima: string }>();
  for (const l of linhas) {
    const k = `${l.email}|${l.cursoId}`;
    let c = porCurso.get(k);
    if (!c) porCurso.set(k, (c = { feitas: new Set(), ultima: "" }));
    if (!l.aulaId.includes("#")) c.feitas.add(l.aulaId);
    if (l.quando > c.ultima) c.ultima = l.quando;
  }

  // Total de aulas de cada curso que aparece no progresso.
  const idsCursos = Array.from(new Set(Array.from(porCurso.keys(), (k) => k.split("|")[1])));
  const totais = new Map<string, number>();
  for (let i = 0; i < idsCursos.length; i += 8) {
    await Promise.all(
      idsCursos.slice(i, i + 8).map(async (id) => {
        const mods = await getModulos(id).catch(() => []);
        totais.set(id, mods.reduce((s, m) => s + m.aulas.length, 0));
      }),
    );
  }

  const porAluno = new Map<string, CursoDoAluno[]>();
  for (const [k, c] of porCurso) {
    const [email, cursoId] = k.split("|");
    const total = totais.get(cursoId) ?? 0;
    if (!total) continue; // curso que não existe mais na Escola Avançada
    const feitas = Math.min(c.feitas.size, total);
    const pct = Math.floor((feitas / total) * 100);
    const situacao: SituacaoCurso =
      feitas >= total
        ? comCertificado.has(k) ? "concluido_com_certificado" : "concluido_sem_certificado"
        : pct >= QUASE ? "quase" : "andamento";
    const lista = porAluno.get(email) ?? [];
    lista.push({ cursoId, nome: nomesCursos.get(cursoId) ?? `Curso ${cursoId}`, feitas, total, pct: feitas >= total ? 100 : pct, situacao, ultimaAtividade: c.ultima });
    porAluno.set(email, lista);
  }

  const out: ProgressoAluno[] = Array.from(porAluno, ([email, cursos]) => {
    // Dentro do aluno: mais perto de terminar primeiro (os já certificados vão para o fim).
    cursos.sort((a, b) => PESO[a.situacao] - PESO[b.situacao] || b.pct - a.pct);
    const ultima = cursos.reduce((m, c) => (c.ultimaAtividade > m ? c.ultimaAtividade : m), "");
    const diasSemEstudar = diasDesde(ultima || null) ?? 9999;
    const temAberto = cursos.some((c) => c.pct < 100);
    return {
      email,
      nome: nomes.get(email) || email,
      cursos,
      // Curso com certificado já emitido não puxa o aluno para cima: ali não há mais nada a fazer.
      // Se tudo dele já tem certificado, vai para o fim da lista (-1).
      maiorPct: Math.max(-1, ...cursos.filter((c) => c.situacao !== "concluido_com_certificado").map((c) => c.pct)),
      aulas: cursos.reduce((s, c) => s + c.feitas, 0),
      ultimaAtividade: ultima,
      diasSemEstudar,
      quase: cursos.some((c) => c.situacao === "quase"),
      semCertificado: cursos.some((c) => c.situacao === "concluido_sem_certificado"),
      andamento: cursos.some((c) => c.situacao === "andamento"),
      parado: temAberto && diasSemEstudar >= DIAS_PARADO,
    };
  });

  // Mais adiantado em cima: maior % de um curso; empate: mais aulas feitas; depois quem estudou mais recente.
  return out.sort((a, b) => b.maiorPct - a.maiorPct || b.aulas - a.aulas || b.ultimaAtividade.localeCompare(a.ultimaAtividade));
}

export function filtrar(lista: ProgressoAluno[], f: Filtro): ProgressoAluno[] {
  if (f === "quase") return lista.filter((a) => a.quase);
  if (f === "andamento") return lista.filter((a) => a.andamento);
  if (f === "sem-certificado") return lista.filter((a) => a.semCertificado);
  if (f === "parados") return lista.filter((a) => a.parado);
  return lista;
}
