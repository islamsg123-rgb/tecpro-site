import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { consultarCobrancaMp, mpConfigurado } from "@/lib/pagamentos/mercadopago";
import { liberarCobrancaPaga } from "@/lib/pagamentos";
import { registrarEventoMatricula } from "@/lib/dados";

/**
 * Avisos automáticos do Mercado Pago (webhook).
 * Cadastrar em Mercado Pago > Suas integrações > (aplicação) > Webhooks:
 *   URL: https://SEU-DOMINIO/api/webhooks/mercadopago   Evento: "Order (Mercado Pago)"
 * Opcional, mais seguro: colar a "Assinatura secreta" em MERCADOPAGO_WEBHOOK_SECRET na Vercel.
 *
 * Mesmo sem a assinatura, um aviso falso não libera nada: o site sempre consulta o pagamento
 * direto no Mercado Pago (com o nosso Access Token) antes de liberar.
 */

function assinaturaConfere(req: Request, dataId: string): boolean {
  const segredo = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!segredo) return true;
  const partes = Object.fromEntries(
    (req.headers.get("x-signature") ?? "").split(",").map((p) => p.split("=").map((x) => x.trim()) as [string, string]),
  );
  if (!partes.ts || !partes.v1) return false;
  const requestId = req.headers.get("x-request-id") ?? "";
  const manifesto = `id:${dataId.toLowerCase()};${requestId ? `request-id:${requestId};` : ""}ts:${partes.ts};`;
  const esperado = Buffer.from(createHmac("sha256", segredo).update(manifesto).digest("hex"));
  const recebido = Buffer.from(partes.v1);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const corpo = (await req.json().catch(() => null)) as { type?: string; action?: string; topic?: string; data?: { id?: unknown }; resource?: unknown } | null;
  const tipo = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? corpo?.type ?? corpo?.topic ?? "";
  const id = String(url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? corpo?.data?.id ?? "");

  // Só interessam avisos de pedidos ("order"); os outros são ignorados.
  if (tipo !== "order" || !/^ORD[A-Z0-9]+$/i.test(id)) return NextResponse.json({ ok: true, ignorado: tipo || "sem tipo" });
  if (!mpConfigurado) return NextResponse.json({ ok: true, ignorado: "Mercado Pago não configurado" });

  if (!assinaturaConfere(req, id)) {
    await registrarEventoMatricula(
      "aviso do Mercado Pago",
      false,
      "Recusado: a assinatura não confere. Confira MERCADOPAGO_WEBHOOK_SECRET na Vercel (ou apague essa variável).",
    );
    return NextResponse.json({ erro: "assinatura inválida" }, { status: 401 });
  }

  const cobranca = await consultarCobrancaMp(id);
  if (!cobranca) return NextResponse.json({ erro: "pedido não encontrado" }, { status: 500 });
  console.info(`[webhook-mp] pedido ${id} situação=${cobranca.situacao} produto=${cobranca.produto ? "sim" : "não"}`);
  if (cobranca.situacao !== "pago") return NextResponse.json({ ok: true, situacao: cobranca.situacao });

  await registrarEventoMatricula(
    "aviso do Mercado Pago",
    Boolean(cobranca.produto),
    `Pedido ${id} pago` + (cobranca.produto ? "" : " ignorado: não indica um curso ou certificado do site"),
  );
  if (!cobranca.produto) return NextResponse.json({ ok: true, ignorado: "sem produto" });

  try {
    await liberarCobrancaPaga(cobranca);
  } catch (e) {
    await registrarEventoMatricula("aviso do Mercado Pago", false, `Falha ao processar ${id}: ${e instanceof Error ? e.message : String(e)}`);
    // Responder erro faz o Mercado Pago tentar de novo mais tarde.
    return NextResponse.json({ erro: "falha ao liberar acesso" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
