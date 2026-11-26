import { NextResponse } from "next/server";
import { rodarLembretes } from "@/lib/lembretes";
import { rodadaEmailsCertificado } from "@/lib/lembrete-certificado";

/**
 * Chamado pela Vercel todo dia às 10h (horário de Brasília), conforme vercel.json.
 * A Vercel manda "Authorization: Bearer <CRON_SECRET>"; sem essa variável na Vercel, nada roda.
 * O resultado aparece no painel (Alunos > Lembretes de estudo).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  const r = await rodarLembretes("automatico");
  // 2º e 3º e-mail do certificado (agenda no Resend os que vencem nas próximas 24h)
  const cert = await rodadaEmailsCertificado();
  return NextResponse.json({ enviados: r.enviados, erros: r.erros, erroGeral: r.erroGeral, certificado: cert }, { status: r.erroGeral ? 500 : 200 });
}
