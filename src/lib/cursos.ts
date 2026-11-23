import "server-only";
import { adaptarAula, adaptarCurso } from "./escola-avancada/adapter";
import { listarAulasRaw, listarCursosRaw } from "./escola-avancada/client";
import { configuracoesDosCursos, cursosGratuitos } from "./dados";
import { titulosLocais } from "./conteudo-escola";
import type { Curso, Modulo } from "./types";
import type { EAAulaRaw } from "./escola-avancada/types";

/**
 * Ponto único de onde as páginas pegam os cursos.
 * Junta os dados da Escola Avançada com os ajustes do painel (preço, visível, destaque).
 */

/** Todos os cursos, inclusive os escondidos (para a área do aluno e o painel). */
export async function getCursos(): Promise<Curso[]> {
  const [raw, cfg, gratis] = await Promise.all([listarCursosRaw(), configuracoesDosCursos(), cursosGratuitos()]);
  return raw.flatMap((r) => {
    const base = adaptarCurso(r);
    if (!base) return [];
    const ajuste = cfg.get(base.id);
    const c: Curso = ajuste
      ? { ...base, precoCentavos: ajuste.precoCentavos ?? base.precoCentavos, visivel: ajuste.visivel, destaque: ajuste.destaque }
      : base;
    // Curso gratuito: preço zero na vitrine; a matrícula é feita sem pagamento.
    return [gratis.has(c.id) ? { ...c, gratuito: true, precoCentavos: 0 } : c];
  });
}

/** Cursos da vitrine: só os visíveis, com os destaques primeiro. */
export async function getCursosPublicos(): Promise<Curso[]> {
  const cursos = (await getCursos()).filter((c) => c.visivel);
  return [...cursos.filter((c) => c.destaque), ...cursos.filter((c) => !c.destaque)];
}

export async function getCursoPorSlug(slug: string): Promise<Curso | null> {
  return (await getCursos()).find((c) => c.slug === slug) ?? null;
}

export async function getCursoPublicoPorSlug(slug: string): Promise<Curso | null> {
  return (await getCursosPublicos()).find((c) => c.slug === slug) ?? null;
}

export async function getModulos(cursoId: string): Promise<Modulo[]> {
  let brutas = await listarAulasRaw(cursoId);
  // Se a Escola Avançada não responder, usamos a lista de aulas guardada no site (mesma ordem e mesmos números).
  if (!brutas.length) brutas = titulosLocais(cursoId).map((t) => ({ aula: t }) as unknown as EAAulaRaw);
  const aulas = brutas.map(adaptarAula).sort((a, b) => a.ordem - b.ordem);
  const modulos: Modulo[] = [];
  for (const aula of aulas) {
    const ultimo = modulos[modulos.length - 1];
    if (ultimo && ultimo.nome === aula.modulo) ultimo.aulas.push(aula);
    else modulos.push({ nome: aula.modulo, aulas: [aula] });
  }
  return modulos;
}

export { formatarPreco, precoDoCurso } from "./formatar";
