import "server-only";
import type { Certificado } from "./dados";
import { dadosExtrasAluno } from "./dados/painel";
import { gerarPdfCertificado } from "./certificado-pdf";
import { slugify } from "./escola-avancada/adapter";
import { SITE_OFICIAL } from "./site";

/** Link permanente do PDF e da página de validação (sempre no endereço oficial). */
export const linkPdfCertificado = (codigo: string) => `${SITE_OFICIAL}/certificados/${codigo}/pdf`;
export const linkValidarCertificado = (codigo: string) => `${SITE_OFICIAL}/validar/${codigo}`;
export const nomeArquivoCertificado = (cert: Certificado) => `certificado-${slugify(cert.cursoNome)}.pdf`;

/** PDF do certificado. CPF vem do cadastro; se não tiver, o certificado sai sem ele. */
export async function pdfDoCertificado(cert: Certificado): Promise<Uint8Array> {
  const cpf = await dadosExtrasAluno(cert.email).then((d) => d.cpf).catch(() => null);
  return gerarPdfCertificado({ ...cert, cpf }, linkValidarCertificado(cert.codigo));
}
