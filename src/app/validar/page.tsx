import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { IconeCertificado } from "@/components/Icones";

export const metadata: Metadata = { title: "Validar certificado" };

async function validar(f: FormData) {
  "use server";
  const codigo = String(f.get("codigo") ?? "").trim().toUpperCase();
  if (codigo) redirect(`/validar/${encodeURIComponent(codigo)}`);
}

export default function Validar() {
  return (
    <section className="mx-auto max-w-lg px-4 py-20 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-marca-900 text-laranja-500"><IconeCertificado className="h-8 w-8" /></span>
      <h1 className="mt-6 text-3xl font-extrabold text-marca-900">Validar certificado</h1>
      <p className="mt-3 text-slate-600">Digite o código que aparece no certificado para confirmar que ele é autêntico.</p>
      <form action={validar} className="mt-8 flex gap-2 rounded-full border border-slate-200 bg-white p-2">
        <input name="codigo" placeholder="TP-XXXX-XXXX" aria-label="Código do certificado" required className="min-w-0 flex-1 bg-transparent px-4 font-mono uppercase outline-none" />
        <button className="rounded-full bg-laranja-500 px-6 py-3 font-bold text-marca-900 hover:bg-laranja-400">Validar</button>
      </form>
    </section>
  );
}
