import { certificadoPorCodigo } from "@/lib/dados";
import { nomeArquivoCertificado, pdfDoCertificado } from "@/lib/certificado-arquivo";

/** PDF do certificado. O código é longo e aleatório; os mesmos dados já aparecem na página pública de validação. */
export async function GET(_req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const cert = await certificadoPorCodigo(codigo);
  if (!cert) return new Response("Certificado não encontrado", { status: 404 });
  // O link impresso no certificado é sempre o endereço oficial (nunca localhost ou endereço de teste).
  const pdf = await pdfDoCertificado(cert);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nomeArquivoCertificado(cert)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
