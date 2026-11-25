import { NextResponse } from "next/server";
import { eAdmin } from "@/lib/admin";
import { vendasDepoisDe } from "@/lib/dados/avisos-venda";

/**
 * O painel aberto pergunta aqui, a cada poucos segundos, se entrou venda nova (aviso com som).
 * Só para quem vê o Financeiro. `desde` = data/hora da última pergunta; sem ele, só devolve a hora atual.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await eAdmin("financeiro"))) return NextResponse.json({ erro: "sem acesso" }, { status: 403 });
  // A hora é marcada ANTES da consulta: uma venda gravada durante a consulta aparece na próxima.
  const agora = new Date().toISOString();
  const desde = new URL(req.url).searchParams.get("desde");
  if (!desde || Number.isNaN(Date.parse(desde))) return NextResponse.json({ agora, vendas: [] });
  try {
    const vendas = await vendasDepoisDe(new Date(desde).toISOString());
    // Próxima pergunta parte da última venda vista (ou de agora, se não houve nenhuma).
    const ultima = vendas.at(-1)?.em;
    return NextResponse.json({ agora: ultima && ultima > agora ? ultima : agora, vendas });
  } catch {
    return NextResponse.json({ agora: desde, vendas: [] });
  }
}
