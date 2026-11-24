import "server-only";
import type { Cobranca, Comprador, DadosBoleto, DadosPix, Gateway, NovaCobranca, Produto } from "./tipos";
import {
  asaasConfigurado, boletoAsaas, clientePorEmailAsaas, cobrancaParaLiberacao as cobrancaParaLiberacaoAsaas, cobrancasDoEmailAsaas,
  consultarCobrancaAsaas, criarCobrancaAsaas, compradorDoClienteAsaas, listarCobrancasAsaas, pixAsaas, saldoAsaas,
} from "./asaas";
import {
  boletoMp, chavePublicaMp, clientePorEmailMp, cobrancasDoEmailMp, consultarCobrancaMp, criarCobrancaMp, eIdMercadoPago,
  listarCobrancasMp, mpConfigurado, mpEmTeste, pixMp,
} from "./mercadopago";
import { certificadoFoiPago, obterConfigLoja } from "../dados";
import {
  boletoSimulado, consultarCobrancaSimulada, criarCobrancaSimulada, listarCobrancasSimuladas, pixSimulado,
} from "./simulador";
import { processarPagamento } from "./liberacao";

/**
 * Porta de entrada dos pagamentos. As páginas só usam estas funções; elas decidem sozinhas
 * entre o Mercado Pago, o Asaas e o simulador.
 *
 * Novas cobranças vão para o sistema escolhido em Painel > Configurações da loja (padrão: Mercado Pago).
 * Se ele não tiver chave na Vercel, usa o outro. Cobranças antigas continuam sendo consultadas
 * no sistema onde foram criadas (o formato do código diz qual é).
 */

/** Sem nenhuma chave de pagamento na Vercel: tudo é simulado. */
export const pagamentoEmSimulacao = !asaasConfigurado && !mpConfigurado;

export type GatewayAtivo = Gateway | "simulador";

export async function gatewayAtivo(): Promise<GatewayAtivo> {
  if (pagamentoEmSimulacao) return "simulador";
  const escolhido = (await obterConfigLoja()).gateway ?? "mercadopago";
  if (escolhido === "asaas") return asaasConfigurado ? "asaas" : "mercadopago";
  return mpConfigurado ? "mercadopago" : "asaas";
}

/** O que o formulário do checkout precisa saber para mostrar os campos certos. */
export async function infoCheckout(): Promise<{ gateway: GatewayAtivo; chavePublica: string; emTeste: boolean }> {
  const gateway = await gatewayAtivo();
  return { gateway, chavePublica: gateway === "mercadopago" ? chavePublicaMp : "", emTeste: gateway === "mercadopago" && mpEmTeste };
}

/** Situação das chaves, para o painel. */
export const chavesConfiguradas = { mercadopago: mpConfigurado, asaas: asaasConfigurado, mercadopagoEmTeste: mpEmTeste, mercadopagoChavePublica: Boolean(chavePublicaMp) };

function gatewayDoId(id: string): GatewayAtivo {
  if (id.startsWith("sim_")) return "simulador";
  return eIdMercadoPago(id) ? "mercadopago" : "asaas";
}

export async function criarCobranca(n: NovaCobranca): Promise<Cobranca> {
  const gateway = await gatewayAtivo();
  if (gateway === "simulador") {
    const { cobranca, comprador } = await criarCobrancaSimulada(n);
    if (cobranca.situacao === "pago") await processarPagamento(cobranca.id, comprador, n.produto);
    return cobranca;
  }
  if (gateway === "mercadopago") {
    const c = await criarCobrancaMp(n);
    // Cartão aprovado na hora: libera já (o aviso automático pode chegar depois; a liberação não repete).
    if (c.situacao === "pago") await garantirLiberacao(c);
    return c;
  }
  // No Asaas, a liberação acontece quando o aviso (webhook) de pagamento chega.
  return criarCobrancaAsaas(n);
}

export async function consultarCobranca(id: string): Promise<Cobranca | null> {
  const g = gatewayDoId(id);
  if (g === "simulador") {
    const r = consultarCobrancaSimulada(id);
    if (!r) return null;
    if (r.acabouDePagar && r.cobranca.produto) await processarPagamento(id, r.comprador, r.cobranca.produto);
    return r.cobranca;
  }
  if (g === "mercadopago" && !mpConfigurado) return null;
  if (g === "asaas" && !asaasConfigurado) return null;
  const cobranca = g === "mercadopago" ? await consultarCobrancaMp(id) : await consultarCobrancaAsaas(id);
  if (cobranca?.situacao === "pago") await garantirLiberacao(cobranca);
  return cobranca;
}

/**
 * Rede de segurança caso o aviso automático (webhook) atrase ou falhe:
 * quando a tela do pedido vê a cobrança paga, libera o curso/certificado se ainda não foi liberado.
 * Tudo é idempotente (a matrícula confere o vínculo na Escola Avançada e o certificado pago só é
 * gravado uma vez), e a lista em memória evita repetir o trabalho a cada visita.
 */
const gLib = globalThis as unknown as { __cobrancasLiberadas?: Set<string> };
const jaLiberadas = (gLib.__cobrancasLiberadas ??= new Set());

async function garantirLiberacao(c: Cobranca): Promise<void> {
  if (!c.produto || jaLiberadas.has(c.id)) return;
  if (!c.comprador && !c.clienteId) return;
  try {
    // Certificado: se o curso já consta como pago, o aviso já fez o trabalho (não recria créditos já usados).
    if (c.produto.tipo === "certificado" && (await certificadoFoiPago(c.produto.email, c.produto.cursoId))) {
      jaLiberadas.add(c.id);
      return;
    }
    await processarPagamento(c.id, c.comprador ?? (await compradorDoClienteAsaas(c.clienteId!)), c.produto);
    jaLiberadas.add(c.id);
  } catch (e) {
    console.error(`[pagamentos] não consegui liberar a cobrança paga ${c.id}`, e);
  }
}

/** Libera uma cobrança paga que chegou pelo aviso automático do Mercado Pago. Erros sobem (o aviso é repetido). */
export async function liberarCobrancaPaga(c: Cobranca): Promise<void> {
  if (!c.produto || !c.comprador) return;
  if (c.produto.tipo === "certificado" && (await certificadoFoiPago(c.produto.email, c.produto.cursoId))) return;
  await processarPagamento(c.id, c.comprador, c.produto);
  jaLiberadas.add(c.id);
}

/** Dados para refazer a liberação de uma cobrança já paga (botão "Matricular de novo" do painel). */
export async function cobrancaParaLiberacao(id: string): Promise<{ pago: boolean; comprador: Comprador; produto: Produto | null }> {
  if (gatewayDoId(id) === "mercadopago") {
    const c = await consultarCobrancaMp(id);
    if (!c?.comprador) throw new Error(`Cobrança ${id} não encontrada no Mercado Pago`);
    return { pago: c.situacao === "pago", comprador: c.comprador, produto: c.produto };
  }
  return cobrancaParaLiberacaoAsaas(id);
}

const maisRecentesPrimeiro = (a: Cobranca, b: Cobranca) => String(b.criadoEm ?? "").localeCompare(String(a.criadoEm ?? ""));

/** Cobranças mais recentes (padrão: 50; o painel financeiro pede mais), de todos os sistemas ligados. */
export async function listarCobrancas(limite = 50): Promise<Cobranca[]> {
  if (pagamentoEmSimulacao) {
    // Na simulação, consulta as pendentes antes (é isso que "paga" o Pix e libera o curso).
    for (const c of listarCobrancasSimuladas()) if (c.situacao === "aguardando") await consultarCobranca(c.id);
    return listarCobrancasSimuladas().slice(0, limite);
  }
  const listas = await Promise.all([
    mpConfigurado ? listarCobrancasMp(limite) : [],
    asaasConfigurado ? listarCobrancasAsaas(limite) : [],
  ]);
  return listas.flat().sort(maisRecentesPrimeiro).slice(0, limite);
}

/** Pagamentos de um aluno (pelo e-mail). */
export async function cobrancasDoEmail(email: string): Promise<Cobranca[]> {
  const e = email.trim().toLowerCase();
  if (pagamentoEmSimulacao) return listarCobrancasSimuladas().filter((c) => c.clienteEmail === e);
  const listas = await Promise.all([
    mpConfigurado ? cobrancasDoEmailMp(e) : [],
    asaasConfigurado ? cobrancasDoEmailAsaas(e) : [],
  ]);
  return listas.flat().sort(maisRecentesPrimeiro);
}

/** CPF e telefone do aluno, como estão no cadastro de pagamento. */
export async function clientePorEmail(email: string): Promise<Comprador | null> {
  if (pagamentoEmSimulacao) return null;
  const e = email.trim().toLowerCase();
  const mp = mpConfigurado ? await clientePorEmailMp(e).catch(() => null) : null;
  if (mp) return mp;
  return asaasConfigurado ? clientePorEmailAsaas(e).catch(() => null) : null;
}

/** Saldo disponível para saque (só no Asaas; o Mercado Pago não informa o saldo por esta integração). */
export async function saldoDisponivel(): Promise<number | null> {
  return asaasConfigurado && (await gatewayAtivo()) === "asaas" ? saldoAsaas() : null;
}

export async function dadosPix(id: string): Promise<DadosPix> {
  const g = gatewayDoId(id);
  return g === "simulador" ? pixSimulado(id) : g === "mercadopago" ? pixMp(id) : pixAsaas(id);
}

export async function dadosBoleto(c: Cobranca): Promise<DadosBoleto> {
  const g = gatewayDoId(c.id);
  return g === "simulador" ? boletoSimulado() : g === "mercadopago" ? boletoMp(c.id) : boletoAsaas(c.id, c.linkFatura ?? "");
}

/** Nome do sistema de pagamento, para textos do site e do painel. */
export function nomeGateway(g: GatewayAtivo): string {
  return g === "mercadopago" ? "Mercado Pago" : g === "asaas" ? "Asaas" : "simulador";
}
