"use server";

import { eAdmin } from "@/lib/admin";
import { registrarChamadaCertificado } from "@/lib/whatsapp-chamadas";

/** Chamado pelo botão "Chamar no WhatsApp" do certificado: anota no banco quando o aluno foi chamado. */
export async function anotarChamadaWhatsCertificado(email: string, cursoId: string): Promise<string[] | null> {
  if (!(await eAdmin("alunos")) && !(await eAdmin("financeiro"))) return null;
  if (!email || !cursoId) return null;
  try {
    return await registrarChamadaCertificado(String(email), String(cursoId));
  } catch (e) {
    console.error("[whatsapp-chamada]", e instanceof Error ? e.message : e);
    return null;
  }
}
