import type { Metadata } from "next";
import Link from "next/link";
import { certificadoPorCodigo } from "@/lib/dados";
import { IconeCheck } from "@/components/Icones";

export const metadata: Metadata = { title: "Validação de certificado", robots: { index: false } };

type Props = { params: Promise<{ codigo: string }> };

export default async function Validacao({ params }: Props) {
  const codigo = decodeURIComponent((await params).codigo).toUpperCase();
  const c = await certificadoPorCodigo(codigo);

  if (!c) {
    return (
      <section className="mx-auto max-w-lg px-4 py-20 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl font-bold text-red-600">!</span>
        <h1 className="mt-6 text-3xl font-extrabold text-marca-900">Certificado não encontrado</h1>
        <p className="mt-3 text-slate-600">Não existe certificado com o código <strong className="font-mono">{codigo}</strong>. Confira se digitou corretamente.</p>
        <Link href="/validar" className="mt-8 inline-block font-bold text-marca-700 underline decoration-laranja-500 decoration-2 underline-offset-4">Tentar outro código</Link>
      </section>
    );
  }

  const data = new Date(c.emitidoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return (
    <section className="mx-auto max-w-lg px-4 py-20">
      <div className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600"><IconeCheck className="h-8 w-8" /></span>
        <h1 className="mt-6 text-3xl font-extrabold text-marca-900">Certificado autêntico</h1>
        <p className="mt-2 text-slate-600">Emitido pela Tecpro Multi Ensino.</p>
      </div>
      <dl className="mt-8 divide-y divide-slate-100 rounded-3xl border border-slate-200 bg-white px-6">
        {[
          ["Aluno", c.nomeAluno],
          ["Curso", c.cursoNome],
          ["Carga horária", `${c.cargaHoraria} horas`],
          ["Emitido em", data],
          ["Código", c.codigo],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-4 text-sm">
            <dt className="text-slate-500">{k}</dt>
            <dd className="text-right font-semibold text-marca-900">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
