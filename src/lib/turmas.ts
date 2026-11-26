import "server-only";
import { getCursos } from "./cursos";
import { calcularProgresso, DIAS_PARADO, type SituacaoCurso } from "./ranking";
import { semAula, todosCursosRemovidos } from "./lembretes";
import { diasDesde } from "./dias";
import type { Curso } from "./types";

/**
 * Alunos por curso (a "turma" de cada curso).
 *
 * Um aluno conta na turma de um curso quando:
 *  - abriu pelo menos uma aula do curso (vem do progresso), ou
 *  - concluiu a inscrição do curso pelo site (grátis ou paga) e ainda não abriu aula.
 * Curso tirado do aluno pelo painel não conta.
 * Aluno cadastrado só pelo painel (sem inscrição no site) entra quando abrir a primeira aula.
 */

export type SituacaoNaTurma = SituacaoCurso | "nunca";

export interface AlunoDaTurma {
  email: string;
  nome: string;
  situacao: SituacaoNaTurma;
  pct: number;
  feitas: number;
  total: number;
  /** Última vez que estudou este curso (vazio se nunca abriu aula) */
  ultimaAtividade: string;
  /** Dias desde a última aula, ou desde a inscrição para quem nunca começou */
  dias: number;
  parado: boolean;
}

export interface Turma {
  curso: Curso;
  alunos: AlunoDaTurma[];
  total: number;
  nunca: number;
  andamento: number;
  concluiram: number;
  certificados: number;
  parados: number;
}

const norm = (e: string) => e.trim().toLowerCase();

const ORDEM: Record<SituacaoNaTurma, number> = {
  quase: 0, concluido_sem_certificado: 1, andamento: 2, nunca: 3, concluido_com_certificado: 4,
};

export async function calcularTurmas(): Promise<Turma[]> {
  const [cursos, progresso, { nunca }, removidos] = await Promise.all([
    getCursos(),
    calcularProgresso(),
    semAula(0).catch(() => ({ nunca: [] })),
    todosCursosRemovidos().catch(() => new Set<string>()),
  ]);

  const porCurso = new Map<string, Map<string, AlunoDaTurma>>();
  const turmaDe = (id: string) => {
    let t = porCurso.get(id);
    if (!t) porCurso.set(id, (t = new Map()));
    return t;
  };

  for (const a of progresso) {
    const email = norm(a.email);
    for (const c of a.cursos) {
      if (removidos.has(`${email}|${c.cursoId}`)) continue;
      const dias = diasDesde(c.ultimaAtividade) ?? 0;
      turmaDe(c.cursoId).set(email, {
        email, nome: a.nome, situacao: c.situacao, pct: c.pct, feitas: c.feitas, total: c.total,
        ultimaAtividade: c.ultimaAtividade, dias, parado: c.pct < 100 && dias >= DIAS_PARADO,
      });
    }
  }
  for (const p of nunca) {
    const email = norm(p.email);
    const t = turmaDe(p.cursoId);
    if (t.has(email)) continue;
    t.set(email, {
      email, nome: p.nome || email, situacao: "nunca", pct: 0, feitas: 0, total: 0,
      ultimaAtividade: "", dias: p.dias, parado: false,
    });
  }

  return cursos
    .map((curso) => {
      const alunos = Array.from(porCurso.get(curso.id)?.values() ?? []).sort(
        (x, y) => ORDEM[x.situacao] - ORDEM[y.situacao] || y.pct - x.pct || x.dias - y.dias,
      );
      return {
        curso,
        alunos,
        total: alunos.length,
        nunca: alunos.filter((a) => a.situacao === "nunca").length,
        andamento: alunos.filter((a) => a.situacao === "andamento" || a.situacao === "quase").length,
        concluiram: alunos.filter((a) => a.situacao === "concluido_sem_certificado" || a.situacao === "concluido_com_certificado").length,
        certificados: alunos.filter((a) => a.situacao === "concluido_com_certificado").length,
        parados: alunos.filter((a) => a.parado).length,
      };
    })
    .sort((a, b) => b.total - a.total || a.curso.nome.localeCompare(b.curso.nome, "pt-BR"));
}
