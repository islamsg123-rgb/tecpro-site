import "server-only";
import {
  bancoEmDemonstracao, certificadoDoAluno, certificadoFoiPago, db, EMAIL_DEMO, obterAluno, registrarEventoMatricula, type Certificado,
} from "./dados";
import { getCursos } from "./cursos";
import {
  cancelarEmailAgendado, emailCertificadoEmitido, emailConfigurado, emailConviteCertificado, emailParabensCertificado,
  emailUltimoAvisoCertificado, enviarEmail,
} from "./email";
import { linkPdfCertificado, linkValidarCertificado, nomeArquivoCertificado, pdfDoCertificado } from "./certificado-arquivo";
import { linkDescadastro, obterConfigLembretes } from "./lembretes";
import { linkEmitirCertificado } from "./whatsapp-certificado";

/**
 * E-mails do certificado:
 *  - "comprar": concluiu um curso de certificado pago, viu a tela do certificado e não comprou.
 *     Sai X horas depois (padrão 1). Se comprar antes, o e-mail é cancelado.
 *     A data desta linha também marca a conclusão, para contar o 2º e o 3º.
 *  - "comprar2" (convite) e "comprar3" (último aviso): X dias depois da conclusão (padrão 1 e 7),
 *     só se a pessoa ainda não comprou/emitiu. A rodada diária das 10h agenda no Resend os que vencem
 *     nas próximas 24h, para saírem no horário exato. Comprou antes: os que faltam são cancelados.
 *  - "entrega": certificado emitido, vai em PDF anexo (na hora).
 * O atraso usa o agendamento do próprio Resend (o e-mail fica guardado lá e sai no horário),
 * então não depende do envio diário das 10h. Cada tipo sai no máximo 1 vez por aluno e curso.
 * Tabela: supabase/migrations/0012_lembretes_certificado.sql.
 */

export type TipoEmailCertificado = "comprar" | "comprar2" | "comprar3" | "entrega";
export const NOME_EMAIL_CERTIFICADO: Record<TipoEmailCertificado, string> = {
  comprar: "1º Parabéns", comprar2: "2º Convite para emitir", comprar3: "3º Último aviso", entrega: "Certificado em PDF",
};
/** Os 3 e-mails para quem concluiu e não comprou, na ordem. */
export const SEQUENCIA_CERTIFICADO = ["comprar", "comprar2", "comprar3"] as const;
type TipoSequencia = (typeof SEQUENCIA_CERTIFICADO)[number];
const TIPO_HISTORICO = { comprar: "cert_parabens", comprar2: "cert_convite", comprar3: "cert_ultimo" } as const;
const MODELO = { comprar: emailParabensCertificado, comprar2: emailConviteCertificado, comprar3: emailUltimoAvisoCertificado };
/** Linha "comprar" de quem desligou o 1º e-mail: só marca a data da conclusão. */
const SO_MARCA = "1º e-mail desligado no painel: esta linha só marca a conclusão, para contar o 2º e o 3º.";

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
const DIA = 24 * HORA;

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
async function reservar(
  tipo: TipoEmailCertificado, email: string, cursoId: string, cursoNome: string, nome: string | null, faltaSql?: () => void,
): Promise<number | null> {
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
    if (error.code === "23514") faltaSql?.();
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

/** Monta um dos 3 e-mails da sequência (com o link de sair da lista). */
function montarSequencia(tipo: TipoSequencia, d: { nome: string; curso: string; horas: number; slug: string; email: string }) {
  const linkSair = linkDescadastro(d.email);
  return {
    ...MODELO[tipo]({ nome: d.nome, curso: d.curso, horas: d.horas, link: linkEmitirCertificado(d.slug), linkSair }),
    cabecalhos: { "List-Unsubscribe": `<${linkSair}>` },
  };
}

/** Guarda o e-mail no Resend para sair no horário `quando` e registra. Nunca lança erro. */
async function agendarNoResend(id: number, tipo: TipoSequencia, email: string, curso: { nome: string; cargaHoraria: number; slug: string }, nome: string, quando: string) {
  try {
    const e = montarSequencia(tipo, { nome, curso: curso.nome, horas: curso.cargaHoraria, slug: curso.slug, email });
    const resendId = await enviarEmail({ para: email, ...e, agendarPara: quando, tipo: TIPO_HISTORICO[tipo], curso: curso.nome });
    await atualizar(id, { status: "agendado", resend_id: resendId, agendado_para: quando });
    return true;
  } catch (err) {
    await atualizar(id, { status: "erro", detalhe: (err instanceof Error ? err.message : String(err)).slice(0, 500) });
    return false;
  }
}

/** Aluno viu a tela do certificado (curso concluído, certificado pago e não comprado). */
export async function lembrarDeComprar(emailAluno: string, cursoId: string) {
  try {
    const cfg = (await obterConfigLembretes()).certificado;
    if (!(cfg.ligado || cfg.segundo.ligado || cfg.terceiro.ligado) || !emailConfigurado) return;
    const email = norm(emailAluno);
    if (email === EMAIL_DEMO && !bancoEmDemonstracao) return;
    if (await descadastrado(email)) return;
    const [cursos, aluno] = await Promise.all([getCursos(), obterAluno(email)]);
    const curso = cursos.find((c) => c.id === cursoId);
    if (!curso) return;
    const id = await reservar("comprar", email, cursoId, curso.nome, aluno?.nome ?? null);
    if (id === null) return;
    if (!cfg.ligado) {
      await atualizar(id, { status: "cancelado", detalhe: SO_MARCA });
      return;
    }
    const quando = new Date(Date.now() + Math.max(cfg.horas, 0.1) * HORA).toISOString();
    await agendarNoResend(id, "comprar", email, curso, aluno?.nome ?? "", quando);
  } catch (err) {
    console.error("[email certificado] agendar comprar:", err instanceof Error ? err.message : err);
  }
}

export interface RodadaCertificado {
  agendados: number;
  erros: number;
  /** O SQL emails-certificado-3.sql ainda não foi rodado (a tabela não aceita o 2º e o 3º). */
  faltaSql: boolean;
}

/**
 * Rodada diária (junto com os lembretes das 10h): agenda o 2º e o 3º e-mail de quem concluiu
 * e ainda não comprou. Pega os que vencem até daqui a 24h (saem no horário exato pelo Resend).
 * Quem concluiu há muito tempo (vencimento há mais de 30 dias) não recebe: evita mandar e-mails
 * velhos no dia em que o painel liga um e-mail novo.
 */
export async function rodadaEmailsCertificado(): Promise<RodadaCertificado> {
  const r: RodadaCertificado = { agendados: 0, erros: 0, faltaSql: false };
  try {
    const cfg = (await obterConfigLembretes()).certificado;
    const etapas = ([["comprar2", cfg.segundo], ["comprar3", cfg.terceiro]] as const).filter(([, e]) => e.ligado && e.dias > 0);
    if (!etapas.length || !emailConfigurado) return r;
    const agora = Date.now();
    const maisAntigo = new Date(agora - (Math.max(...etapas.map(([, e]) => e.dias)) + 30) * DIA).toISOString();
    let linhas: RegistroEmailCertificado[];
    if (bancoEmDemonstracao) linhas = mem().lista.filter((x) => x.criadoEm >= maisAntigo || x.tipo !== "comprar");
    else {
      const { data, error } = await db().from("lembretes_certificado").select("*")
        .in("tipo", SEQUENCIA_CERTIFICADO as unknown as string[]).gte("criado_em", maisAntigo).limit(5000);
      if (error) return r;
      linhas = (data ?? []).map(daLinha);
    }
    const ja = new Set(linhas.filter((x) => x.tipo !== "comprar").map((x) => `${x.tipo}|${x.email}|${x.cursoId}`));
    const cursos = await getCursos();
    const conferido = new Map<string, boolean>();
    for (const base of linhas.filter((x) => x.tipo === "comprar")) {
      const concluiu = new Date(base.criadoEm).getTime();
      for (const [tipo, etapa] of etapas) {
        const vence = concluiu + etapa.dias * DIA;
        if (vence > agora + DIA || vence < agora - 30 * DIA) continue;
        if (ja.has(`${tipo}|${base.email}|${base.cursoId}`)) continue;
        const curso = cursos.find((c) => c.id === base.cursoId);
        if (!curso) continue;
        // Ainda não comprou nem emitiu? (uma consulta por aluno e curso)
        const chave = `${base.email}|${base.cursoId}`;
        if (!conferido.has(chave)) {
          const [cert, pago, saiu] = await Promise.all([
            certificadoDoAluno(base.email, base.cursoId), certificadoFoiPago(base.email, base.cursoId), descadastrado(base.email),
          ]);
          conferido.set(chave, !cert && !pago && !saiu);
        }
        if (!conferido.get(chave)) continue;
        const id = await reservar(tipo, base.email, base.cursoId, curso.nome, base.nome, () => (r.faltaSql = true));
        if (r.faltaSql) return r;
        if (id === null) continue;
        const quando = new Date(Math.max(vence, agora + 5 * 60_000)).toISOString();
        if (await agendarNoResend(id, tipo, base.email, curso, base.nome ?? "", quando)) r.agendados++;
        else r.erros++;
        await new Promise((ok) => setTimeout(ok, 550)); // o Resend aceita até 2 por segundo
      }
    }
  } catch (err) {
    console.error("[email certificado] rodada:", err instanceof Error ? err.message : err);
    r.erros++;
  }
  return r;
}

/** O banco já aceita o 2º e o 3º e-mail? (false = falta rodar emails-certificado-3.sql) */
export async function sequenciaCertificadoPronta(): Promise<boolean> {
  if (bancoEmDemonstracao) return true;
  const teste = { tipo: "comprar3", email: "__verificacao__", curso_id: "__verificacao__", status: "cancelado" };
  const { error } = await db().from("lembretes_certificado").insert(teste);
  if (error && error.code === "23514") return false;
  await db().from("lembretes_certificado").delete().eq("email", "__verificacao__");
  return true;
}

/** Cancela um e-mail agendado que ainda não saiu (a pessoa comprou). Nunca lança erro. */
async function cancelar(emailAluno: string, cursoId: string) {
  try {
    const email = norm(emailAluno);
    let linhas: RegistroEmailCertificado[];
    if (bancoEmDemonstracao) linhas = mem().lista.filter((r) => r.tipo !== "entrega" && r.email === email && r.cursoId === cursoId);
    else {
      const { data, error } = await db().from("lembretes_certificado").select("*")
        .in("tipo", SEQUENCIA_CERTIFICADO as unknown as string[]).eq("email", email).eq("curso_id", cursoId);
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
    console.error("[email certificado] cancelar:", err instanceof Error ? err.message : err);
  }
}

/** Certificado pago (ou crédito do pacote usado): cancela os e-mails da sequência que ainda não saíram. */
export async function certificadoLiberado(email: string, cursoId: string) {
  await cancelar(email, cursoId);
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
    const resendId = await enviarEmail({ para: email, ...e, tipo: "cert_pdf", curso: cert.cursoNome, anexos: [{ nome: nomeArquivoCertificado(cert), conteudo: pdf }] });
    if (id !== null) await atualizar(id, { status: "enviado", resend_id: resendId, agendado_para: new Date().toISOString() });
    await registrarEventoMatricula("e-mail do certificado", true, `Certificado ${cert.codigo} enviado para ${email}${forcar ? " (reenvio pelo painel)" : ""}`);
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    if (id !== null) await atualizar(id, { status: "erro", detalhe: msg });
    await registrarEventoMatricula("e-mail do certificado", false, `${cert.codigo} para ${email}: ${msg}`);
    throw err;
  }
}

/** Certificado acabou de ser emitido: manda o PDF (se ligado). Nunca lança erro. */
export async function certificadoEmitido(cert: Certificado) {
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
  if (tipo !== "entrega") return MODELO[tipo]({ ...base, link: linkEmitirCertificado("excel-avancado"), linkSair: linkDescadastro(emailSair) });
  return emailCertificadoEmitido({
    ...base, codigo: "TP-AB2C-D3EF", emitidoEm: new Date().toISOString(),
    linkPdf: linkPdfCertificado("TP-AB2C-D3EF"), linkValidar: linkValidarCertificado("TP-AB2C-D3EF"),
  });
}
