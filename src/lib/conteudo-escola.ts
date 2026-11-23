import "server-only";
import afterEffects from "@/data/conteudo-escola/69.json";

/**
 * Vídeos e apostilas dos cursos da Escola Avançada.
 * A API deles não entrega isso, então o conteúdo foi lido da Área do Aluno e guardado aqui
 * (um arquivo por curso, em src/data/conteudo-escola). As aulas seguem a mesma ordem do curso.
 * Piloto: só After Effects (curso 69).
 */

export interface ConteudoAula {
  aulaEscola: string;
  tipo: "video" | "slides";
  embed: string;
}

interface ConteudoCurso {
  curso: string;
  apostila: string | null;
  aulas: ConteudoAula[];
}

const CURSOS: Record<string, ConteudoCurso> = {
  "69": afterEffects as ConteudoCurso,
};

// Só aceitamos players destes endereços.
const PERMITIDOS = /^https:\/\/([a-z0-9-]+\.tv\.pandavideo\.com\.br|drive\.google\.com|docs\.google\.com)\//;

/** Conteúdo da aula pela posição dela no curso (0 = primeira aula). */
export function conteudoDaAula(cursoId: string, posicao: number): ConteudoAula | null {
  const a = CURSOS[cursoId]?.aulas[posicao];
  return a && PERMITIDOS.test(a.embed) ? a : null;
}

export function apostilaDoCurso(cursoId: string): string | null {
  const url = CURSOS[cursoId]?.apostila ?? null;
  return url && url.startsWith("https://") ? url : null;
}
