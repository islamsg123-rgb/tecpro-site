import "server-only";
import todos from "@/data/conteudo-escola/cursos.json";

/**
 * Vídeos, apostilas e provas dos cursos da Escola Avançada.
 * A API deles não entrega isso: o conteúdo foi lido da Área do Aluno (aluno de teste com todos
 * os cursos) e guardado em src/data/conteudo-escola/cursos.json. Para atualizar, repetir a leitura.
 */

export interface ConteudoAula {
  /** Código da aula na Escola Avançada */
  aulaEscola: string;
  titulo: string;
  tipo: "video" | "slides" | "outro";
  embed: string | null;
}

interface ConteudoCurso {
  nome: string;
  apostila: string | null;
  aulas: ConteudoAula[];
}

const CURSOS = todos as unknown as Record<string, ConteudoCurso>;

// Só aceitamos players destes endereços.
const PERMITIDOS =
  /^https:\/\/([a-z0-9-]+\.tv\.pandavideo\.com\.br|drive\.google\.com|docs\.google\.com|www\.youtube\.com|www\.youtube-nocookie\.com|player\.vimeo\.com)\//;

const norm = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Conteúdo da aula. Procura pelo título (o mais seguro); se não achar, usa a posição no curso.
 */
export function conteudoDaAula(cursoId: string, posicao: number, titulo?: string): ConteudoAula | null {
  const curso = CURSOS[cursoId];
  if (!curso) return null;
  let a: ConteudoAula | undefined;
  if (titulo) {
    const alvo = norm(titulo);
    a = curso.aulas.find((x) => norm(x.titulo) === alvo);
  }
  a ??= curso.aulas[posicao];
  return a && a.embed && PERMITIDOS.test(a.embed) ? a : null;
}

export function apostilaDoCurso(cursoId: string): string | null {
  const url = CURSOS[cursoId]?.apostila ?? null;
  return url && url.startsWith("https://") ? url : null;
}

export function temConteudo(cursoId: string): boolean {
  return Boolean(CURSOS[cursoId]?.aulas.length);
}
