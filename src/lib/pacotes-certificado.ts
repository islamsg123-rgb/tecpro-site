import "server-only";
import { obterConfigLoja, type ConfigLoja } from "./dados";

/**
 * Opções de emissão de certificado nos CURSOS GRATUITOS.
 * Preços editáveis no painel (Loja virtual > Configurações da loja).
 * Os pacotes dão direito a mais certificados: 1 é usado no curso concluído e o resto fica como crédito
 * para os próximos cursos gratuitos que o aluno concluir.
 */

export type IdPacote = "individual" | "essencial" | "profissional";

export interface PacoteCertificado {
  id: IdPacote;
  nome: string;
  quantidade: number;
  precoCentavos: number;
  /** Preço "de" (quantidade x preço do individual) */
  precoCheioCentavos: number;
  porCertificadoCentavos: number;
  economiaCentavos: number;
  descontoPct: number;
  destaque: string | null;
}

export const ID_PACOTES: IdPacote[] = ["individual", "essencial", "profissional"];

export function montarPacotes(loja: Pick<ConfigLoja, "precoCertIndividual" | "precoCertEssencial" | "precoCertProfissional">): PacoteCertificado[] {
  const base = [
    { id: "individual" as const, nome: "Certificado Individual", quantidade: 1, precoCentavos: loja.precoCertIndividual, destaque: null },
    { id: "essencial" as const, nome: "Pacote Essencial", quantidade: 3, precoCentavos: loja.precoCertEssencial, destaque: null },
    { id: "profissional" as const, nome: "Pacote Profissional", quantidade: 5, precoCentavos: loja.precoCertProfissional, destaque: "Melhor custo-benefício" },
  ];
  return base.map((p) => {
    const cheio = p.quantidade * loja.precoCertIndividual;
    const economia = Math.max(0, cheio - p.precoCentavos);
    return {
      ...p,
      precoCheioCentavos: cheio,
      porCertificadoCentavos: Math.round(p.precoCentavos / p.quantidade),
      economiaCentavos: economia,
      descontoPct: cheio ? Math.round((economia / cheio) * 100) : 0,
    };
  });
}

export async function pacotesCertificado(): Promise<PacoteCertificado[]> {
  return montarPacotes(await obterConfigLoja());
}

export async function pacotePorId(id: string): Promise<PacoteCertificado | null> {
  return (await pacotesCertificado()).find((p) => p.id === id) ?? null;
}
