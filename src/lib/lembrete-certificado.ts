import "server-only";
import { bancoEmDemonstracao, db, EMAIL_DEMO, obterAluno, registrarEventoMatricula, type Certificado } from "./dados";
import { getCursos } from "./cursos";
import {
  cancelarEmailAgendado, emailCertificadoEmitido, emailCertificadoLiberado, emailConfigurado, emailParabensCertificado, enviarEmail,
} from "./email";
import { linkPdfCertificado, linkValidarCertificado, nomeArquivoCertificado, pdfDoCertificado } from "./certificado-arquivo";
import { linkDescadastro, obterConfigLembretes } from "./lembretes";
import { linkEmitirCertificado } from "./whatsapp-certificado";

/**
 * E-mails do certificado:
 *  - "comprar": concluiu um curso de certificado pago, viu a tela do certificado e não comprou.
 *     Sai X horas depois (padrão 1). Se comprar antes, o e-mail é cancelado.
 *  - "emitir":  pagou o certificado e ainda não clicou em emitir. Sai X horas depois; cancelado ao emitir.
 *  - "entrega": certificado emitido, vai em PDF anexo (na hora).
 * O atraso usa o agendamento do próprio Resend (o e-mail fica guardado lá e sai no horário),
 * então não depende do envio diário das 10h. Cada tipo sai no máximo 1 vez por aluno e curso.
 * Tabela: supabase/migrations/0012_lembretes_certificado.sql.
 */

export type TipoEmailCertificado = "comprar" | "emitir" | "entrega";
export const NOME_EMAIL_CERTIFICADO: Record<TipoEmailCertificado, string> = {
  comprar: "Parabéns (não comprou)", emitir: "Pagou e não emitiu", entrega: "Certificado em PDF",
};

export interface RegistroEmailCertificado {
  id: number;
  tipo: TipoEmailCertificado;
  email: string;
  nome: string | null;
  cursoId: string;
  cursoNome: string | null;
  resendId: string | null;
  agendadoPara: string | null;
  status: "reservado" | "agendado" | "cancelado" | "enviado" | "erro";
  detalhe: string | null;
  criadoEm: string;
}

const norm = (e: string) => e.trim().toLowerCase();
const HORA = 3_600_000;

const gMem = globalThis as unknown as { __emailsCertDemo?: { lista: RegistroEmailCertificado[]; seq: number } };
const mem = () => (gMem.__emailsCertDemo ??= { lista: [], seq: 1 });

const daLinha = (r: Record<string, unknown>): RegistroEmailCertificado => ({
  id: Number(r.id), tipo: r.tipo as TipoEmailCertificado, email: String(r.email), nome: (r.nome as string) ?? null,
  cursoId: String(r.curso_id), cursoNome: (r.curso_nome as string) ?? null, resendId: (r.resend_id as string) ?? null,
  agendadoPara: (r.agendado_para as string) ?? null, status: r.status as RegistroEmailCertificado["status"],
  detalhe: (r.detalhe as string) ?? null, criadoEm: String(r.criado_em),
});

/** Agendado cujo horário já passou = já saiu. */
export const situacaoReal = (r: RegistroEmailCertificado): RegistroEmailCertificado["status"] =>
  r.status === "agendado" && r.agendadoPara && new Date(r.agendadoPara).getTime() <= Date.now() ? "enviado" : r.status;

/** Últimos e-mails do certificado (painel). `tabelaFaltando` = o SQL ainda não foi rodado. */
export async function listarEmailsCertificado(limite = 200): Promise<{ lista: RegistroEmailCertificado[]; tabelaFaltando: boolean }> {
  if (bancoEmDemonstracao) return { lista: [...mem().lista].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, limite), tabelaFaltando: false };
  const { data, error } = await db().from("lembretes_certificado").select("*").order("criado_em", { ascending: false }).limit(limite);
  if (error) return { lista: [], tabelaFaltando: true };
  return { lista: (data ?? []).map(daLinha), tabelaFaltando: false };
}

/** Reserva a linha (tipo, aluno, curso). false = já existe (já foi tratado) ou a tabela não existe. */
async function reservar(tipo: TipoEmailCertificado, email: string, cursoId: string, cursoNome: string, nome: string | null): Promise<number | null> {
  if (bancoEmDemonstracao) {
    if (mem().lista.some((r) => r.tipo === tipo && r.email === email && r.cursoId === cursoId)) return null;
    const r: RegistroEmailCertificado = {
      id: mem().seq++, tipo, email, nome, cursoId, cursoNome, resendId: null, agendadoPara: null, status: "reservado", detalhe: null, criadoEm: new Date().toISOString(),
    };
    mem().lista.push(r);
    return r.id;
  }
  const { data, error } = await db().from("lembretes_certificado")
    .insert({ tipo, email, curso_id: cursoId, curso_nome: cursoNome, nome, status: "reservado" }).select("id").maybeSingle();
  if (error) {
    if (error.code !== "23505") console.error("[email certificado] reservar:", error.message);
    return null;
  }
  return data ? Number(data.id) : null;
}

async function atualizar(id: number, campos: Partial<{ status: string; resend_id: string | null; agendado_para: string | null; detalhe: string | null }>) {
  if (bancoEmDemonstracao) {
    const r = mem().lista.find((x) => x.id === id);
    if (r) Object.assign(r, {
      ...(campos.status ? { status: campos.status } : {}),
      ...("resend_id" in campos ? { resendId: campos.resend_id } : {}),
      ...("agendado_para" in campos ? { agendadoPara: campos.agendado_para } : {}),
      ...("detalhe" in campos ? { detalhe: campos.detalhe } : {}),
    });
    return;
  }
  const { error } = await db().from("lembretes_certificado").update({ ...campos, atualizado_em: new Date().toISOString() }).eq("id", id);
  if (error) console.error("[email certificado] atualizar:", error.message);
}

async function descadastrado(email: string): Promise<boolean> {
  if (bancoEmDemonstracao) return false;
  const { data } = await db().from("lembretes_descadastro").select("email").eq("email", email).maybeSingle();
  return Boolean(data);
}

/** Guarda o e-mail no Resend para sair daqui a `horas` horas e registra. Nunca lança erro. */
async function agendar(
  tipo: "comprar" | "emitir", emailAluno: string, cursoId: string,
  montar: (d: { nome: string; curso: string; horas: number; slug: string; email: string }) => { assunto: string; html: string; texto: string; cabecalhos?: Record<string, string> },
) {
  try {
    const cfg = (await obterConfigLembretes()).certificado;
    if (!(tipo === "comprar" ? cfg.ligado : cfg.avisoEmitir) || !emailConfigurado) return;
    const email = norm(emailAluno);
    if (email === EMAIL_DEMO && !bancoEmDemonstracao) return;
    if (tipo === "comprar" && (await descadastrado(email))) return;
    const [cursos, aluno] = await Promise.all([getCursos(), obterAluno(email)]);
    const curso = cursos.find((c) => c.id === cursoId);
    if (!curso) return;
    const id = await reservar(tipo, email, cursoId, curso.nome, aluno?.nome ?? null);
    if (id === null) return;
    const quando = new Date(Date.now() + Math.max(cfg.horas, 0.1) * HORA).toISOString();
    try {
      const e = montar({ nome: aluno?.nome ?? "", curso: curso.nome, horas: curso.cargaHoraria, slug: curso.slug, email });
      const resendId = await enviarEmail({ para: email, ...e, agendarPara: quando });
      await atualizar(id, { status: "agendado", resend_id: resendId, agendado_para: quando });
    } catch (err) {
      await atualizar(id, { status: "erro", detalhe: (err instanceof Error ? err.message : String(err)).slice(0, 500) });
    }
  } catch (err) {
    console.error(`[email certificado] agendar ${tipo}:`, err instanceof Error ? err.message : err);
  }
}

/** Aluno viu a tela do certificado (curso concluído, certificado pago e não comprado). */
export function lembrarDeComprar(email: string, cursoId: string) {
  return agendar("comprar", email, cursoId, (d) => {
    const linkSair = linkDescadastro(d.email);
    return {
      ...emailParabensCertificado({ nome: d.nome, curso: d.curso, horas: d.horas, link: linkEmitirCertificado(d.slug), linkSair }),
      cabecalhos: { "List-Unsubscribe": `<${linkSair}>` },
    };
  });
}

/** Cancela um e-mail agendado que ainda não saiu (comprou, ou emitiu). Nunca lança erro. */
async function cancelar(tipo: "comprar" | "emitir", emailAluno: string, cursoId: string) {
  try {
    const email = norm(emailAluno);
    let linhas: RegistroEmailCertificado[];
    if (bancoEmDemonstracao) linhas = mem().lista.filter((r) => r.tipo === tipo && r.email === email && r.cursoId === cursoId);
    else {
      const { data, error } = await db().from("lembretes_certificado").select("*").eq("tipo", tipo).eq("email", email).eq("curso_id", cursoId);
      if (error) return;
      linhas = (data ?? []).map(daLinha);
    }
    for (const r of linhas) {
      if (situacaoReal(r) !== "agendado") continue;
      try {
        if (r.resendId) await cancelarEmailAgendado(r.resendId);
        await atualizar(r.id, { status: "cancelado" });
      } catch (err) {
        await atualizar(r.id, { detalhe: `Não deu para cancelar: ${(err instanceof Error ? err.message : String(err)).slice(0, 400)}` });
      }
    }
  } catch (err) {
    console.error(`[email certificado] cancelar ${tipo}:`, err instanceof Error ? err.message : err);
  }
}

/** Certificado pago (ou crédito do pacote usado): cancela o "parabéns" e agenda o aviso para emitir. */
export async function certificadoLiberado(email: string, cursoId: string) {
  await cancelar("comprar", email, cursoId);
  await agendar("emitir", email, cursoId, (d) =>
    emailCertificadoLiberado({ nome: d.nome, curso: d.curso, horas: d.horas, link: linkEmitirCertificado(d.slug) }));
}

/** Manda o certificado em PDF por e-mail. `forcar` = reenvio pelo painel (manda mesmo se já foi). */
export async function enviarCertificadoPorEmail(cert: Certificado, forcar = false): Promise<void> {
  const email = norm(cert.email);
  const pdf = await pdfDoCertificado(cert);
  const e = emailCertificadoEmitido({
    nome: cert.nomeAluno, curso: cert.cursoNome, horas: cert.cargaHoraria, codigo: cert.codigo, emitidoEm: cert.emitidoEm,
    linkPdf: linkPdfCertificado(cert.codigo), linkValidar: linkValidarCertificado(cert.codigo),
  });
  const id = await reservar("entrega", email, cert.cursoId, cert.cursoNome, cert.nomeAluno);
  if (id === null && !forcar) return;
  try {
    const resendId = await enviarEmail({ para: email, ...e, anexos: [{ nome: nomeArquivoCertificado(cert), conteudo: pdf }] });
    if (id !== null) await atualizar(id, { status: "enviado", resend_id: resendId, agendado_para: new Date().toISOString() });
    await registrarEventoMatricula("e-mail do certificado", true, `Certificado ${cert.codigo} enviado para ${email}${forcar ? " (reenvio pelo painel)" : ""}`);
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    if (id !== null) await atualizar(id, { status: "erro", detalhe: msg });
    await registrarEventoMatricula("e-mail do certificado", false, `${cert.codigo} para ${email}: ${msg}`);
    throw err;
  }
}

/** Certificado acabou de ser emitido: cancela o aviso "emita" e manda o PDF (se ligado). Nunca lança erro. */
export async function certificadoEmitido(cert: Certificado) {
  await cancelar("emitir", cert.email, cert.cursoId);
  try {
    const cfg = (await obterConfigLembretes()).certificado;
    if (!cfg.entrega || !emailConfigurado) return;
    if (norm(cert.email) === EMAIL_DEMO && !bancoEmDemonstracao) return;
    await enviarCertificadoPorEmail(cert);
  } catch (err) {
    console.error("[email certificado] entrega:", err instanceof Error ? err.message : err);
  }
}

/** E-mails de exemplo (prévia e teste do painel). */
export function exemploEmailCertificado(tipo: TipoEmailCertificado, nome: string, emailSair: string) {
  const base = { nome, curso: "Excel Avançado", horas: 40 };
  if (tipo === "comprar") return emailParabensCertificado({ ...base, link: linkEmitirCertificado("excel-avancado"), linkSair: linkDescadastro(emailSair) });
  if (tipo === "emitir") return emailCertificadoLiberado({ ...base, link: linkEmitirCertificado("excel-avancado") });
  return emailCertificadoEmitido({
    ...base, codigo: "TP-AB2C-D3EF", emitidoEm: new Date().toISOString(),
    linkPdf: linkPdfCertificado("TP-AB2C-D3EF"), linkValidar: linkValidarCertificado("TP-AB2C-D3EF"),
  });
}
