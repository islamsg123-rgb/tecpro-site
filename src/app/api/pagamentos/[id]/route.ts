import { NextResponse } from "next/server";
import { consultarCobranca } from "@/lib/pagamentos";

/** Usado pela tela do pedido para saber se o Pix/boleto já foi pago. Devolve só a situação. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cobranca = await consultarCobranca((await params).id);
  if (!cobranca) return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
  return NextResponse.json({ situacao: cobranca.situacao }, { headers: { "Cache-Control": "no-store" } });
}
