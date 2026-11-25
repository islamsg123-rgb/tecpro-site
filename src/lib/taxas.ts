import "server-only";
import { bancoEmDemonstracao, db } from "./dados";
import type { Cobranca } from "./pagamentos/tipos";

/**
 * Taxas e prazos do Mercado Pago, para mostrar quanto fica para a Tecpro e quando o dinheiro cai.
 *
 * Quando o Mercado Pago informa a taxa real de uma venda, usamos a real. Quando não informa, fazemos uma
 * ESTIMATIVA com os valores abaixo (editáveis no painel: Financeiro > Taxas e prazos), e a tela avisa "estimado".
 * Os padrões são as taxas públicas do Checkout Transparente; confira as da sua conta no app do Mercado Pago.
 */

export interface TaxasPagamento {
  /** Porcentagem cobrada no Pix (ex.: 0.99 = 0,99%) */
  pixPct: number;
  /** Porcentagem no cartão de crédito (sobre o valor da venda; juros do parcelamento são pagos pelo cliente) */
  cartaoPct: number;
  /** Valor fixo por boleto pago, em centavos */
  boletoCentavos: number;
  /** Dias até o dinheiro ficar disponível para saque */
  diasPix: number;
  diasCartao: number;
  diasBoleto: number;
}

export const TAXAS_PADRAO: TaxasPagamento = { pixPct: 0.99, cartaoPct: 4.98, boletoCentavos: 349, diasPix: 0, diasCartao: 0, diasBoleto: 0 };

const CHAVE = "taxas_pagamento";
const g = globalThis as unknown as { __taxasDemo?: TaxasPagamento };

export async function obterTaxas(): Promise<TaxasPagamento> {
  if (bancoEmDemonstracao) return { ...TAXAS_PADRAO, ...g.__taxasDemo };
  const { data } = await db().from("configuracoes_loja").select("valor").eq("chave", CHAVE).maybeSingle();
  return { ...TAXAS_PADRAO, ...((data?.valor as Partial<TaxasPagamento>) ?? {}) };
}

export async function salvarTaxas(t: TaxasPagamento): Promise<void> {
  if (bancoEmDemonstracao) {
    g.__taxasDemo = t;
    return;
  }
  const { error } = await db().from("configuracoes_loja").upsert({ chave: CHAVE, valor: t, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
  if (error) throw error;
}

export interface Financas {
  taxaCentavos: number;
  liquidoCentavos: number;
  /** Dia (AAAA-MM-DD) em que o dinheiro fica disponível */
  liberaEm: string | null;
  /** true = calculado com as taxas configuradas (o sistema de pagamento não informou) */
  estimado: boolean;
}

const somaDias = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00-03:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
};

/** Taxa, quanto fica para a Tecpro e quando cai, de uma venda paga. */
export function financasDaVenda(c: Cobranca, t: TaxasPagamento): Financas {
  const pago = c.pagoEm?.slice(0, 10) ?? null;
  if (c.valorLiquidoCentavos != null && c.taxaInformada) {
    return { taxaCentavos: c.valorCentavos - c.valorLiquidoCentavos, liquidoCentavos: c.valorLiquidoCentavos, liberaEm: c.liberaEm ?? pago, estimado: false };
  }
  const taxa =
    c.forma === "PIX" ? Math.round((c.valorCentavos * t.pixPct) / 100)
    : c.forma === "BOLETO" ? t.boletoCentavos
    : Math.round((c.valorCentavos * t.cartaoPct) / 100);
  const dias = c.forma === "PIX" ? t.diasPix : c.forma === "BOLETO" ? t.diasBoleto : t.diasCartao;
  return { taxaCentavos: taxa, liquidoCentavos: c.valorCentavos - taxa, liberaEm: c.liberaEm ?? (pago ? somaDias(pago, dias) : null), estimado: true };
}
