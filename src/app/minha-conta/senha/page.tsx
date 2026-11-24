import type { Metadata } from "next";
import { exigirAluno } from "@/lib/area-aluno";
import { FormularioSenha } from "@/components/aluno/FormularioSenha";

export const metadata: Metadata = { title: "Minha senha", robots: { index: false } };

export default async function MinhaSenha() {
  const aluno = await exigirAluno();
  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-14">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-marca-900/5 sm:p-10">
        <FormularioSenha email={aluno.email} />
      </div>
    </div>
  );
}
