import "server-only";
import { matricularAluno } from "../escola-avancada/client";
import type { Comprador } from "./tipos";

/**
 * Depois do pagamento confirmado: cria o aluno na Escola Avançada, libera o curso e envia o e-mail de acesso.
 *
 * Evita liberar duas vezes a mesma cobrança (o Asaas pode repetir o aviso).
 * LIMITAÇÃO ATUAL: essa lista fica na memória do servidor. Na etapa 3 (banco de dados)
 * ela passa a ser gravada, junto com o registro da matrícula.
 */

const g = globalThis as unknown as { __cobrancasLiberadas?: Set<string> };
const liberadas = (g.__cobrancasLiberadas ??= new Set());

export async function liberarAcesso(cobrancaId: string, comprador: Comprador, cursoId: string): Promise<void> {
  if (liberadas.has(cobrancaId)) return;
  liberadas.add(cobrancaId);
  try {
    await matricularAluno(comprador, cursoId);
    console.info(`[liberacao] cobrança ${cobrancaId}: curso ${cursoId} liberado para ${comprador.email}`);
  } catch (e) {
    liberadas.delete(cobrancaId); // deixa tentar de novo no próximo aviso
    console.error(`[liberacao] falhou para a cobrança ${cobrancaId}`, e);
    throw e;
  }
}
