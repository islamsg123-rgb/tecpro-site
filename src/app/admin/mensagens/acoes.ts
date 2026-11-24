"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin";
import { apagarMensagem, definirStatus, salvarAnotacao } from "@/lib/dados/mensagens";

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
