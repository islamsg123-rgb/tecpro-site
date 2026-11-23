import "server-only";
import { obterCupom, type Cupom } from "./dados/carrinhos";
import { formatarPreco } from "./formatar";

/** Menor valor que o Asaas aceita numa cobrança. */
export const VALOR_MINIMO_CENTAVOS = 500;

export type ResultadoCupom =
  | { ok: true; cupom: Cupom; valorFinalCentavos: number; descontoCentavos: number; rotulo: string }
  | { ok: false; erro: string };

/** Confere o cupom e calcula o valor com desconto. Sempre no servidor. */
export async function aplicarCupom(
  codigo: string,
  item: { tipo: "curso" | "certificado"; cursoId: string; valorCentavos: number },
): Promise<ResultadoCupom> {
  const cupom = await obterCupom(codigo);
  const invalido = { ok: false as const, erro: "Cupom inválido ou expirado." };
  if (!cupom || !cupom.ativo) return invalido;
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  if (cupom.validade && cupom.validade < hoje) return invalido;
  if (cupom.limiteUsos !== null && cupom.usos >= cupom.limiteUsos) return { ok: false, erro: "Este cupom já atingiu o limite de usos." };
  if (cupom.aplicaEm === "cursos" && item.tipo !== "curso") return { ok: false, erro: "Este cupom vale só para matrícula em cursos." };
  if (cupom.aplicaEm === "certificados" && item.tipo !== "certificado") return { ok: false, erro: "Este cupom vale só para certificados." };
  if (cupom.cursoId && cupom.cursoId !== item.cursoId) return { ok: false, erro: "Este cupom não vale para este curso." };

  const desconto = cupom.tipo === "percentual"
    ? Math.round((item.valorCentavos * Math.min(cupom.valor, 100)) / 100)
    : cupom.valor;
  const final = Math.max(VALOR_MINIMO_CENTAVOS, item.valorCentavos - desconto);
  return {
    ok: true,
    cupom,
    valorFinalCentavos: final,
    descontoCentavos: item.valorCentavos - final,
    rotulo: cupom.tipo === "percentual" ? `${cupom.valor}% de desconto` : `${formatarPreco(cupom.valor)} de desconto`,
  };
}
