import "server-only";
import { configuracoesDosCursos } from "./dados";

/**
 * Regra do certificado de cada curso. É definida no painel de administração (/admin/cursos).
 *  - "gratis": liberado quando o aluno conclui todas as aulas.
 *  - "pago":   o aluno conclui as aulas e paga o valor para emitir.
 * Curso sem configuração usa o PADRÃO abaixo.
 */

export type RegraCertificado = { modo: "gratis" } | { modo: "pago"; precoCentavos: number };

export const regraPadrao: RegraCertificado = { modo: "gratis" };

export async function regraDoCertificado(cursoId: string): Promise<RegraCertificado> {
  const cfg = (await configuracoesDosCursos()).get(cursoId);
  if (cfg?.certificadoModo === "pago" && cfg.certificadoPrecoCentavos) {
    return { modo: "pago", precoCentavos: cfg.certificadoPrecoCentavos };
  }
  if (cfg?.certificadoModo === "gratis") return { modo: "gratis" };
  return regraPadrao;
}
