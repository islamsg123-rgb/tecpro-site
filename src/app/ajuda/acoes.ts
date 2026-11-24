"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { alunoLogado } from "@/lib/auth";
import { emailsDono } from "@/lib/admin";
import { obterAluno } from "@/lib/dados";
import { envioRecentesDoIp, registrarMensagem, TIPOS_AJUDA, type TipoAjuda } from "@/lib/dados/mensagens";
import { getCursoPorSlug, getModulos } from "@/lib/cursos";
import { emailConfigurado, enviarEmail } from "@/lib/email";
import { emailValido } from "@/lib/validacao";

/** Dados de quem está logado, para já preencher o nome e o e-mail na janelinha de ajuda. */
export async function quemEstaLogado(): Promise<{ email: string; nome: string | null } | null> {
  try {
    const u = await alunoLogado();
    if (!u) return null;
    const registro = await obterAluno(u.email).catch(() => null);
    return { email: u.email, nome: registro?.nome ?? null };
  } catch {
    return null;
  }
}

export interface EstadoAjuda {
  ok?: boolean;
  erro?: string;
}

const LIMITE_POR_HORA = 5;
const TAMANHO_MAX_PRINT = 700_000; // ~500 KB de imagem já reduzida

/** Descobre o curso (e a aula) pela página onde a pessoa estava. */
async function cursoDaPagina(caminho: string): Promise<{ curso: string | null; aula: string | null }> {
  const m = caminho.match(/^\/(?:minha-conta\/cursos|cursos|checkout)\/([^/?#]+)(?:\/aulas\/([^/?#]+))?/);
  if (!m) return { curso: null, aula: null };
  try {
    const curso = await getCursoPorSlug(decodeURIComponent(m[1]));
    if (!curso) return { curso: null, aula: null };
    let aula: string | null = null;
    if (m[2]) {
      const id = decodeURIComponent(m[2]);
      aula = (await getModulos(curso.id)).flatMap((x) => x.aulas).find((a) => a.id === id)?.titulo ?? null;
    }
    return { curso: curso.nome, aula };
  } catch {
    return { curso: null, aula: null };
  }
}

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function enviarMensagemAjuda(_: EstadoAjuda, f: FormData): Promise<EstadoAjuda> {
  // Armadilha para robôs: campo escondido que pessoas não preenchem.
  if (String(f.get("site") ?? "").trim()) return { ok: true };
  // Robôs costumam enviar o formulário no mesmo instante em que a página abre.
  const aberto = Number(f.get("aberto") ?? 0);
  if (aberto && Date.now() - aberto < 2500) return { erro: "Calma! Escreva sua mensagem e envie de novo." };

  const tipo = String(f.get("tipo") ?? "") as TipoAjuda;
  if (!(tipo in TIPOS_AJUDA)) return { erro: "Escolha o assunto." };
  const mensagem = String(f.get("mensagem") ?? "").trim().slice(0, 3000);
  if (mensagem.length < 5) return { erro: "Conte um pouco mais sobre o problema." };

  const logado = await alunoLogado().catch(() => null);
  const email = (logado?.email ?? String(f.get("email") ?? "").trim().toLowerCase()).slice(0, 200);
  if (!email || !emailValido(email)) return { erro: "Informe um e-mail válido para podermos responder." };
  const nome = String(f.get("nome") ?? "").trim().slice(0, 120) || null;
  const telefone = String(f.get("telefone") ?? "").replace(/[^\d()+\s-]/g, "").trim().slice(0, 30) || null;

  let caminho = String(f.get("pagina") ?? "/").slice(0, 500);
  if (!caminho.startsWith("/")) caminho = "/";
  const origem = caminho.startsWith("/minha-conta") ? "aluno" : "loja";

  let print: string | null = String(f.get("print") ?? "") || null;
  if (print && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(print) || print.length > TAMANHO_MAX_PRINT)) print = null;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
  const ipHash = ip ? createHash("sha256").update(`tecpro-ajuda|${ip}`).digest("hex").slice(0, 32) : null;
  if (ipHash && (await envioRecentesDoIp(ipHash, new Date(Date.now() - 60 * 60 * 1000))) >= LIMITE_POR_HORA) {
    return { erro: "Você já enviou várias mensagens agora há pouco. Aguarde um pouco ou escreva para contato@tecpromultiensino.com.br." };
  }

  const { curso, aula } = await cursoDaPagina(caminho);
  try {
    await registrarMensagem({
      origem, tipo, mensagem, nome, email, telefone, logado: Boolean(logado),
      pagina: caminho, cursoNome: curso, aulaTitulo: aula,
      navegador: (h.get("user-agent") ?? "").slice(0, 300) || null,
      print, ipHash,
    });
  } catch (e) {
    console.error("[ajuda]", e instanceof Error ? e.message : e);
    return { erro: "Não conseguimos enviar agora. Tente de novo em alguns minutos." };
  }

  // Aviso por e-mail para a equipe (se o envio de e-mails estiver ligado). Falha aqui não atrapalha.
  if (emailConfigurado) {
    const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "";
    const onde = origem === "aluno" ? "Área do aluno" : "Loja virtual";
    const linhas = [
      `Nova mensagem de ajuda (${onde})`,
      `Assunto: ${TIPOS_AJUDA[tipo]}`,
      `De: ${nome ?? "(sem nome)"} <${email}>${telefone ? ` · ${telefone}` : ""}`,
      curso ? `Curso: ${curso}${aula ? ` · ${aula}` : ""}` : "",
      `Página: ${caminho}`,
      "",
      mensagem,
      "",
      `Ver no painel: ${site}/admin/mensagens`,
    ].filter((l, i) => l !== "" || i > 4);
    const html = `<div style="font-family:Arial,sans-serif;color:#011749;font-size:14px;line-height:1.5">
<p style="font-size:16px;font-weight:bold">Nova mensagem de ajuda · ${esc(onde)}</p>
<p><strong>Assunto:</strong> ${esc(TIPOS_AJUDA[tipo])}<br><strong>De:</strong> ${esc(nome ?? "(sem nome)")} &lt;${esc(email)}&gt;${telefone ? ` · ${esc(telefone)}` : ""}${curso ? `<br><strong>Curso:</strong> ${esc(curso)}${aula ? ` · ${esc(aula)}` : ""}` : ""}<br><strong>Página:</strong> ${esc(caminho)}</p>
<p style="white-space:pre-line;background:#f4f7fe;border-radius:12px;padding:12px">${esc(mensagem)}</p>
<p><a href="${esc(site)}/admin/mensagens" style="color:#011749;font-weight:bold">Abrir no painel</a></p></div>`;
    await Promise.all(
      emailsDono().map((para) =>
        enviarEmail({ para, assunto: `[Ajuda] ${TIPOS_AJUDA[tipo]} · ${onde}`, html, texto: linhas.join("\n") }).catch((e) =>
          console.error("[ajuda] aviso por e-mail", e instanceof Error ? e.message : e),
        ),
      ),
    );
  }
  return { ok: true };
}
