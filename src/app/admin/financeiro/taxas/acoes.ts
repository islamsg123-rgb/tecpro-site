"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin";
import { salvarTaxas, TAXAS_PADRAO, type TaxasPagamento } from "@/lib/taxas";

/** Lê "4,98" ou "4.98" como número; vazio ou inválido = padrão. */
function numero(v: FormDataEntryValue | null, padrao: number, max: number): number {
  const n = Number(String(v ?? "").replace(/\s|%|R\$/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= max ? n : padrao;
}

export async function salvarTaxasAcao(f: FormData) {
  await exigirAdmin("financeiro");
  const t: TaxasPagamento = {
    pixPct: numero(f.get("pixPct"), TAXAS_PADRAO.pixPct, 20),
    cartaoPct: numero(f.get("cartaoPct"), TAXAS_PADRAO.cartaoPct, 20),
    boletoCentavos: Math.round(numero(f.get("boleto"), TAXAS_PADRAO.boletoCentavos / 100, 50) * 100),
    diasPix: Math.round(numero(f.get("diasPix"), 0, 60)),
    diasCartao: Math.round(numero(f.get("diasCartao"), 0, 60)),
    diasBoleto: Math.round(numero(f.get("diasBoleto"), 0, 60)),
  };
  await salvarTaxas(t);
  revalidatePath("/admin/financeiro", "layout");
  redirect("/admin/financeiro/taxas?salvo=1");
}
