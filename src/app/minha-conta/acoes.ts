"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cursoDoAluno, exigirAluno } from "@/lib/area-aluno";
import { definirAulaConcluida } from "@/lib/dados";
import { emitirCertificado, limparNome } from "@/lib/certificados";
import { corrigir, type ResultadoProva } from "@/lib/provas";

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

/** Emite o certificado com o nome confirmado pelo aluno. */
export async function emitir(f: FormData) {
  const aluno = await exigirAluno();
  const slug = String(f.get("slug"));
  const nome = limparNome(String(f.get("nome") ?? ""));
  if (nome.split(" ").length < 2) redirect(`/minha-conta/cursos/${slug}?erroNome=1#certificado`);
  const c = await cursoDoAluno(aluno.email, slug);
  await emitirCertificado(aluno.email, c, nome);
  revalidatePath("/minha-conta", "layout");
  redirect(`/minha-conta/cursos/${slug}#certificado`);
}

/** Corrige a prova de uma aula no servidor (o gabarito não vai para o navegador). */
export async function corrigirProva(
  _anterior: ResultadoProva | null,
  f: FormData,
): Promise<ResultadoProva | null> {
  const aluno = await exigirAluno();
  const slug = String(f.get("slug"));
  const aulaId = String(f.get("aulaId"));
  const c = await cursoDoAluno(aluno.email, slug);
  const i = c.aulas.findIndex((a) => a.id === aulaId);
  if (i < 0) return null;
  const total = Number(f.get("total")) || 0;
  const respostas = Array.from({ length: Math.min(total, 200) }, (_, k) => {
    const v = f.get(`q${k}`);
    return v === null ? -1 : Number(v);
  });
  return corrigir(c.curso.nome, i, c.aulas[i].titulo, respostas);
}
