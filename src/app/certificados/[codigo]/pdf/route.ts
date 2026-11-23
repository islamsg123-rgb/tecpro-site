import { certificadoPorCodigo } from "@/lib/dados";
import { gerarPdfCertificado } from "@/lib/certificado-pdf";
import { slugify } from "@/lib/escola-avancada/adapter";

/** PDF do certificado. O código é longo e aleatório; os mesmos dados já aparecem na página pública de validação. */
export async function GET(req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const cert = await certificadoPorCodigo(codigo);
  if (!cert) return new Response("Certificado não encontrado", { status: 404 });
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  const pdf = await gerarPdfCertificado(cert, `${base}/validar/${cert.codigo}`);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="certificado-${slugify(cert.cursoNome)}.pdf"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
