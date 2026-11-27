import "server-only";
import { financasDaVenda, type TaxasPagamento } from "./taxas";
import { getCursos, getModulos } from "./cursos";
import { regraDoCertificado } from "./config-certificados";
import {
  aulasConcluidasPorAlunoCurso, listarCertificados, listarCertificadosPagos, type Certificado,
} from "./dados";
import { listarCarrinhos, type Carrinho } from "./dados/carrinhos";
import { listarPesquisas } from "./dados/painel";
import { alunosComAtividade, diasDesde } from "./admin-relatorios";
import { listarCobrancas } from "./pagamentos";
import type { Cobranca, FormaPagamento } from "./pagamentos/tipos";

/**
 * Números do painel: situação dos alunos, formados, devedores, recebimentos e acontecimentos.
 * Tudo calculado na hora a partir do Asaas (pagamentos), da Escola Avançada (cursos) e do Supabase.
 */

/** Dias sem estudar para o aluno passar de "ativo" para "inativo". */
export const DIAS_PARA_INATIVO = 30;

export type SituacaoAluno = "ativo" | "inativo" | "interessado";

export interface PessoaPainel {
  email: string;
  nome: string | null;
  situacao: SituacaoAluno;
  /** Matriculado em algum curso pelo site */
  matriculado: boolean;
  ultimaAtividade: string | null;
  desde: string | null;
  telefone: string | null;
  /** Curso que a pessoa olhou (para interessados que não se matricularam) */
  cursoInteresse: string | null;
}

const hojeISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Alunos e interessados, cada um com a sua situação. */
export async function pessoasDoPainel(): Promise<PessoaPainel[]> {
  const [alunos, { lista: carrinhos }] = await Promise.all([alunosComAtividade(), listarCarrinhos(2000)]);
  const porEmail = new Map<string, PessoaPainel>();
  const contato = new Map<string, Carrinho>();
  for (const c of carrinhos) if (!contato.has(c.email)) contato.set(c.email, c);

  for (const a of alunos) {
    const dias = diasDesde(a.ultimaAtividade);
    porEmail.set(a.email, {
      email: a.email,
      nome: a.nome,
      matriculado: true,
      situacao: dias === null ? "interessado" : dias >= DIAS_PARA_INATIVO ? "inativo" : "ativo",
      ultimaAtividade: a.ultimaAtividade,
      desde: a.criadoEm,
      telefone: contato.get(a.email)?.telefone ?? null,
      cursoInteresse: null,
    });
  }
  // Quem preencheu o contato no checkout e não chegou a se matricular também é "interessado".
  for (const c of carrinhos) {
    if (porEmail.has(c.email) || c.tipo !== "curso") continue;
    porEmail.set(c.email, {
      email: c.email, nome: c.nome, matriculado: false, situacao: "interessado", ultimaAtividade: null,
      desde: c.criadoEm, telefone: c.telefone, cursoInteresse: c.cursoId,
    });
  }
  return Array.from(porEmail.values()).sort((a, b) => String(b.desde ?? "").localeCompare(String(a.desde ?? "")));
}

export interface Formado {
  email: string;
  cursoId: string;
  cursoNome: string;
  /** Endereço do curso no site (vazio se o curso saiu do catálogo) */
  cursoSlug: string;
  certificado: Certificado | null;
  /** O certificado é pago, ainda não foi pago e não foi emitido */
  faltaPagarCertificado: boolean;
  precoCertificadoCentavos: number | null;
  /** Quando concluiu: data da última aula feita (ou da emissão do certificado) */
  concluidoEm: string | null;
}

/** Quem concluiu todas as aulas de um curso (ou já tem o certificado). */
export async function listarFormados(): Promise<Formado[]> {
  const ultimaAula = new Map<string, string>();
  const [contagem, certificados, pagos, cursos] = await Promise.all([
    aulasConcluidasPorAlunoCurso(ultimaAula), listarCertificados(5000), listarCertificadosPagos(), getCursos(),
  ]);
  const pago = new Set(pagos.map((p) => `${p.email}|${p.cursoId}`));
  const cert = new Map(certificados.map((c) => [`${c.email}|${c.cursoId}`, c]));
  const nomeCurso = (id: string) => cursos.find((c) => c.id === id)?.nome ?? `Curso ${id}`;
  const slugCurso = (id: string) => cursos.find((c) => c.id === id)?.slug ?? "";

  // Total de aulas de cada curso que aparece no progresso.
  const idsCursos = Array.from(new Set(Array.from(contagem.keys()).map((k) => k.split("|")[1])));
  const totais = new Map<string, number>();
  for (let i = 0; i < idsCursos.length; i += 8) {
    await Promise.all(
      idsCursos.slice(i, i + 8).map(async (id) => {
        const mods = await getModulos(id).catch(() => []);
        totais.set(id, mods.reduce((s, m) => s + m.aulas.length, 0));
      }),
    );
  }

  const chaves = new Set<string>(cert.keys());
  for (const [k, n] of contagem) {
    const total = totais.get(k.split("|")[1]) ?? 0;
    if (total > 0 && n >= total) chaves.add(k);
  }
  const regras = new Map<string, Awaited<ReturnType<typeof regraDoCertificado>>>();
  const out: Formado[] = [];
  for (const k of chaves) {
    const [email, cursoId] = k.split("|");
    if (!regras.has(cursoId)) regras.set(cursoId, await regraDoCertificado(cursoId));
    const regra = regras.get(cursoId)!;
    const c = cert.get(k) ?? null;
    out.push({
      email, cursoId, cursoNome: c?.cursoNome ?? nomeCurso(cursoId), cursoSlug: slugCurso(cursoId), certificado: c,
      faltaPagarCertificado: !c && regra.modo === "pago" && !pago.has(k),
      precoCertificadoCentavos: regra.modo === "pago" ? regra.precoCentavos : null,
      concluidoEm: ultimaAula.get(k) ?? c?.emitidoEm ?? null,
    });
  }
  return out.sort((a, b) => String(b.certificado?.emitidoEm ?? "").localeCompare(String(a.certificado?.emitidoEm ?? "")));
}

/** Cobranças em atraso (vencidas e não pagas). */
export function cobrancasEmAtraso(cobrancas: Cobranca[]): Cobranca[] {
  const hoje = hojeISO();
  return cobrancas.filter((c) => c.situacao === "vencido" || (c.situacao === "aguardando" && c.vencimento < hoje));
}

export interface Devedor {
  chave: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cobrancas: Cobranca[];
  totalCentavos: number;
  vencidoDesde: string;
}

/** Agrupa as cobranças em atraso por pessoa. */
export function agruparDevedores(atrasadas: Cobranca[]): Devedor[] {
  const m = new Map<string, Devedor>();
  for (const c of atrasadas) {
    const chave = c.clienteEmail ?? c.clienteId ?? c.cliente ?? c.id;
    const d = m.get(chave) ?? {
      chave, nome: (c.cliente ?? "").split(" · ")[0] || "Cliente sem nome", email: c.clienteEmail ?? null, telefone: c.clienteTelefone ?? null,
      cobrancas: [], totalCentavos: 0, vencidoDesde: c.vencimento,
    };
    d.cobrancas.push(c);
    d.totalCentavos += c.valorCentavos;
    if (c.vencimento < d.vencidoDesde) d.vencidoDesde = c.vencimento;
    m.set(chave, d);
  }
  return Array.from(m.values()).sort((a, b) => b.totalCentavos - a.totalCentavos);
}

/* ---------- Financeiro ---------- */

/** Quantas cobranças o painel lê do Asaas para os relatórios. */
export const LIMITE_FINANCEIRO = 1000;

export const nomeMes = (aaaamm: string) => {
  const [a, m] = aaaamm.split("-").map(Number);
  const mes = new Date(a, m - 1, 15).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${mes}/${String(a).slice(2)}`;
};

/** Mês (AAAA-MM) em que o dinheiro entrou; cai para a data da cobrança se o Asaas não informar. */
export const mesDoPagamento = (c: Cobranca) => String(c.pagoEm ?? c.criadoEm ?? c.vencimento).slice(0, 7);

export interface ResumoFinanceiro {
  recebidoMesCentavos: number;
  recebidoMesAnteriorCentavos: number;
  liquidoMesCentavos: number;
  aReceberCentavos: number;
  emAtrasoCentavos: number;
  estornadoMesCentavos: number;
  porForma: Record<FormaPagamento, { centavos: number; quantidade: number }>;
  /** Últimos 12 meses, do mais antigo para o mais recente */
  mensal: { mes: string; centavos: number; quantidade: number }[];
  matriculasMes: number;
  certificadosMes: number;
  ticketMedioCentavos: number;
}

export function resumoFinanceiro(cobrancas: Cobranca[], mes = hojeISO().slice(0, 7), taxas?: TaxasPagamento): ResumoFinanceiro {
  const [a, m] = mes.split("-").map(Number);
  const anterior = new Date(a, m - 2, 15).toLocaleDateString("sv-SE").slice(0, 7);
  const pagas = cobrancas.filter((c) => c.situacao === "pago");
  const doMes = pagas.filter((c) => mesDoPagamento(c) === mes);
  const soma = (l: Cobranca[]) => l.reduce((s, c) => s + c.valorCentavos, 0);
  const porForma = { PIX: { centavos: 0, quantidade: 0 }, CREDIT_CARD: { centavos: 0, quantidade: 0 }, BOLETO: { centavos: 0, quantidade: 0 } };
  for (const c of doMes) {
    const f = porForma[c.forma] ?? (porForma[c.forma] = { centavos: 0, quantidade: 0 });
    f.centavos += c.valorCentavos;
    f.quantidade += 1;
  }
  const mensal: ResumoFinanceiro["mensal"] = [];
  for (let i = 11; i >= 0; i--) {
    const mm = new Date(a, m - 1 - i, 15).toLocaleDateString("sv-SE").slice(0, 7);
    const l = pagas.filter((c) => mesDoPagamento(c) === mm);
    mensal.push({ mes: mm, centavos: soma(l), quantidade: l.length });
  }
  const atrasadas = cobrancasEmAtraso(cobrancas);
  const hoje = hojeISO();
  return {
    recebidoMesCentavos: soma(doMes),
    recebidoMesAnteriorCentavos: soma(pagas.filter((c) => mesDoPagamento(c) === anterior)),
    liquidoMesCentavos: doMes.reduce((s, c) => s + (taxas ? financasDaVenda(c, taxas).liquidoCentavos : c.valorLiquidoCentavos ?? c.valorCentavos), 0),
    aReceberCentavos: soma(cobrancas.filter((c) => c.situacao === "aguardando" && c.vencimento >= hoje)),
    emAtrasoCentavos: soma(atrasadas),
    estornadoMesCentavos: soma(cobrancas.filter((c) => c.situacao === "estornado" && String(c.criadoEm ?? "").slice(0, 7) === mes)),
    porForma,
    mensal,
    matriculasMes: doMes.filter((c) => c.produto?.tipo === "curso").length,
    certificadosMes: doMes.filter((c) => c.produto?.tipo === "certificado").length,
    ticketMedioCentavos: doMes.length ? Math.round(soma(doMes) / doMes.length) : 0,
  };
}

/* ---------- Últimos acontecimentos ---------- */

export interface Acontecimento {
  quando: string;
  tipo: "pagamento" | "matricula" | "certificado" | "interesse" | "pesquisa" | "atraso";
  titulo: string;
  detalhe: string;
  link?: string;
}

export async function ultimosAcontecimentos(cobrancas: Cobranca[], limite = 15): Promise<Acontecimento[]> {
  const [alunos, certificados, { lista: carrinhos }, { lista: pesquisas }, cursos] = await Promise.all([
    alunosComAtividade(), listarCertificados(30), listarCarrinhos(60), listarPesquisas(20), getCursos(),
  ]);
  const nomeCurso = (id: string | null | undefined) => (id ? cursos.find((c) => c.id === id)?.nome ?? `curso ${id}` : "");
  const ficha = (email: string) => `/admin/alunos/ficha?email=${encodeURIComponent(email)}`;
  const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const forma = { PIX: "Pix", CREDIT_CARD: "cartão", BOLETO: "boleto" } as const;
  const out: Acontecimento[] = [];

  for (const c of cobrancas.slice(0, 60)) {
    const quem = (c.cliente ?? "").split(" · ")[0] || "Cliente";
    if (c.situacao === "pago") {
      out.push({ quando: c.pagoEm ?? c.criadoEm ?? c.vencimento, tipo: "pagamento", titulo: `${brl(c.valorCentavos)} recebido por ${forma[c.forma] ?? c.forma}`, detalhe: `${quem} · ${c.descricao ?? ""}`, link: c.clienteEmail ? ficha(c.clienteEmail) : undefined });
    } else if (c.situacao === "vencido") {
      out.push({ quando: c.vencimento, tipo: "atraso", titulo: `Pagamento venceu: ${brl(c.valorCentavos)}`, detalhe: `${quem} · ${c.descricao ?? ""}`, link: "/admin/financeiro/devedores" });
    }
  }
  for (const a of alunos.slice(0, 30)) {
    if (a.criadoEm) out.push({ quando: a.criadoEm, tipo: "matricula", titulo: "Novo aluno matriculado", detalhe: a.nome ?? a.email, link: ficha(a.email) });
  }
  for (const c of certificados) {
    out.push({ quando: c.emitidoEm, tipo: "certificado", titulo: "Certificado emitido", detalhe: `${c.nomeAluno} · ${c.cursoNome}`, link: ficha(c.email) });
  }
  for (const c of carrinhos) {
    if (c.etapa === "contato" || c.etapa === "pagamento") {
      out.push({ quando: c.criadoEm, tipo: "interesse", titulo: c.tipo === "certificado" ? "Começou a pagar o certificado" : "Novo interessado", detalhe: `${c.nome ?? c.email} · ${nomeCurso(c.cursoId)}`, link: "/admin/carrinhos" });
    }
  }
  for (const p of pesquisas) {
    out.push({ quando: p.criadoEm, tipo: "pesquisa", titulo: `Pesquisa respondida: ${"★".repeat(p.nota)}${"☆".repeat(5 - p.nota)}`, detalhe: `${p.nome ?? p.email}${p.cursoNome ? ` · ${p.cursoNome}` : ""}`, link: "/admin/pesquisa" });
  }
  // Datas sem hora (AAAA-MM-DD) ficam no meio do dia, para ordenar junto com as que têm hora.
  const t = (q: string) => new Date(q.length === 10 ? `${q}T12:00:00-03:00` : q).getTime();
  return out.sort((a, b) => t(b.quando) - t(a.quando)).slice(0, limite);
}

/** Cobranças que o painel usa nos relatórios (até LIMITE_FINANCEIRO, as mais recentes). */
export const cobrancasParaRelatorio = () => listarCobrancas(LIMITE_FINANCEIRO);
