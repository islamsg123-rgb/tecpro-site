"use server";

import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin";
import { certificadoPorCodigo } from "@/lib/dados";
import { enviarCertificadoPorEmail } from "@/lib/lembrete-certificado";

/** Manda de novo o certificado em PDF para o e-mail do aluno. */
export async function reenviarCertificado(f: FormData) {
  await exigirAdmin("alunos");
  const cert = await certificadoPorCodigo(String(f.get("codigo") ?? ""));
  if (!cert) redirect("/admin/certificados?erro=naoachou");
  try {
    await enviarCertificadoPorEmail(cert, true);
  } catch (e) {
    redirect(`/admin/certificados?erro=${encodeURIComponent(e instanceof Error ? e.message.slice(0, 200) : "erro")}`);
  }
  redirect(`/admin/certificados?reenviado=${encodeURIComponent(cert.email)}`);
}
