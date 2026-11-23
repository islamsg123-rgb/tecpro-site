import "server-only";
import type { Cobranca, DadosBoleto, DadosPix, NovaCobranca } from "./tipos";
import {
  asaasConfigurado, boletoAsaas, consultarCobrancaAsaas, criarCobrancaAsaas, pixAsaas,
} from "./asaas";
import {
  boletoSimulado, consultarCobrancaSimulada, criarCobrancaSimulada, pixSimulado,
} from "./simulador";
import { liberarAcesso } from "./liberacao";

/**
 * Porta de entrada dos pagamentos. As páginas só usam estas funções;
 * elas decidem sozinhas entre o Asaas de verdade e o simulador.
 */

export const pagamentoEmSimulacao = !asaasConfigurado;

export async function criarCobranca(n: NovaCobranca): Promise<Cobranca> {
  if (pagamentoEmSimulacao) {
    const { cobranca, comprador } = await criarCobrancaSimulada(n);
    if (cobranca.situacao === "pago") await liberarAcesso(cobranca.id, comprador, n.cursoId);
    return cobranca;
  }
  // No Asaas real, a liberação acontece quando o aviso (webhook) de pagamento chega.
  return criarCobrancaAsaas(n);
}

export async function consultarCobranca(id: string): Promise<Cobranca | null> {
  if (pagamentoEmSimulacao) {
    const r = consultarCobrancaSimulada(id);
    if (!r) return null;
    if (r.acabouDePagar && r.cobranca.cursoId) await liberarAcesso(id, r.comprador, r.cobranca.cursoId);
    return r.cobranca;
  }
  return consultarCobrancaAsaas(id);
}

export async function dadosPix(id: string): Promise<DadosPix> {
  return pagamentoEmSimulacao ? pixSimulado(id) : pixAsaas(id);
}

export async function dadosBoleto(c: Cobranca): Promise<DadosBoleto> {
  return pagamentoEmSimulacao ? boletoSimulado() : boletoAsaas(c.id, c.linkFatura ?? "");
}
