import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { compradorDoClienteAsaas } from "@/lib/pagamentos/asaas";
import { processarPagamento } from "@/lib/pagamentos/liberacao";
import { produtoDaReferencia } from "@/lib/pagamentos/tipos";

/**
 * Avisos automáticos do Asaas (webhook).
 * Configurar no painel do Asaas: Integrações > Webhooks
 *   URL:   https://SEU-DOMINIO/api/webhooks/asaas
 *   Token: o mesmo valor de ASAAS_WEBHOOK_TOKEN
 *   Eventos: PAYMENT_CONFIRMED e PAYMENT_RECEIVED (os demais são ignorados)
 */

const EVENTOS_PAGO = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);

function tokenConfere(recebido: string | null): boolean {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!tokenConfere(req.headers.get("asaas-access-token"))) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const corpo = (await req.json().catch(() => null)) as {
    event?: string;
    payment?: { id: string; customer: string; externalReference?: string };
  } | null;
  if (!corpo?.event || !corpo.payment) return NextResponse.json({ ok: true });
  if (!EVENTOS_PAGO.has(corpo.event)) return NextResponse.json({ ok: true, ignorado: corpo.event });

  const produto = produtoDaReferencia(corpo.payment.externalReference);
  console.info(`[webhook] ${corpo.event} ${corpo.payment.id} referência=${corpo.payment.externalReference ?? "-"}`);
  if (!produto) return NextResponse.json({ ok: true, ignorado: "sem produto" });

  try {
    const comprador = await compradorDoClienteAsaas(corpo.payment.customer);
    await processarPagamento(corpo.payment.id, comprador, produto);
  } catch {
    // Responder erro faz o Asaas tentar de novo mais tarde.
    return NextResponse.json({ erro: "falha ao liberar acesso" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
