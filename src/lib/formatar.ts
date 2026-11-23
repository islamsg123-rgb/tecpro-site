export function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Preço como aparece na vitrine: "Grátis" para curso gratuito. */
export function precoDoCurso(c: { gratuito: boolean; precoCentavos: number }): string {
  return c.gratuito ? "Grátis" : formatarPreco(c.precoCentavos);
}
