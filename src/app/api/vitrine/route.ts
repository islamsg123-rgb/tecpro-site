import { NextResponse } from "next/server";
import { obterConfigLoja } from "@/lib/dados";

/**
 * Dados leves para o navegador da loja: o código do Google Analytics.
 * Fica guardado por 5 minutos (todo mundo recebe a mesma resposta), então quase não gasta.
 */
export const revalidate = 300;

export interface RespostaVitrine {
  ga: string | null;
}

export async function GET() {
  const loja = await obterConfigLoja().catch(() => null);
  const resposta: RespostaVitrine = { ga: loja?.googleAnalyticsId || null };
  return NextResponse.json(resposta);
}
