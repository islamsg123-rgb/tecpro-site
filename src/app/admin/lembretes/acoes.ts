"use server";

import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin";
import { emailLembrete, enviarEmail } from "@/lib/email";
import {
  CONFIG_LEMBRETES_PADRAO, linkContinuar, linkDescadastro, MENSAGEM_WHATSAPP_PADRAO, obterConfigLembretes, rodarLembretes, salvarConfigLembretes,
} from "@/lib/lembretes";
import { SITE_OFICIAL } from "@/lib/site";

const inteiro = (v: FormDataEntryValue | null, min: number, max: number) => {
  const n = Number(String(v ?? "").trim());
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

export async function salvarLembretes(f: FormData) {
  await exigirAdmin("alunos");
  const d1 = inteiro(f.get("d1"), 1, 60), d2 = inteiro(f.get("d2"), 1, 90), d3 = inteiro(f.get("d3"), 1, 120);
  const limite = inteiro(f.get("limite"), 1, 365), maximo = inteiro(f.get("maximo"), 1, 1000);
  if (!d1 || !d2 || !d3 || !(d1 < d2 && d2 < d3)) redirect("/admin/lembretes?erro=dias#config");
  if (!limite || limite < d3) redirect("/admin/lembretes?erro=limite#config");
  if (!maximo) redirect("/admin/lembretes?erro=maximo#config");
  const msg = String(f.get("mensagemWhatsapp") ?? "").trim().slice(0, 1500);
  await salvarConfigLembretes({
    ...CONFIG_LEMBRETES_PADRAO,
    ligado: f.get("ligado") === "on",
    dias: [d1, d2, d3],
    limiteDias: limite,
    maximoPorDia: maximo,
    mensagemWhatsapp: msg || MENSAGEM_WHATSAPP_PADRAO,
  });
  redirect("/admin/lembretes?salvo=1");
}

/** Manda os 3 modelos de lembrete para o e-mail de quem está no painel, com dados de exemplo. */
export async function enviarTeste() {
  const a = await exigirAdmin("alunos");
  const cfg = await obterConfigLembretes();
  try {
    for (const etapa of [1, 2, 3]) {
      const e = emailLembrete({
        nome: a.nome ?? "Maria", curso: "Excel Avançado", pct: 40 + etapa * 5, feitas: 8 + etapa, total: 20, dias: cfg.dias[etapa - 1], etapa,
        linkContinuar: linkContinuar("excel-avancado"), linkSair: linkDescadastro(a.email),
      });
      await enviarEmail({ para: a.email, ...e, assunto: `[TESTE ${etapa}º lembrete] ${e.assunto}` });
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
