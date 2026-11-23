import "server-only";
import { matricularAluno } from "../escola-avancada/client";
import { obterAluno, obterConfigLoja, registrarEventoMatricula, salvarAluno } from "../dados";
import { liberarCertificadoPago } from "../certificados";
import type { Comprador, Produto } from "./tipos";

/**
 * Depois do pagamento confirmado: cria o aluno na Escola Avançada (se ainda não existir),
 * libera o curso e dispara o e-mail de acesso. A Escola Avançada é a fonte oficial das matrículas.
 *
 * Pode ser chamada várias vezes para a mesma cobrança (o Asaas repete avisos): `matricularAluno`
 * confere se o curso já está vinculado antes de vincular. A lista em memória só evita duas
 * chamadas simultâneas no mesmo servidor.
 */

const g = globalThis as unknown as { __liberacoesEmAndamento?: Set<string> };
const emAndamento = (g.__liberacoesEmAndamento ??= new Set());

/** Chamado quando um pagamento é confirmado (webhook do Asaas ou simulador). */
export async function processarPagamento(cobrancaId: string, comprador: Comprador, produto: Produto): Promise<void> {
  if (produto.tipo === "curso") return liberarAcesso(cobrancaId, comprador, produto.cursoId);
  await liberarCertificadoPago(produto.email, produto.cursoId, cobrancaId);
}

export async function liberarAcesso(cobrancaId: string, comprador: Comprador, cursoId: string): Promise<void> {
  if (emAndamento.has(cobrancaId)) return;
  emAndamento.add(cobrancaId);
  console.info(`[liberacao] cobrança ${cobrancaId}: matriculando ${comprador.email} no curso ${cursoId}`);
  try {
    const [existente, loja] = await Promise.all([obterAluno(comprador.email), obterConfigLoja()]);
    const { novoVinculo } = await matricularAluno(
      comprador,
      cursoId,
      existente?.eaUsuarioId,
      loja.mesesDeAcesso,
      (usuarioId) => salvarAluno({ email: comprador.email, eaUsuarioId: usuarioId, nome: comprador.nome }),
    );
    if (novoVinculo) console.info(`[liberacao] cobrança ${cobrancaId}: curso ${cursoId} liberado para ${comprador.email}`);
    await registrarEventoMatricula(
      "matrícula",
      true,
      novoVinculo
        ? `Curso ${cursoId} liberado para ${comprador.email} (cobrança ${cobrancaId})`
        : `Curso ${cursoId} já estava liberado para ${comprador.email} (cobrança ${cobrancaId})`,
    );
  } catch (e) {
    console.error(`[liberacao] falhou para a cobrança ${cobrancaId}`, e);
    await registrarEventoMatricula(
      "matrícula",
      false,
      `Cobrança ${cobrancaId}, ${comprador.email}, curso ${cursoId}: ${e instanceof Error ? e.message : String(e)}`,
    );
    throw e; // o webhook responde erro e o Asaas tenta de novo
  } finally {
    emAndamento.delete(cobrancaId);
  }
}
