import "server-only";
import { adaptarAula, adaptarCurso } from "./escola-avancada/adapter";
import { listarAulasRaw, listarCursosRaw } from "./escola-avancada/client";
import { configuracoesDosCursos } from "./dados";
import type { Curso, Modulo } from "./types";

/**
 * Ponto único de onde as páginas pegam os cursos.
 * Junta os dados da Escola Avançada com os ajustes do painel (preço, visível, destaque).
 */

/** Todos os cursos, inclusive os escondidos (para a área do aluno e o painel). */
export async function getCursos(): Promise<Curso[]> {
  const [raw, cfg] = await Promise.all([listarCursosRaw(), configuracoesDosCursos()]);
  return raw.map((r) => {
    const c = adaptarCurso(r);
    const ajuste = cfg.get(c.id);
    if (!ajuste) return c;
    return {
      ...c,
      precoCentavos: ajuste.precoCentavos ?? c.precoCentavos,
      visivel: ajuste.visivel,
      destaque: ajuste.destaque,
    };
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
  const aulas = (await listarAulasRaw(cursoId)).map(adaptarAula).sort((a, b) => a.ordem - b.ordem);
  const modulos: Modulo[] = [];
  for (const aula of aulas) {
    const ultimo = modulos[modulos.length - 1];
    if (ultimo && ultimo.nome === aula.modulo) ultimo.aulas.push(aula);
    else modulos.push({ nome: aula.modulo, aulas: [aula] });
  }
  return modulos;
}

export { formatarPreco } from "./formatar";
