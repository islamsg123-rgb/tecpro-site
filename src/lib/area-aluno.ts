import "server-only";
import { redirect } from "next/navigation";
import { alunoLogado, type Aluno } from "./auth";
import { getCursoPorSlug, getCursos, getModulos } from "./cursos";
import { aulasConcluidas, obterAluno } from "./dados";
import { cursosVinculados } from "./escola-avancada/client";
import type { Aula, Curso, Modulo } from "./types";

export async function exigirAluno(): Promise<Aluno> {
  const aluno = await alunoLogado();
  if (!aluno) redirect("/entrar");
  return aluno;
}

export interface CursoDoAluno {
  curso: Curso;
  modulos: Modulo[];
  aulas: Aula[];
  concluidas: Set<string>;
  total: number;
  feitas: number;
  pct: number;
  proxima: Aula | null;
}

async function montar(email: string, curso: Curso): Promise<CursoDoAluno> {
  const [modulos, concluidas] = await Promise.all([getModulos(curso.id), aulasConcluidas(email, curso.id)]);
  const aulas = modulos.flatMap((m) => m.aulas);
  const feitas = aulas.filter((a) => concluidas.has(a.id)).length;
  return {
    curso,
    modulos,
    aulas,
    concluidas,
    total: aulas.length,
    feitas,
    pct: aulas.length ? Math.round((feitas / aulas.length) * 100) : 0,
    proxima: aulas.find((a) => !concluidas.has(a.id)) ?? aulas[0] ?? null,
  };
}

/** IDs dos cursos do aluno, consultados na Escola Avançada (fonte oficial das matrículas). */
async function idsDosCursos(email: string): Promise<string[]> {
  const aluno = await obterAluno(email);
  if (!aluno) return [];
  const brutos = await cursosVinculados(aluno.eaUsuarioId);
  if (!brutos.some((b) => b.startsWith("nome:"))) return brutos;
  // A Escola Avançada às vezes só informa o nome do curso: casamos pelo nome.
  const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const cursos = await getCursos();
  return brutos.flatMap((b) => {
    if (!b.startsWith("nome:")) return [b];
    const achado = cursos.find((c) => norm(c.nome) === norm(b.slice(5)));
    return achado ? [achado.id] : [];
  });
}

export async function cursosDoAluno(email: string): Promise<CursoDoAluno[]> {
  const [ids, cursos] = await Promise.all([idsDosCursos(email), getCursos()]);
  const lista = ids
    .map((id) => cursos.find((c) => c.id === id))
    .filter((c): c is Curso => Boolean(c));
  return Promise.all(lista.map((c) => montar(email, c)));
}

/** Curso do aluno pelo slug; manda para "Meus cursos" se ele não estiver matriculado. */
export async function cursoDoAluno(email: string, slug: string): Promise<CursoDoAluno> {
  const curso = await getCursoPorSlug(slug);
  if (!curso) redirect("/minha-conta");
  if (!(await idsDosCursos(email)).includes(curso.id)) redirect(`/cursos/${slug}`);
  return montar(email, curso);
}
