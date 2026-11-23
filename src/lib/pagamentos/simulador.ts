import "server-only";
import QRCode from "qrcode";
import { randomUUID } from "node:crypto";
import type { Cobranca, Comprador, DadosBoleto, DadosPix, NovaCobranca } from "./tipos";
import { ErroPagamento } from "./tipos";
import { configLoja } from "../config-loja";
import { hojeMais } from "./asaas";

/**
 * SIMULADOR DE PAGAMENTO, usado enquanto ASAAS_API_KEY não está configurada.
 * Nada é cobrado. Guarda as cobranças só na memória do servidor.
 *  - Pix: é considerado pago 20 segundos depois de gerado (para ver a tela mudar sozinha).
 *  - Cartão: aprovado na hora, exceto o número 4000 0000 0000 0002, que é recusado.
 *  - Boleto: fica aguardando.
 */

interface Registro {
  cobranca: Cobranca;
  comprador: Comprador;
  criadoEm: number;
}

const g = globalThis as unknown as { __cobrancasSimuladas?: Map<string, Registro> };
const banco = (g.__cobrancasSimuladas ??= new Map());

export async function criarCobrancaSimulada(n: NovaCobranca): Promise<{ cobranca: Cobranca; comprador: Comprador }> {
  if (n.forma === "CREDIT_CARD" && n.cartao?.numero.endsWith("0002")) {
    throw new ErroPagamento("Transação não autorizada pelo banco emissor. (simulação)");
  }
  const cobranca: Cobranca = {
    descricao: n.descricao,
    id: `sim_${randomUUID().slice(0, 12)}`,
    forma: n.forma,
    situacao: n.forma === "CREDIT_CARD" ? "pago" : "aguardando",
    valorCentavos: n.valorCentavos,
    produto: n.produto,
    vencimento: hojeMais(n.forma === "BOLETO" ? configLoja.diasVencimentoBoleto : 1),
  };
  banco.set(cobranca.id, { cobranca, comprador: n.comprador, criadoEm: Date.now() });
  return { cobranca, comprador: n.comprador };
}

/** Devolve a cobrança e avisa se ela acabou de virar "paga" nesta consulta. */
export function consultarCobrancaSimulada(id: string): { cobranca: Cobranca; comprador: Comprador; acabouDePagar: boolean } | null {
  const r = banco.get(id);
  if (!r) return null;
  let acabouDePagar = false;
  if (r.cobranca.forma === "PIX" && r.cobranca.situacao === "aguardando" && Date.now() - r.criadoEm > 20_000) {
    r.cobranca = { ...r.cobranca, situacao: "pago" };
    acabouDePagar = true;
  }
  return { cobranca: r.cobranca, comprador: r.comprador, acabouDePagar };
}

export function listarCobrancasSimuladas(): Cobranca[] {
  return Array.from(banco.values())
    .sort((a, b) => b.criadoEm - a.criadoEm)
    .map((r) => ({ ...r.cobranca, cliente: r.comprador.nome, criadoEm: new Date(r.criadoEm).toISOString() }));
}

export async function pixSimulado(id: string): Promise<DadosPix> {
  const copiaECola = `00020126580014BR.GOV.BCB.PIX0136SIMULACAO-TECPRO-${id}5204000053039865802BR5913TECPRO TESTE6009SAO PAULO6304ABCD`;
  const dataUrl = await QRCode.toDataURL(copiaECola, { margin: 1, width: 320, color: { dark: "#011749" } });
  return { imagemBase64: dataUrl.split(",")[1], copiaECola };
}

export function boletoSimulado(): DadosBoleto {
  return { linhaDigitavel: "00190.00009 01234.567890 12345.678901 1 99990000019700", linkPdf: "#" };
}
