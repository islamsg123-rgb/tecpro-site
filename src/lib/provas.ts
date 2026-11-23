import "server-only";
import todas from "@/data/conteudo-escola/provas.json";

/**
 * Provas (perguntas + gabarito) lidas da página "Gabarito das provas" do painel da Escola Avançada.
 * Organizadas por nome do curso; dentro do curso, por título da aula (t) ou pelo número da aula (n).
 * O gabarito nunca vai para o navegador: a correção é feita no servidor.
 */
type Pergunta = [pergunta: string, alternativas: string[], correta: number];
type ProvasCurso = { t: Record<string, Pergunta[]>; n: Record<string, Pergunta[]> };

const PROVAS = todas as unknown as Record<string, ProvasCurso>;

const norm = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const semNumero = (t: string) => norm(t).replace(/^(aula |prova |atividade )?\d+\s*/, "").trim();

function perguntasDaAula(cursoNome: string, posicao: number, titulo: string): Pergunta[] {
  const p = PROVAS[norm(cursoNome)];
  if (!p) return [];
  return p.t[semNumero(titulo)] ?? p.t[norm(titulo)] ?? p.n[String(posicao + 1)] ?? [];
}

/** Perguntas sem o gabarito, para mostrar ao aluno. */
export interface PerguntaPublica {
  pergunta: string;
  alternativas: string[];
}

export function provaDaAula(cursoNome: string, posicao: number, titulo: string): PerguntaPublica[] {
  return perguntasDaAula(cursoNome, posicao, titulo).map(([pergunta, alternativas]) => ({
    pergunta,
    alternativas: alternativas.filter((a) => a && a.trim()),
  }));
}

export interface ResultadoProva {
  acertos: number;
  total: number;
  /** Índice da alternativa certa de cada pergunta (só depois de enviar). */
  corretas: number[];
  respostas: number[];
}

export function corrigir(cursoNome: string, posicao: number, titulo: string, respostas: number[]): ResultadoProva | null {
  const ps = perguntasDaAula(cursoNome, posicao, titulo);
  if (!ps.length) return null;
  // índices relativos às alternativas não vazias (as mesmas mostradas ao aluno)
  const corretas = ps.map(([, alts, c]) => alts.slice(0, c).filter((a) => a && a.trim()).length);
  const acertos = corretas.filter((c, i) => respostas[i] === c).length;
  return { acertos, total: ps.length, corretas, respostas };
}
