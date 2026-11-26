import "server-only";
import { bancoEmDemonstracao, db } from "./index";

/**
 * Histórico de e-mails (ficha do aluno). Uma linha por e-mail mandado pelo Resend.
 * Tabela criada por supabase/migrations/0014_emails_enviados.sql (historico-emails.sql).
 * Se a tabela ainda não existir, nada quebra: o e-mail sai normalmente, só não fica anotado.
 */

export type TipoEmail =
  | "boas_vindas" | "acesso" | "senha" | "lembrete" | "nunca_comecou"
  | "cert_parabens" | "cert_convite" | "cert_ultimo" | "cert_pdf" | "teste" | "equipe" | "outro";

export const NOME_TIPO_EMAIL: Record<string, string> = {
  boas_vindas: "Boas-vindas",
  acesso: "Link / código para entrar",
  senha: "Criar ou trocar a senha",
  lembrete: "Lembrete de estudo",
  nunca_comecou: "Lembrete: ainda não começou",
  cert_parabens: "Parabéns (certificado)",
  cert_convite: "2º e-mail do certificado",
  cert_ultimo: "Último aviso do certificado",
  cert_pdf: "Certificado em PDF",
  teste: "E-mail de teste",
  equipe: "Aviso para a equipe",
  outro: "Outro",
};

export interface EmailEnviado {
  id: number;
  resendId: string | null;
  email: string;
  tipo: string;
  assunto: string | null;
  cursoNome: string | null;
  status: string;
  detalhe: string | null;
  agendadoPara: string | null;
  entregueEm: string | null;
  abertoEm: string | null;
  ultimaAbertura: string | null;
  aberturas: number;
  clicadoEm: string | null;
  cliques: number;
  links: string[];
  criadoEm: string;
}

const norm = (e: string) => e.trim().toLowerCase();

const g = globalThis as unknown as { __emailsDemo?: EmailEnviado[] };
const demo = () => (g.__emailsDemo ??= []);

/** Anota um e-mail que acabou de sair (ou que falhou). Nunca lança erro: o histórico não pode atrapalhar o envio. */
export async function anotarEmail(e: {
  resendId: string | null; para: string; tipo: TipoEmail; assunto: string; curso?: string | null;
  status: "enviado" | "agendado" | "erro"; detalhe?: string | null; agendadoPara?: string | null;
}): Promise<void> {
  const agora = new Date().toISOString();
  try {
    if (bancoEmDemonstracao) {
      demo().unshift({
        id: demo().length + 1, resendId: e.resendId, email: norm(e.para), tipo: e.tipo, assunto: e.assunto, cursoNome: e.curso ?? null,
        status: e.status, detalhe: e.detalhe ?? null, agendadoPara: e.agendadoPara ?? null, entregueEm: null, abertoEm: null,
        ultimaAbertura: null, aberturas: 0, clicadoEm: null, cliques: 0, links: [], criadoEm: agora,
      });
      return;
    }
    const { error } = await db().from("emails_enviados").insert({
      resend_id: e.resendId, email: norm(e.para), tipo: e.tipo, assunto: e.assunto.slice(0, 300), curso_nome: e.curso ?? null,
      status: e.status, detalhe: e.detalhe?.slice(0, 500) ?? null, agendado_para: e.agendadoPara ?? null,
    });
    if (error) console.error("[historico-emails] anotar:", error.message);
  } catch (err) {
    console.error("[historico-emails] anotar:", (err as Error).message);
  }
}

/** Marca como cancelado (e-mail agendado que não vai mais sair). */
export async function marcarEmailCancelado(resendId: string): Promise<void> {
  try {
    if (bancoEmDemonstracao) {
      const x = demo().find((m) => m.resendId === resendId);
      if (x) x.status = "cancelado";
      return;
    }
    await db().from("emails_enviados").update({ status: "cancelado", atualizado_em: new Date().toISOString() }).eq("resend_id", resendId);
  } catch { /* só histórico */ }
}

/* ---------- Avisos do Resend (webhook) ---------- */

export interface EventoResend {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    subject?: string;
    created_at?: string;
    click?: { link?: string; timestamp?: string };
    bounce?: { message?: string; type?: string; subType?: string };
    failed?: { reason?: string };
  };
}

/** Situação "mais importante" vence: um e-mail que voltou não volta a ser "entregue" se os avisos chegarem fora de ordem. */
const PESO: Record<string, number> = { agendado: 0, cancelado: 1, enviado: 2, atrasado: 3, entregue: 4, voltou: 5, falhou: 5, spam: 6, erro: 6 };

/** Adivinha o tipo pelo assunto (e-mails que o site não anotou, como os do login do Supabase). */
function tipoPeloAssunto(assunto: string): TipoEmail {
  const a = assunto.toLowerCase();
  if (/senha/.test(a)) return "senha";
  if (/acesso|entrar|login|código|codigo|confirm/.test(a)) return "acesso";
  if (/bem-vind|boas-vindas/.test(a)) return "boas_vindas";
  return "outro";
}

/**
 * Aplica um aviso do Resend no histórico.
 * `confiavel` = a assinatura do aviso foi conferida. Sem assinatura, só atualizamos e-mails que o próprio
 * site anotou (o id do Resend é impossível de adivinhar), nunca criamos linhas novas.
 * Devolve o que aconteceu, para o webhook responder.
 */
export async function aplicarEventoResend(ev: EventoResend, confiavel: boolean, criou = false): Promise<string> {
  const id = ev.data?.email_id;
  if (!id || !ev.type?.startsWith("email.")) return "ignorado";
  const quando = ev.created_at ?? new Date().toISOString();
  const para = norm(String((Array.isArray(ev.data?.to) ? ev.data?.to[0] : ev.data?.to) ?? ""));

  const atual = bancoEmDemonstracao
    ? demo().find((m) => m.resendId === id) ?? null
    : await db().from("emails_enviados").select("*").eq("resend_id", id).maybeSingle().then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return data ? daLinha(data) : null;
      });

  if (!atual) {
    if (!confiavel || !para || criou) return "desconhecido";
    const assunto = ev.data?.subject ?? "";
    await anotarEmail({ resendId: id, para, tipo: tipoPeloAssunto(assunto), assunto, status: "enviado" });
    return aplicarEventoResend(ev, confiavel, true);
  }

  const m: Partial<EmailEnviado> = {};
  const status = (s: string) => { if ((PESO[s] ?? 0) >= (PESO[atual.status] ?? 0)) m.status = s; };
  switch (ev.type) {
    case "email.scheduled": status("agendado"); break;
    case "email.sent": status("enviado"); break;
    case "email.delivered": status("entregue"); if (!atual.entregueEm) m.entregueEm = quando; break;
    case "email.delivery_delayed": status("atrasado"); break;
    case "email.bounced":
      status("voltou");
      m.detalhe = [ev.data?.bounce?.message, ev.data?.bounce?.subType].filter(Boolean).join(" · ") || "O endereço não aceitou o e-mail.";
      break;
    case "email.failed": case "email.suppressed":
      status("falhou");
      m.detalhe = ev.data?.failed?.reason ?? (ev.type === "email.suppressed" ? "O Resend não mandou: este endereço já voltou ou reclamou antes." : "O Resend não conseguiu mandar.");
      break;
    case "email.complained": status("spam"); m.detalhe = "A pessoa marcou o e-mail como spam."; break;
    case "email.opened":
      m.aberturas = atual.aberturas + 1;
      if (!atual.abertoEm || quando < atual.abertoEm) m.abertoEm = quando;
      if (!atual.ultimaAbertura || quando > atual.ultimaAbertura) m.ultimaAbertura = quando;
      // Abrir prova que chegou, mesmo que o aviso de entrega ainda não tenha vindo.
      if (!atual.entregueEm) { status("entregue"); }
      break;
    case "email.clicked": {
      m.cliques = atual.cliques + 1;
      if (!atual.clicadoEm || quando < atual.clicadoEm) m.clicadoEm = quando;
      const link = ev.data?.click?.link;
      if (link && !atual.links.includes(link)) m.links = [...atual.links, link].slice(-10);
      if (!atual.entregueEm) { status("entregue"); }
      break;
    }
    default: return "ignorado";
  }

  if (bancoEmDemonstracao) { Object.assign(atual, m); return "ok"; }
  const linha: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (m.status) linha.status = m.status;
  if (m.detalhe !== undefined) linha.detalhe = m.detalhe?.slice(0, 500);
  if (m.entregueEm) linha.entregue_em = m.entregueEm;
  if (m.aberturas !== undefined) linha.aberturas = m.aberturas;
  if (m.abertoEm) linha.aberto_em = m.abertoEm;
  if (m.ultimaAbertura) linha.ultima_abertura = m.ultimaAbertura;
  if (m.cliques !== undefined) linha.cliques = m.cliques;
  if (m.clicadoEm) linha.clicado_em = m.clicadoEm;
  if (m.links) linha.links = m.links;
  const { error } = await db().from("emails_enviados").update(linha).eq("id", atual.id);
  if (error) throw new Error(error.message);
  return "ok";
}

/* ---------- Ficha do aluno ---------- */

const daLinha = (r: Record<string, unknown>): EmailEnviado => ({
  id: Number(r.id), resendId: (r.resend_id as string) ?? null, email: String(r.email), tipo: String(r.tipo),
  assunto: (r.assunto as string) ?? null, cursoNome: (r.curso_nome as string) ?? null, status: String(r.status),
  detalhe: (r.detalhe as string) ?? null, agendadoPara: (r.agendado_para as string) ?? null,
  entregueEm: (r.entregue_em as string) ?? null, abertoEm: (r.aberto_em as string) ?? null,
  ultimaAbertura: (r.ultima_abertura as string) ?? null, aberturas: Number(r.aberturas ?? 0),
  clicadoEm: (r.clicado_em as string) ?? null, cliques: Number(r.cliques ?? 0),
  links: Array.isArray(r.links) ? (r.links as string[]) : [], criadoEm: String(r.criado_em),
});

/** E-mails de um aluno, mais novos primeiro. `null` = a tabela ainda não existe (falta rodar o SQL). */
export async function emailsDoAluno(email: string, limite = 100): Promise<EmailEnviado[] | null> {
  const e = norm(email);
  if (bancoEmDemonstracao) return demo().filter((m) => m.email === e).slice(0, limite);
  const { data, error } = await db().from("emails_enviados").select("*").eq("email", e).order("criado_em", { ascending: false }).limit(limite);
  if (error) {
    console.error("[historico-emails]", error.message);
    return null;
  }
  return (data ?? []).map(daLinha);
}

/** Para as prévias (modo demonstração): um histórico de exemplo. */
export function semearEmailsDemo(email: string): void {
  if (!bancoEmDemonstracao || demo().some((m) => m.email === norm(email))) return;
  const h = (horas: number) => new Date(Date.now() - horas * 3600_000).toISOString();
  const base = { email: norm(email), detalhe: null, agendadoPara: null, ultimaAbertura: null, links: [] as string[] };
  const lista: Omit<EmailEnviado, "id">[] = [
    { ...base, resendId: "d6", tipo: "cert_pdf", assunto: "Seu certificado de Excel Básico chegou 🎓", cursoNome: "Excel Básico", status: "entregue", entregueEm: h(2), abertoEm: h(1.8), ultimaAbertura: h(0.5), aberturas: 3, clicadoEm: h(1.7), cliques: 1, links: ["https://www.tecpromultiensino.com.br/certificados/TEC-8K2P/pdf"], criadoEm: h(2) },
    { ...base, resendId: "d5", tipo: "cert_parabens", assunto: "Maria, parabéns! Seu certificado de Excel Básico está quase pronto", cursoNome: "Excel Básico", status: "entregue", entregueEm: h(26), abertoEm: h(25), aberturas: 1, clicadoEm: h(25), cliques: 2, links: ["https://www.tecpromultiensino.com.br/minha-conta/cursos/excel-basico/certificado"], criadoEm: h(26) },
    { ...base, resendId: "d4", tipo: "lembrete", assunto: "Maria, seu curso de Word Essencial está te esperando", cursoNome: "Word Essencial", status: "entregue", entregueEm: h(74), abertoEm: null, aberturas: 0, clicadoEm: null, cliques: 0, criadoEm: h(74) },
    { ...base, resendId: "d3", tipo: "acesso", assunto: "Seu link de acesso à Tecpro Multi Ensino", cursoNome: null, status: "entregue", entregueEm: h(170), abertoEm: h(169.9), aberturas: 1, clicadoEm: h(169.9), cliques: 1, links: ["https://www.tecpromultiensino.com.br/auth/confirmar"], criadoEm: h(170) },
    { ...base, resendId: "d2", tipo: "boas_vindas", assunto: "Seu acesso ao curso Excel Básico está liberado", cursoNome: "Excel Básico", status: "entregue", entregueEm: h(171), abertoEm: h(170.5), aberturas: 2, clicadoEm: null, cliques: 0, criadoEm: h(171) },
    { ...base, resendId: "d1", tipo: "boas_vindas", assunto: "Seu acesso ao curso Word Essencial está liberado", cursoNome: "Word Essencial", status: "voltou", detalhe: "Caixa de entrada cheia (MailboxFull)", entregueEm: null, abertoEm: null, aberturas: 0, clicadoEm: null, cliques: 0, criadoEm: h(400) },
  ];
  lista.forEach((m, i) => demo().push({ ...m, id: 1000 + i }));
}
