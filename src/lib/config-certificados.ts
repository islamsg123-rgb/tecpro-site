/**
 * Regras do certificado de cada curso. Ajuste aqui (depois, pelo painel de administração).
 *  - "gratis": liberado quando o aluno conclui todas as aulas.
 *  - "pago":   o aluno conclui as aulas e paga o valor para emitir.
 * EXEMPLO: o curso 104 (Design, dos dados de teste) está como pago para mostrar os dois casos.
 */

export type RegraCertificado = { modo: "gratis" } | { modo: "pago"; precoCentavos: number };

export const configCertificados: { padrao: RegraCertificado; porCurso: Record<string, RegraCertificado> } = {
  padrao: { modo: "gratis" },
  porCurso: {
    "104": { modo: "pago", precoCentavos: 2990 },
  },
};

export function regraDoCertificado(cursoId: string): RegraCertificado {
  return configCertificados.porCurso[cursoId] ?? configCertificados.padrao;
}
