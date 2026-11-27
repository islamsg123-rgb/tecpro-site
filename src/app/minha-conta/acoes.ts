"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cursoDoAluno, exigirAluno } from "@/lib/area-aluno";
import { definirAulaConcluida, marcarEtapa, obterAluno, usarCredito } from "@/lib/dados";
import { registrarPesquisa } from "@/lib/dados/painel";
import { PCT_MINIMO_VIDEO, situacaoDaAula } from "@/lib/regras-aula";
import { emitirCertificado, limparNome, situacaoCertificado } from "@/lib/certificados";
import { corrigir, provaDaAula, type ResultadoProva } from "@/lib/provas";
import { registrarMensagem } from "@/lib/dados/mensagens";
import { obterConfigLoja } from "@/lib/dados";
import { emailConfigurado, enviarEmail } from "@/lib/email";
import { certificadoLiberado } from "@/lib/lembrete-certificado";

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

/**
 * Emite o certificado com o nome do cadastro. O aluno não pode trocar o nome:
 * se estiver errado, fala com o suporte, que corrige na ficha do aluno no painel.
 */
export async function emitir(f: FormData) {
  const aluno = await exigirAluno();
  const slug = String(f.get("slug"));
  const nome = limparNome((await obterAluno(aluno.email))?.nome ?? "");
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

/* ---------- Pesquisa de satisfação (opcional, botão nas aulas) ---------- */

export async function enviarPesquisa(_: { ok?: boolean; erro?: string }, f: FormData): Promise<{ ok?: boolean; erro?: string }> {
  const aluno = await exigirAluno();
  const nota = Number(f.get("nota"));
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) return { erro: "Escolha de 1 a 5 estrelas." };
  const rec = String(f.get("recomenda") ?? "");
  const recomenda = rec === "" ? null : Number(rec);
  const slug = String(f.get("slug") ?? "");
  const aulaId = String(f.get("aulaId") ?? "");
  try {
    const c = slug ? await cursoDoAluno(aluno.email, slug) : null;
    const registro = await obterAluno(aluno.email);
    await registrarPesquisa({
      email: aluno.email,
      nome: registro?.nome ?? null,
      cursoId: c?.curso.id ?? null,
      cursoNome: c?.curso.nome ?? null,
      aulaTitulo: c?.aulas.find((a) => a.id === aulaId)?.titulo ?? null,
      nota,
      recomenda: recomenda !== null && Number.isInteger(recomenda) && recomenda >= 0 && recomenda <= 10 ? recomenda : null,
      comentario: String(f.get("comentario") ?? "").trim().slice(0, 1500) || null,
    });
    return { ok: true };
  } catch (e) {
    console.error("[pesquisa]", e instanceof Error ? e.message : e);
    return { erro: "Não conseguimos enviar agora. Tente de novo mais tarde." };
  }
}

/* ---------- Usar um certificado do pacote comprado ---------- */

export async function usarCreditoCertificado(f: FormData) {
  const aluno = await exigirAluno();
  const slug = String(f.get("slug") ?? "");
  const c = await cursoDoAluno(aluno.email, slug);
  const s = await situacaoCertificado(aluno.email, c);
  // Só vale para curso concluído que está esperando o pagamento do certificado.
  if (s.estado === "aguardando_pagamento" && (await usarCredito(aluno.email, c.curso.id))) await certificadoLiberado(aluno.email, c.curso.id);
  revalidatePath(`/minha-conta/cursos/${slug}`);
  redirect(`/minha-conta/cursos/${slug}#certificado`);
}

/* ---------- Aluno avisa que uma questão da prova está errada ---------- */

export interface EstadoReporteQuestao { ok?: boolean; erro?: string }
const reportesRecentes = new Map<string, number[]>();
const escHtml = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Vai para o painel em Mensagens (assunto "Questão da prova com erro") e, se o e-mail estiver ligado,
 * avisa a escola por e-mail. A equipe confere e, se for o caso, libera a aula na ficha do aluno.
 */
export async function reportarQuestao(_: EstadoReporteQuestao, f: FormData): Promise<EstadoReporteQuestao> {
  const slug = String(f.get("slug") ?? "");
  const aulaId = String(f.get("aulaId") ?? "");
  const x = await aulaLiberada(slug, aulaId);
  if (!x) return { erro: "Não foi possível enviar agora." };
  const { aluno, c, i } = x;
  const perguntas = provaDaAula(c.curso.nome, i, c.aulas[i].titulo);
  const n = Number(f.get("questao"));
  if (!Number.isInteger(n) || n < 1 || n > perguntas.length) return { erro: "Escolha o número da questão." };
  const comentario = String(f.get("comentario") ?? "").trim().slice(0, 1000);
  const marcada = Number(f.get("marcada"));

  // No máximo 5 avisos por hora para cada aluno.
  const agora = Date.now();
  const recentes = (reportesRecentes.get(aluno.email) ?? []).filter((t) => agora - t < 3_600_000);
  if (recentes.length >= 5) return { erro: "Você já enviou vários avisos agora há pouco. Obrigado! A equipe vai conferir." };
  reportesRecentes.set(aluno.email, [...recentes, agora]);

  const p = perguntas[n - 1];
  const letra = (k: number) => "ABCDEF"[k] ?? "?";
  const marcadaTxt = Number.isInteger(marcada) && p.alternativas[marcada] ? `${letra(marcada)}) ${p.alternativas[marcada]}` : null;
  const linhas = [
    `Questão ${n} da prova: ${p.pergunta}`,
    marcadaTxt ? `O aluno marcou: ${marcadaTxt}` : "",
    comentario ? `Comentário do aluno: ${comentario}` : "",
  ].filter(Boolean);
  const mensagem = linhas.join("\n");
  const registro = await obterAluno(aluno.email).catch(() => null);
  const aulaTitulo = `${i + 1}. ${c.aulas[i].titulo}`;
  try {
    await registrarMensagem({
      origem: "aluno", tipo: "prova", mensagem, nome: registro?.nome ?? null, email: aluno.email, telefone: null, logado: true,
      pagina: `/minha-conta/cursos/${slug}/aulas/${aulaId}`, cursoNome: c.curso.nome, aulaTitulo, navegador: null, print: null, ipHash: null,
    });
  } catch (e) {
    console.error("[reportar questão]", e instanceof Error ? e.message : e);
    return { erro: "Não conseguimos enviar agora. Tente de novo em alguns minutos." };
  }
  if (emailConfigurado) {
    const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "";
    const loja = await obterConfigLoja().catch(() => null);
    const para = loja?.emailContato?.trim() || "contato@tecpromultiensino.com.br";
    const ficha = `${site}/admin/alunos/ficha?email=${encodeURIComponent(aluno.email)}#cursos`;
    const html = `<div style="font-family:Arial,sans-serif;color:#011749;font-size:14px;line-height:1.5">
<p style="font-size:16px;font-weight:bold">Aluno avisou: questão da prova com erro</p>
<p><strong>Aluno:</strong> ${escHtml(registro?.nome ?? aluno.email)} &lt;${escHtml(aluno.email)}&gt;<br><strong>Curso:</strong> ${escHtml(c.curso.nome)}<br><strong>Aula:</strong> ${escHtml(aulaTitulo)}</p>
<p style="white-space:pre-line;background:#f4f7fe;border-radius:12px;padding:12px">${escHtml(mensagem)}</p>
<p><a href="${escHtml(ficha)}" style="color:#011749;font-weight:bold">Abrir a ficha do aluno (para liberar a aula, se for o caso)</a></p></div>`;
    await enviarEmail({
      para, assunto: `[Prova] Questão com erro · ${c.curso.nome}`, html,
      texto: [`Aluno avisou: questão da prova com erro`, `Aluno: ${aluno.email}`, `Curso: ${c.curso.nome}`, `Aula: ${aulaTitulo}`, "", mensagem, "", ficha].join("\n"),
      tipo: "equipe",
    }).catch((e) => console.error("[reportar questão] e-mail", e instanceof Error ? e.message : e));
  }
  return { ok: true };
}
