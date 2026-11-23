import type { Metadata } from "next";
import Link from "next/link";
import { listarAlunos } from "@/lib/dados";

export const metadata: Metadata = { title: "Alunos" };
export const dynamic = "force-dynamic";

function data(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
}

export default async function Alunos() {
  const alunos = await listarAlunos();
  return (
    <>
      <h1 className="text-3xl font-extrabold text-marca-900">Alunos</h1>
      <p className="mt-2 text-sm text-slate-500">
        Alunos matriculados pelo site. O cadastro completo e os cursos de cada um ficam no painel da Escola Avançada.
      </p>
      {!alunos.length ? (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          Nenhum aluno matriculado pelo site ainda.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Nome</th>
                <th className="px-5 py-3 font-semibold">E-mail</th>
                <th className="px-5 py-3 font-semibold">Código na Escola Avançada</th>
                <th className="px-5 py-3 font-semibold">Desde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {alunos.map((a) => (
                <tr key={a.email} className="hover:bg-marca-50/50">
                  <td className="px-5 py-3 font-medium text-marca-900">{a.nome ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{a.email}</td>
                  <td className="px-5 py-3">
                    <Link href={`/admin/diagnostico?aluno=${encodeURIComponent(a.eaUsuarioId)}`} className="text-marca-700 underline">
                      {a.eaUsuarioId}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-500">{data(a.criadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
