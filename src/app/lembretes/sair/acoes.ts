"use server";

import { redirect } from "next/navigation";
import { assinaturaValida, definirDescadastro } from "@/lib/lembretes";

async function mudar(f: FormData, sair: boolean) {
  const e = String(f.get("e") ?? "");
  const t = String(f.get("t") ?? "");
  if (!assinaturaValida(e, t)) redirect("/lembretes/sair");
  await definirDescadastro(e, sair);
  redirect(`/lembretes/sair?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}&feito=${sair ? "sair" : "voltar"}`);
}

export async function sairDosLembretes(f: FormData) {
  await mudar(f, true);
}

export async function voltarAosLembretes(f: FormData) {
  await mudar(f, false);
}
