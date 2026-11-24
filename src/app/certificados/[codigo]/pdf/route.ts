import { certificadoPorCodigo } from "@/lib/dados";
import { dadosExtrasAluno } from "@/lib/dados/painel";
import { gerarPdfCertificado } from "@/lib/certificado-pdf";
import { SITE_OFICIAL } from "@/lib/site";
import { slugify } from "@/lib/escola-avancada/adapter";

/** PDF do certificado. O código é longo e aleatório; os mesmos dados já aparecem na página pública de validação. */
export async function GET(_req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const cert = await certificadoPorCodigo(codigo);
  if (!cert) return new Response("Certificado não encontrado", { status: 404 });
  // O link impresso no certificado é sempre o endereço oficial (nunca localhost ou endereço de teste).
  const base = SITE_OFICIAL;
  // CPF vem do cadastro do aluno; se não tiver (ou a coluna ainda não existir), o certificado sai sem ele.
  const cpf = await dadosExtrasAluno(cert.email).then((d) => d.cpf).catch(() => null);
  const pdf = await gerarPdfCertificado({ ...cert, cpf }, `${base}/validar/${cert.codigo}`);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="certificado-${slugify(cert.cursoNome)}.pdf"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
