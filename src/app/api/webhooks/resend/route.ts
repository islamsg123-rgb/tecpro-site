import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { aplicarEventoResend, type EventoResend } from "@/lib/dados/emails";

/**
 * Avisos do Resend (webhook): entregue, aberto, clicado, voltou, spam...
 * Cadastrar em Resend > Webhooks > Add Endpoint:
 *   URL: https://www.tecpromultiensino.com.br/api/webhooks/resend   Eventos: todos os "email.*"
 * Opcional, mais seguro: colar o "Signing Secret" (whsec_...) em RESEND_WEBHOOK_SECRET na Vercel.
 *
 * Sem a chave, o aviso só atualiza e-mails que o próprio site anotou (o id do Resend não dá para adivinhar).
 * Com a chave, também entram os e-mails que o site não anota (ex.: os do login do Supabase, que saem pelo Resend).
 */

function assinaturaConfere(req: Request, corpo: string, segredo: string): boolean {
  const id = req.headers.get("svix-id") ?? req.headers.get("webhook-id");
  const ts = req.headers.get("svix-timestamp") ?? req.headers.get("webhook-timestamp");
  const assinaturas = req.headers.get("svix-signature") ?? req.headers.get("webhook-signature");
  if (!id || !ts || !assinaturas) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 10 * 60) return false; // aviso velho demais (ou repetido de propósito)
  const chave = Buffer.from(segredo.replace(/^whsec_/, ""), "base64");
  const esperado = Buffer.from(createHmac("sha256", chave).update(`${id}.${ts}.${corpo}`).digest("base64"));
  return assinaturas.split(" ").some((a) => {
    const recebido = Buffer.from(a.split(",")[1] ?? "");
    return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
  });
}

export async function POST(req: Request) {
  const corpo = await req.text();
  const segredo = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (segredo && !assinaturaConfere(req, corpo, segredo)) {
    console.warn("[webhook-resend] assinatura não confere (confira RESEND_WEBHOOK_SECRET na Vercel)");
    return NextResponse.json({ erro: "assinatura inválida" }, { status: 401 });
  }
  let evento: EventoResend;
  try {
    evento = JSON.parse(corpo) as EventoResend;
  } catch {
    return NextResponse.json({ erro: "corpo inválido" }, { status: 400 });
  }
  try {
    const r = await aplicarEventoResend(evento, Boolean(segredo));
    return NextResponse.json({ ok: true, r });
  } catch (e) {
    // Tabela ainda não criada (falta o SQL) ou banco fora do ar: responde 200 para o Resend não insistir sem parar.
    console.error("[webhook-resend]", (e as Error).message);
    return NextResponse.json({ ok: false, erro: "não foi possível guardar o aviso" });
  }
}
