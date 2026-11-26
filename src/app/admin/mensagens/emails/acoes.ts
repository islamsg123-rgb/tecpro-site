"use server";

import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin";
import { enviarEmail } from "@/lib/email";
import { obterConfigLembretes, salvarConfigLembretes } from "@/lib/lembretes";
import { exemploEmailCertificado, NOME_EMAIL_CERTIFICADO, type TipoEmailCertificado } from "@/lib/lembrete-certificado";

const PAGINA = "/admin/mensagens/emails";
const inteiro = (v: FormDataEntryValue | null, min: number, max: number) => {
  const n = Number(String(v ?? "").trim());
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** Salva os e-mails do certificado (o resto da configuração de lembretes fica como está). */
export async function salvarEmailsCertificado(f: FormData) {
  await exigirAdmin("mensagens");
  const horas = inteiro(f.get("cHoras"), 1, 72);
  if (!horas) redirect(`${PAGINA}?erro=horas#certificado`);
  const dias2 = inteiro(f.get("c2Dias"), 1, 60), dias3 = inteiro(f.get("c3Dias"), 1, 60);
  if (!dias2 || !dias3 || dias3 <= dias2) redirect(`${PAGINA}?erro=diasCert#certificado`);
  const cfg = await obterConfigLembretes();
  await salvarConfigLembretes({
    ...cfg,
    certificado: {
      ligado: f.get("cLigado") === "on", horas, entrega: f.get("cEntrega") === "on",
      segundo: { ligado: f.get("c2Ligado") === "on", dias: dias2 },
      terceiro: { ligado: f.get("c3Ligado") === "on", dias: dias3 },
    },
  });
  redirect(`${PAGINA}?salvo=1`);
}

/** Manda os 4 e-mails do certificado (com dados de exemplo) para quem está no painel. */
export async function testeCertificado() {
  const a = await exigirAdmin("mensagens");
  try {
    for (const tipo of ["comprar", "comprar2", "comprar3", "entrega"] as TipoEmailCertificado[]) {
      const e = exemploEmailCertificado(tipo, a.nome ?? "Maria Souza", a.email);
      await enviarEmail({ para: a.email, ...e, assunto: `[TESTE ${NOME_EMAIL_CERTIFICADO[tipo]}] ${e.assunto}`, tipo: "teste" });
      await new Promise((ok) => setTimeout(ok, 600));
    }
  } catch (e) {
    redirect(`${PAGINA}?erroTeste=${encodeURIComponent(e instanceof Error ? e.message.slice(0, 200) : "erro")}#certificado`);
  }
  redirect(`${PAGINA}?teste=${encodeURIComponent(a.email)}#certificado`);
}
