import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { lugarDoCaminho } from "@/lib/online";
import { registrarSinal, registrarVisita } from "@/lib/dados/online";
import { limparOrigemVisita } from "@/lib/origem";
import { emailValido } from "@/lib/validacao";
import { COOKIE_CONTATO_CHECKOUT } from "@/lib/online-cookie";

/**
 * Sinal de "estou no site" (uma vez por minuto por aba aberta, só com a aba na frente).
 * Feito para ser barato: nenhuma chamada externa além de uma gravação no banco.
 * Robôs (Google, prévias de link do WhatsApp...) não contam.
 */
export const dynamic = "force-dynamic";

const ROBO = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|whatsapp|telegram|curl|wget|python|monitor/i;
const VISITANTE = /^[a-z0-9-]{8,64}$/i;

/** E-mail de quem está logado, lido do cookie de sessão do Supabase sem consultar a internet (só serve para o painel). */
function emailDaSessao(lista: { name: string; value: string }[]): string | null {
  const partes = lista
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => Number(a.name.split(".").pop()) - Number(b.name.split(".").pop()));
  if (!partes.length) return null;
  try {
    let bruto = partes.map((c) => c.value).join("");
    if (bruto.startsWith("base64-")) bruto = Buffer.from(bruto.slice(7), "base64url").toString("utf8");
    const s = JSON.parse(bruto) as { user?: { email?: string }; access_token?: string };
    let email = s.user?.email;
    if (!email && s.access_token) email = JSON.parse(Buffer.from(s.access_token.split(".")[1], "base64url").toString("utf8")).email;
    return email ? email.toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const vazio = new NextResponse(null, { status: 204 });
  if (ROBO.test(req.headers.get("user-agent") ?? "")) return vazio;
  let corpo: { v?: unknown; c?: unknown; o?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return vazio;
  }
  const visitante = typeof corpo.v === "string" && VISITANTE.test(corpo.v) ? corpo.v : null;
  const lugar = typeof corpo.c === "string" && corpo.c.length < 400 ? lugarDoCaminho(corpo.c) : null;
  if (!visitante || !lugar) return vazio;

  const jar = await cookies();
  const todos = jar.getAll();
  // Quem está "vendo como aluno" é da equipe: não conta.
  if (jar.get("tecpro_modo_aluno")?.value === "1") return vazio;
  const contato = decodeURIComponent(jar.get(COOKIE_CONTATO_CHECKOUT)?.value ?? "").toLowerCase();
  const email = emailDaSessao(todos) ?? jar.get("tecpro_demo_email")?.value ?? (emailValido(contato) ? contato : null);
  // 1º sinal da visita: diz de onde a pessoa chegou (Google, Instagram, direto...).
  const origem = limparOrigemVisita(corpo.o);
  await Promise.all([
    registrarSinal(visitante, email, lugar).catch(() => undefined), // tabela ainda não criada (online-agora.sql)
    origem ? registrarVisita(visitante, email, origem).catch(() => undefined) : undefined, // falta origens-publico.sql
  ]);
  return vazio;
}
