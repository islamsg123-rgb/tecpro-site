import "server-only";
import { randomBytes } from "node:crypto";
import { regraDoCertificado, type RegraCertificado } from "./config-certificados";
import {
  certificadoDoAluno, certificadoFoiPago, gravarCertificado, registrarCertificadoPago, registrarCreditos, type Certificado,
} from "./dados";
import type { CursoDoAluno } from "./area-aluno";

/**
 * Situação do certificado de um curso para um aluno:
 *  - "em_andamento":         ainda faltam aulas;
 *  - "aguardando_pagamento": concluiu, mas o certificado é pago e ainda não foi pago;
 *  - "disponivel":           pode emitir (grátis, ou já pago);
 *  - "emitido":              já emitido (tem código).
 */
export type EstadoCertificado = "em_andamento" | "aguardando_pagamento" | "disponivel" | "emitido";

export interface SituacaoCertificado {
  estado: EstadoCertificado;
  regra: RegraCertificado;
  certificado: Certificado | null;
}

export async function situacaoCertificado(email: string, c: CursoDoAluno): Promise<SituacaoCertificado> {
  const regra = await regraDoCertificado(c.curso.id);
  const certificado = await certificadoDoAluno(email, c.curso.id);
  if (certificado) return { estado: "emitido", regra, certificado };
  if (c.total === 0 || c.feitas < c.total) return { estado: "em_andamento", regra, certificado: null };
  if (regra.modo === "pago" && !(await certificadoFoiPago(email, c.curso.id))) {
    return { estado: "aguardando_pagamento", regra, certificado: null };
  }
  return { estado: "disponivel", regra, certificado: null };
}

/** Código curto e difícil de adivinhar, sem letras que confundem (0/O, 1/I). */
function novoCodigo(): string {
  const alfabeto = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(8);
  let s = "";
  for (const b of bytes) s += alfabeto[b % alfabeto.length];
  return `TP-${s.slice(0, 4)}-${s.slice(4)}`;
}

export function limparNome(nome: string): string {
  return nome.replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Emite o certificado. Confere tudo de novo no servidor (concluído e, se for o caso, pago). */
export async function emitirCertificado(email: string, c: CursoDoAluno, nome: string): Promise<Certificado> {
  const s = await situacaoCertificado(email, c);
  if (s.certificado) return s.certificado;
  if (s.estado !== "disponivel") throw new Error(`certificado não disponível (${s.estado})`);
  return gravarCertificado({
    codigo: novoCodigo(),
    email,
    cursoId: c.curso.id,
    nomeAluno: limparNome(nome),
    cursoNome: c.curso.nome,
    cargaHoraria: c.curso.cargaHoraria,
    emitidoEm: new Date().toISOString(),
  });
}

/** Chamado quando o pagamento de um certificado é confirmado. */
export async function liberarCertificadoPago(email: string, cursoId: string, cobrancaId: string, quantidade = 1): Promise<void> {
  await registrarCertificadoPago(email, cursoId, cobrancaId);
  // Pacote: um certificado vai para este curso e o resto fica como crédito para os próximos.
  if (quantidade > 1) await registrarCreditos(email, cobrancaId, quantidade - 1);
  console.info(`[certificado] cobrança ${cobrancaId}: certificado do curso ${cursoId} liberado para ${email}`);
}
