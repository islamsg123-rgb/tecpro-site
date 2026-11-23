"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin";
import { getCursos } from "@/lib/cursos";
import { salvarConfiguracaoCurso } from "@/lib/dados";

/** "197,90" / "197.90" / "R$ 197" -> centavos. Vazio -> null. */
function lerPreco(v: FormDataEntryValue | null): number | null | "invalido" {
  const t = String(v ?? "").replace(/[R$\s]/g, "").trim();
  if (!t) return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normal);
  if (!Number.isFinite(n) || n < 5) return "invalido";
  return Math.round(n * 100);
}

export async function salvarCurso(f: FormData) {
  await exigirAdmin();
  const cursoId = String(f.get("cursoId"));
  if (!(await getCursos()).some((c) => c.id === cursoId)) redirect("/admin/cursos");

  const preco = lerPreco(f.get("preco"));
  const modo = String(f.get("certificadoModo"));
  const precoCert = lerPreco(f.get("certificadoPreco"));
  const voltar = (q: string) => redirect(`/admin/cursos?${q}&curso=${cursoId}#curso-${cursoId}`);

  if (preco === "invalido") voltar("erro=preco");
  if (modo === "pago" && (precoCert === null || precoCert === "invalido")) voltar("erro=certificado");

  await salvarConfiguracaoCurso({
    cursoId,
    precoCentavos: preco as number | null,
    visivel: f.get("visivel") === "on",
    destaque: f.get("destaque") === "on",
    certificadoModo: modo === "pago" ? "pago" : "gratis",
    certificadoPrecoCentavos: modo === "pago" ? (precoCert as number) : null,
  });
  // Atualiza a vitrine, as páginas de curso e a área do aluno.
  revalidatePath("/", "layout");
  voltar("salvo=1");
}
