"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin";
import Anthropic from "@anthropic-ai/sdk";
import { apagarMensagem, definirStatus, obterMensagem, salvarAnotacao } from "@/lib/dados/mensagens";
import { iaConfigurada, sugerirRespostaIA } from "@/lib/resposta-ia";

const id = (f: FormData) => Number(f.get("id"));
const atualizar = () => revalidatePath("/admin", "layout");

export async function marcarResolvida(f: FormData) {
  const quem = await exigirAdmin("mensagens");
  await definirStatus(id(f), f.get("reabrir") ? "nova" : "resolvida", quem.nome ?? quem.email);
  atualizar();
}

export async function anotarMensagem(f: FormData) {
  await exigirAdmin("mensagens");
  await salvarAnotacao(id(f), String(f.get("anotacao") ?? "").trim().slice(0, 2000) || null);
  atualizar();
}

export async function excluirMensagem(f: FormData) {
  await exigirAdmin("mensagens");
  await apagarMensagem(id(f));
  atualizar();
}

/** Gera uma resposta sugerida pela IA (só quando a equipe pede, para não gastar à toa). */
export async function sugerirResposta(id: number): Promise<{ texto?: string; erro?: string }> {
  await exigirAdmin("mensagens");
  if (!iaConfigurada) return { erro: "A IA ainda não está ligada: falta a chave ANTHROPIC_API_KEY na Vercel." };
  const m = await obterMensagem(id);
  if (!m) return { erro: "Mensagem não encontrada." };
  try {
    return { texto: await sugerirRespostaIA(m) };
  } catch (e) {
    console.error("[ajuda] sugestão IA", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e instanceof Error ? e.message : e);
    if (e instanceof Anthropic.AuthenticationError) return { erro: "A chave da IA (ANTHROPIC_API_KEY) não foi aceita. Confira na Vercel." };
    if (e instanceof Anthropic.RateLimitError) return { erro: "Muitos pedidos à IA agora. Tente de novo em 1 minuto." };
    return { erro: "Não conseguimos gerar a sugestão agora. Tente de novo em alguns instantes." };
  }
}
