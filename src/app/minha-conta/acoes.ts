"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cursoDoAluno, exigirAluno } from "@/lib/area-aluno";
import { definirAulaConcluida, marcarEtapa } from "@/lib/dados";
import { PCT_MINIMO_VIDEO, situacaoDaAula } from "@/lib/regras-aula";
import { emitirCertificado, limparNome } from "@/lib/certificados";
import { corrigir, type ResultadoProva } from "@/lib/provas";

/** Aula pelo id, só se estiver liberada (as anteriores concluídas). */
async function aulaLiberada(slug: string, aulaId: string) {
  const aluno = await exigirAluno();
  const c = await cursoDoAluno(aluno.email, slug);
  const i = c.aulas.findIndex((a) => a.id === aulaId);
  if (i < 0 || i > c.liberadaAte) return null;
  return { aluno, c, i };
}

/**
 * Conclui a aula (e vai para a próxima). Só conclui se o aluno cumpriu as regras:
 * vídeo assistido (80%) e prova com todas as questões certas. Conferido no servidor.
 */
export async function alternarAula(f: FormData) {
  const slug = String(f.get("slug"));
  const aulaId = String(f.get("aulaId"));
  const irPara = String(f.get("irPara") ?? "");
  const x = await aulaLiberada(slug, aulaId);
  if (!x) return;
  const { aluno, c, i } = x;
  if (!c.concluidas.has(aulaId)) {
    const s = await situacaoDaAula(aluno.email, c, i);
    if (!s.videoOk || !s.provaOk) return;
    await definirAulaConcluida(aluno.email, c.curso.id, aulaId, true);
    revalidatePath("/minha-conta", "layout");
  }
  if (irPara && c.aulas[i + 1]?.id === irPara) redirect(`/minha-conta/cursos/${slug}/aulas/${encodeURIComponent(irPara)}`);
}

/** Marca quando o aluno abriu a aula (usado para conferir o tempo mínimo). */
export async function iniciarAula(slug: string, aulaId: string): Promise<void> {
  const x = await aulaLiberada(slug, aulaId);
  if (!x) return;
  await marcarEtapa(x.aluno.email, x.c.curso.id, aulaId, "inicio");
}

/**
 * O player informa quanto do vídeo foi assistido. O servidor confere se é plausível:
 * pelo menos 80% assistido e tempo real desde a abertura da aula compatível
 * (aceita assistir até 2x mais rápido).
 */
export async function registrarVideo(slug: string, aulaId: string, assistidoSeg: number, duracaoSeg: number): Promise<boolean> {
  const x = await aulaLiberada(slug, aulaId);
  if (!x) return false;
  const { aluno, c, i } = x;
  if (!(duracaoSeg > 0) || !(assistidoSeg >= 0)) return false;
  if (assistidoSeg < PCT_MINIMO_VIDEO * duracaoSeg) return false;
  const s = await situacaoDaAula(aluno.email, c, i);
  if (s.tipo !== "panda") return false;
  if (s.videoOk) return true;
  const decorrido = s.inicio ? (Date.now() - s.inicio.getTime()) / 1000 : 0;
  if (decorrido + 5 < (PCT_MINIMO_VIDEO * duracaoSeg) / 2) return false;
  await marcarEtapa(aluno.email, c.curso.id, aulaId, "video");
  return true;
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
  const slug = String(f.get("slug"));
  const aulaId = String(f.get("aulaId"));
  const x = await aulaLiberada(slug, aulaId);
  if (!x) return null;
  const { aluno, c, i } = x;
  const total = Number(f.get("total")) || 0;
  const respostas = Array.from({ length: Math.min(total, 200) }, (_, k) => {
    const v = f.get(`q${k}`);
    return v === null ? -1 : Number(v);
  });
  const r = corrigir(c.curso.nome, i, c.aulas[i].titulo, respostas);
  if (r && r.acertos === r.total) await marcarEtapa(aluno.email, c.curso.id, aulaId, "prova");
  return r;
}
