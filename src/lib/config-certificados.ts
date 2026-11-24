import "server-only";
import { cursosGratuitos, obterConfigLoja } from "./dados";

/**
 * Regra do certificado de cada curso:
 *  - curso PAGO:     certificado grátis ao concluir (o aluno já pagou o curso);
 *  - curso GRATUITO: o aluno conclui as aulas e paga a emissão (individual ou pacote de 3 ou 5).
 * Os preços ficam em Loja virtual > Configurações da loja.
 */

export type RegraCertificado = { modo: "gratis" } | { modo: "pago"; precoCentavos: number };

export const regraPadrao: RegraCertificado = { modo: "gratis" };

export async function regraDoCertificado(cursoId: string): Promise<RegraCertificado> {
  if (!(await cursosGratuitos()).has(cursoId)) return regraPadrao;
  return { modo: "pago", precoCentavos: (await obterConfigLoja()).precoCertIndividual };
}
