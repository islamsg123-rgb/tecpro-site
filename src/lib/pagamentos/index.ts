import "server-only";
import type { Cobranca, Comprador, DadosBoleto, DadosPix, NovaCobranca } from "./tipos";
import {
  asaasConfigurado, boletoAsaas, clientePorEmailAsaas, cobrancasDoEmailAsaas, consultarCobrancaAsaas, criarCobrancaAsaas,
  compradorDoClienteAsaas, listarCobrancasAsaas, pixAsaas, saldoAsaas,
} from "./asaas";
import { certificadoFoiPago } from "../dados";
import {
  boletoSimulado, consultarCobrancaSimulada, criarCobrancaSimulada, listarCobrancasSimuladas, pixSimulado,
} from "./simulador";
import { processarPagamento } from "./liberacao";

/**
 * Porta de entrada dos pagamentos. As páginas só usam estas funções;
 * elas decidem sozinhas entre o Asaas de verdade e o simulador.
 */

export const pagamentoEmSimulacao = !asaasConfigurado;

export async function criarCobranca(n: NovaCobranca): Promise<Cobranca> {
  if (pagamentoEmSimulacao) {
    const { cobranca, comprador } = await criarCobrancaSimulada(n);
    if (cobranca.situacao === "pago") await processarPagamento(cobranca.id, comprador, n.produto);
    return cobranca;
  }
  // No Asaas real, a liberação acontece quando o aviso (webhook) de pagamento chega.
  return criarCobrancaAsaas(n);
}

export async function consultarCobranca(id: string): Promise<Cobranca | null> {
  if (pagamentoEmSimulacao) {
    const r = consultarCobrancaSimulada(id);
    if (!r) return null;
    if (r.acabouDePagar && r.cobranca.produto) await processarPagamento(id, r.comprador, r.cobranca.produto);
    return r.cobranca;
  }
  const cobranca = await consultarCobrancaAsaas(id);
  if (cobranca?.situacao === "pago") await garantirLiberacao(cobranca);
  return cobranca;
}

/**
 * Rede de segurança caso o aviso automático do Asaas (webhook) atrase ou falhe:
 * quando a tela do pedido vê a cobrança paga, libera o curso/certificado se ainda não foi liberado.
 * Tudo é idempotente (a matrícula confere o vínculo na Escola Avançada e o certificado pago só é
 * gravado uma vez), e a lista em memória evita repetir o trabalho a cada visita.
 */
const gLib = globalThis as unknown as { __cobrancasLiberadas?: Set<string> };
const jaLiberadas = (gLib.__cobrancasLiberadas ??= new Set());

async function garantirLiberacao(c: Cobranca): Promise<void> {
  if (!c.produto || !c.clienteId || jaLiberadas.has(c.id)) return;
  try {
    // Certificado: se o curso já consta como pago, o webhook já fez o trabalho (não recria créditos já usados).
    if (c.produto.tipo === "certificado" && (await certificadoFoiPago(c.produto.email, c.produto.cursoId))) {
      jaLiberadas.add(c.id);
      return;
    }
    await processarPagamento(c.id, await compradorDoClienteAsaas(c.clienteId), c.produto);
    jaLiberadas.add(c.id);
  } catch (e) {
    console.error(`[pagamentos] não consegui liberar a cobrança paga ${c.id}`, e);
  }
}

/** Cobranças mais recentes (padrão: 50; o painel financeiro pede mais). */
export async function listarCobrancas(limite = 50): Promise<Cobranca[]> {
  if (!pagamentoEmSimulacao) return listarCobrancasAsaas(limite);
  // Na simulação, consulta as pendentes antes (é isso que "paga" o Pix e libera o curso).
  for (const c of listarCobrancasSimuladas()) if (c.situacao === "aguardando") await consultarCobranca(c.id);
  return listarCobrancasSimuladas().slice(0, limite);
}

/** Pagamentos de um aluno (pelo e-mail). */
export async function cobrancasDoEmail(email: string): Promise<Cobranca[]> {
  const e = email.trim().toLowerCase();
  if (pagamentoEmSimulacao) return listarCobrancasSimuladas().filter((c) => c.clienteEmail === e);
  return cobrancasDoEmailAsaas(e);
}

/** CPF e telefone do aluno, como estão no cadastro de pagamento. */
export async function clientePorEmail(email: string): Promise<Comprador | null> {
  if (pagamentoEmSimulacao) return null;
  return clientePorEmailAsaas(email.trim().toLowerCase()).catch(() => null);
}

/** Saldo disponível para saque (só no Asaas real). */
export async function saldoDisponivel(): Promise<number | null> {
  return pagamentoEmSimulacao ? null : saldoAsaas();
}

export async function dadosPix(id: string): Promise<DadosPix> {
  return pagamentoEmSimulacao ? pixSimulado(id) : pixAsaas(id);
}

export async function dadosBoleto(c: Cobranca): Promise<DadosBoleto> {
  return pagamentoEmSimulacao ? boletoSimulado() : boletoAsaas(c.id, c.linkFatura ?? "");
}
