import { eAdmin } from "@/lib/admin";
import { paraCsv, tabelaParaExportar } from "@/lib/admin-relatorios";

export const dynamic = "force-dynamic";

/** Baixa alunos, vendas ou certificados em planilha (CSV que abre no Excel). */
export async function GET(_req: Request, { params }: { params: Promise<{ tipo: string }> }) {
  if (!(await eAdmin())) return new Response("Não encontrado", { status: 404 });
  const { tipo } = await params;
  const linhas = await tabelaParaExportar(tipo);
  if (!linhas) return new Response("Não encontrado", { status: 404 });
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  return new Response(paraCsv(linhas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tecpro-${tipo}-${hoje}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
