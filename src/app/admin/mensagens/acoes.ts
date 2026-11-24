"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin";
import { apagarMensagem, definirStatus, obterMensagem, salvarAnotacao } from "@/lib/dados/mensagens";
import { montarPedidoClaude } from "@/lib/resposta-ia";

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

/** Monta o pedido para colar no Claude (claude.ai). Não tem custo: nada é enviado a uma IA daqui. */
export async function prepararPedidoClaude(id: number): Promise<{ texto?: string; erro?: string }> {
  await exigirAdmin("mensagens");
  const m = await obterMensagem(id);
  if (!m) return { erro: "Mensagem não encontrada." };
  try {
    return { texto: await montarPedidoClaude(m) };
  } catch (e) {
    console.error("[ajuda] pedido Claude", e instanceof Error ? e.message : e);
    return { erro: "Não conseguimos preparar o texto agora. Tente de novo." };
  }
}
