import { eAdmin } from "@/lib/admin";
import { gerarPdfCertificado } from "@/lib/certificado-pdf";
import { linkValidarCertificado } from "@/lib/certificado-arquivo";
import { getCursos } from "@/lib/cursos";

export const dynamic = "force-dynamic";

/** Prévia do modelo atual do certificado, com nome de exemplo (só para quem tem acesso à Loja virtual do painel). */
export async function GET(req: Request) {
  if (!(await eAdmin("loja"))) return new Response("Sem permissão", { status: 403 });
  const url = new URL(req.url);
  const cursos = await getCursos().catch(() => []);
  const curso = cursos.find((c) => c.id === url.searchParams.get("curso")) ?? cursos[0];
  const nome = (url.searchParams.get("nome") ?? "").trim().slice(0, 80) || "Maria Aparecida da Silva";
  const pdf = await gerarPdfCertificado(
    {
      codigo: "EXEMPLO",
      email: "exemplo@tecpromultiensino.com.br",
      cursoId: curso?.id ?? "exemplo",
      nomeAluno: nome,
      cursoNome: curso?.nome ?? "Nome do curso de exemplo",
      cargaHoraria: curso?.cargaHoraria ?? 40,
      emitidoEm: new Date().toISOString(),
      cpf: "12345678909",
    },
    linkValidarCertificado("EXEMPLO"),
    { previa: true },
  );
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="previa-certificado.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
