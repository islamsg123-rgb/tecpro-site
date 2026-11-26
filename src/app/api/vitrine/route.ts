import { NextResponse } from "next/server";
import { obterConfigLoja } from "@/lib/dados";
import { getCursos } from "@/lib/cursos";
import { avisosRecentes, type AvisoLoja } from "@/lib/dados/avisos-loja";

/**
 * Dados leves para o navegador da loja: código do Google Analytics e avisos de acontecimentos reais.
 * Fica guardado por 5 minutos (todo mundo recebe a mesma resposta), então quase não gasta.
 */
export const revalidate = 300;

export interface RespostaVitrine {
  ga: string | null;
  avisos: AvisoLoja[];
}

export async function GET() {
  const loja = await obterConfigLoja().catch(() => null);
  let avisos: AvisoLoja[] = [];
  if (loja?.avisosNaLoja !== false) {
    try {
      const cursos = await getCursos();
      avisos = await avisosRecentes(new Map(cursos.map((c) => [c.id, c.nome])));
    } catch (e) {
      console.error("[vitrine] avisos", e);
    }
  }
  const resposta: RespostaVitrine = { ga: loja?.googleAnalyticsId || null, avisos };
  return NextResponse.json(resposta);
}
