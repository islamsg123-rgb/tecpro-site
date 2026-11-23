"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cursoDoAluno, exigirAluno } from "@/lib/area-aluno";
import { definirAulaConcluida } from "@/lib/dados";

/** Marca/desmarca uma aula como concluída. Confere no servidor se o aluno tem o curso e se a aula existe. */
export async function alternarAula(f: FormData) {
  const aluno = await exigirAluno();
  const slug = String(f.get("slug"));
  const aulaId = String(f.get("aulaId"));
  const concluir = f.get("concluir") === "1";
  const irPara = String(f.get("irPara") ?? "");

  const c = await cursoDoAluno(aluno.email, slug);
  if (!c.aulas.some((a) => a.id === aulaId)) return;
  await definirAulaConcluida(aluno.email, c.curso.id, aulaId, concluir);
  revalidatePath("/minha-conta", "layout");
  if (irPara && c.aulas.some((a) => a.id === irPara)) redirect(`/minha-conta/cursos/${slug}/aulas/${encodeURIComponent(irPara)}`);
}
