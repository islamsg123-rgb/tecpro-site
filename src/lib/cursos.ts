import "server-only";
import { adaptarAula, adaptarCurso } from "./escola-avancada/adapter";
import { listarAulasRaw, listarCursosRaw } from "./escola-avancada/client";
import type { Curso, Modulo } from "./types";

/** Ponto único de onde as páginas pegam os cursos. */

export async function getCursos(): Promise<Curso[]> {
  const raw = await listarCursosRaw();
  return raw.map(adaptarCurso);
}

export async function getCursoPorSlug(slug: string): Promise<Curso | null> {
  const cursos = await getCursos();
  return cursos.find((c) => c.slug === slug) ?? null;
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
