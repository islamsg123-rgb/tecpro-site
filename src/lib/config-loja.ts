/** Regras de venda da Tecpro. Ajuste aqui. */
export const configLoja = {
  /** Máximo de parcelas no cartão (1 = só à vista). SUPOSIÇÃO: confirmar com a Tecpro. */
  parcelasMaximas: 12,
  /** Valor mínimo de cada parcela, em centavos (o Asaas exige um mínimo por parcela). */
  parcelaMinimaCentavos: 500,
  /** Dias para vencer o boleto. */
  diasVencimentoBoleto: 3,
};

export function opcoesParcelas(totalCentavos: number): number[] {
  const max = Math.max(1, Math.min(configLoja.parcelasMaximas, Math.floor(totalCentavos / configLoja.parcelaMinimaCentavos)));
  return Array.from({ length: max }, (_, i) => i + 1);
}
