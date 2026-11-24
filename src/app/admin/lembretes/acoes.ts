"use server";

import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin";
import { enviarEmail } from "@/lib/email";
import {
  CONFIG_LEMBRETES_PADRAO, emailDeExemplo, MENSAGEM_WHATSAPP_NUNCA, MENSAGEM_WHATSAPP_PADRAO, NOME_TIPO,
  obterConfigLembretes, rodarLembretes, salvarConfigLembretes, type TipoLembrete,
} from "@/lib/lembretes";
import { SITE_OFICIAL } from "@/lib/site";

const inteiro = (v: FormDataEntryValue | null, min: number, max: number) => {
  const n = Number(String(v ?? "").trim());
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** Lê os 3 dias de um grupo (prefixo "d", "n" ou "i"). null = inválido (precisam ser crescentes). */
function lerDias(f: FormData, p: string): [number, number, number] | null {
  const d = [1, 2, 3].map((i) => inteiro(f.get(`${p}${i}`), 1, 120));
  if (d.some((x) => x === null)) return null;
  const [a, b, c] = d as number[];
  return a < b && b < c ? [a, b, c] : null;
}

const texto = (f: FormData, nome: string, padrao: string) => String(f.get(nome) ?? "").trim().slice(0, 1500) || padrao;

export async function salvarLembretes(f: FormData) {
  await exigirAdmin("alunos");
  const dias = lerDias(f, "d"), diasN = lerDias(f, "n");
  const limite = inteiro(f.get("limite"), 1, 365), maximo = inteiro(f.get("maximo"), 1, 1000);
  if (!dias || !diasN) redirect("/admin/lembretes?erro=dias#config");
  if (!limite || limite < Math.max(dias[2], diasN[2])) redirect("/admin/lembretes?erro=limite#config");
  if (!maximo) redirect("/admin/lembretes?erro=maximo#config");
  await salvarConfigLembretes({
    ...CONFIG_LEMBRETES_PADRAO,
    ligado: f.get("ligado") === "on",
    dias,
    limiteDias: limite,
    maximoPorDia: maximo,
    mensagemWhatsapp: texto(f, "mensagemWhatsapp", MENSAGEM_WHATSAPP_PADRAO),
    nuncaComecou: { ligado: f.get("nLigado") === "on", dias: diasN, mensagemWhatsapp: texto(f, "nMensagem", MENSAGEM_WHATSAPP_NUNCA) },
  });
  redirect("/admin/lembretes?salvo=1");
}

/** Manda os 3 modelos de um tipo de lembrete para o e-mail de quem está no painel, com dados de exemplo. */
async function enviarTeste(tipo: TipoLembrete) {
  const a = await exigirAdmin("alunos");
  const cfg = await obterConfigLembretes();
  try {
    for (const etapa of [1, 2, 3]) {
      const e = emailDeExemplo(tipo, etapa, cfg, a.nome ?? "Maria", a.email);
      await enviarEmail({ para: a.email, ...e, assunto: `[TESTE ${NOME_TIPO[tipo]} ${etapa}º] ${e.assunto}` });
      await new Promise((ok) => setTimeout(ok, 600));
    }
  } catch (e) {
    redirect(`/admin/lembretes?erroTeste=${encodeURIComponent(e instanceof Error ? e.message.slice(0, 200) : "erro")}`);
  }
  redirect(`/admin/lembretes?teste=${encodeURIComponent(a.email)}`);
}

export async function rodarAgora() {
  await exigirAdmin("alunos");
  await rodarLembretes("painel", SITE_OFICIAL);
  redirect("/admin/lembretes?rodou=1#rodada");
}

export async function testeParado() {
  await enviarTeste("parado");
}
export async function testeNunca() {
  await enviarTeste("nunca");
}
