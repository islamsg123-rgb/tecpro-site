import "server-only";
import type { CursoDoAluno } from "./area-aluno";
import { conteudoDaAula } from "./conteudo-escola";
import { etapasDaAula } from "./dados";
import { provaDaAula } from "./provas";

/**
 * Regras para concluir uma aula e liberar a próxima:
 * - vídeo do Panda: assistir pelo menos 80% (medido pelo player);
 * - Google Drive / Slides (o player não informa o tempo assistido): ficar pelo menos 2 minutos na aula;
 * - aula com prova: acertar todas as questões.
 */
export const PCT_MINIMO_VIDEO = 0.8;
export const SEGUNDOS_MINIMOS_OUTRO = 120;

export type TipoMidia = "panda" | "outro" | "nenhum";

export interface SituacaoAula {
  tipo: TipoMidia;
  temProva: boolean;
  videoOk: boolean;
  provaOk: boolean;
  /** Segundos que ainda faltam na aula (só para Drive/Slides). */
  faltamSegundos: number;
  inicio: Date | null;
}

export function tipoDaMidia(embed: string | null | undefined): TipoMidia {
  if (!embed) return "nenhum";
  return /\.pandavideo\.com\.br\//.test(embed) ? "panda" : "outro";
}

export async function situacaoDaAula(email: string, c: CursoDoAluno, i: number): Promise<SituacaoAula> {
  const aula = c.aulas[i];
  const tipo = tipoDaMidia(conteudoDaAula(c.curso.id, i, aula.titulo)?.embed);
  const temProva = provaDaAula(c.curso.nome, i, aula.titulo).length > 0;
  const e = await etapasDaAula(email, c.curso.id, aula.id);
  const inicio = e.inicio ?? null;
  const decorrido = inicio ? (Date.now() - inicio.getTime()) / 1000 : 0;
  const faltamSegundos = tipo === "outro" ? Math.max(0, Math.ceil(SEGUNDOS_MINIMOS_OUTRO - decorrido)) : 0;
  const videoOk = tipo === "nenhum" || Boolean(e.video) || (tipo === "outro" && inicio !== null && faltamSegundos === 0);
  return { tipo, temProva, videoOk, provaOk: !temProva || Boolean(e.prova), faltamSegundos, inicio };
}
