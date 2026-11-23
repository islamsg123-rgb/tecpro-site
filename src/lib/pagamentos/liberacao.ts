import "server-only";
import { matricularAluno } from "../escola-avancada/client";
import { obterAluno, salvarAluno } from "../dados";
import type { Comprador } from "./tipos";

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

export async function liberarAcesso(cobrancaId: string, comprador: Comprador, cursoId: string): Promise<void> {
  if (emAndamento.has(cobrancaId)) return;
  emAndamento.add(cobrancaId);
  try {
    const existente = await obterAluno(comprador.email);
    const { usuarioId, novoVinculo } = await matricularAluno(comprador, cursoId, existente?.eaUsuarioId);
    if (!existente) await salvarAluno({ email: comprador.email, eaUsuarioId: usuarioId, nome: comprador.nome });
    if (novoVinculo) console.info(`[liberacao] cobrança ${cobrancaId}: curso ${cursoId} liberado para ${comprador.email}`);
  } catch (e) {
    console.error(`[liberacao] falhou para a cobrança ${cobrancaId}`, e);
    throw e; // o webhook responde erro e o Asaas tenta de novo
  } finally {
    emAndamento.delete(cobrancaId);
  }
}
