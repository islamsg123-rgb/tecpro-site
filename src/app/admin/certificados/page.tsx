import type { Metadata } from "next";
import Link from "next/link";
import { getCursos } from "@/lib/cursos";
import { listarCertificados, listarCertificadosPagos } from "@/lib/dados";
import { dataBR } from "@/lib/admin-relatorios";
import { BotaoExportar } from "@/components/admin/BotaoExportar";

export const metadata: Metadata = { title: "Certificados" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ busca?: string }> };

export default async function Certificados({ searchParams }: Props) {
  const [emitidos, pagos, cursos, { busca = "" }] = await Promise.all([listarCertificados(), listarCertificadosPagos(), getCursos(), searchParams]);
  const pago = new Set(pagos.map((p) => `${p.email}|${p.cursoId}`));
  const termo = busca.trim().toLowerCase();
  const lista = emitidos.filter((c) => !termo || `${c.codigo} ${c.nomeAluno} ${c.email} ${c.cursoNome}`.toLowerCase().includes(termo));
  const naoEmitidos = pagos.filter((p) => !emitidos.some((e) => e.email === p.email && e.cursoId === p.cursoId));
  const nomeCurso = (id: string) => cursos.find((c) => c.id === id)?.nome ?? `curso ${id}`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-marca-900">Certificados</h1>
        <BotaoExportar tipo="certificados" />
      </div>
      <p className="mt-2 text-sm text-slate-500">
        Certificados da Tecpro emitidos pelos alunos ({emitidos.length}), {pagos.length} pagos. Todos podem ser conferidos na página pública de validação.
      </p>

      {naoEmitidos.length > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">Pagos e ainda não emitidos ({naoEmitidos.length})</p>
          <p className="mt-1 text-amber-800">O aluno já pagou; falta ele confirmar o nome e emitir na área do aluno.</p>
          <ul className="mt-3 space-y-1">
            {naoEmitidos.map((p) => (
              <li key={`${p.email}|${p.cursoId}`}>
                <Link href={`/admin/alunos/ficha?email=${encodeURIComponent(p.email)}`} className="underline">{p.email}</Link> · {nomeCurso(p.cursoId)} · pago em {dataBR(p.pagoEm)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form className="mt-6">
        <input name="busca" defaultValue={busca} placeholder="Buscar código, aluno ou curso" className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm sm:w-80" />
      </form>

      {!lista.length ? (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {emitidos.length ? "Nenhum certificado nesta busca." : "Nenhum certificado emitido ainda."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Código</th>
                <th className="px-5 py-3 font-semibold">Aluno</th>
                <th className="px-5 py-3 font-semibold">Curso</th>
                <th className="px-5 py-3 font-semibold">Emitido em</th>
                <th className="px-5 py-3 font-semibold">Tipo</th>
                <th className="px-5 py-3 font-semibold"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lista.map((c) => (
                <tr key={c.codigo} className="hover:bg-marca-50/50">
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-marca-900">{c.codigo}</td>
                  <td className="px-5 py-3">
                    <Link href={`/admin/alunos/ficha?email=${encodeURIComponent(c.email)}`} className="font-medium text-marca-900 underline decoration-laranja-500 underline-offset-4">{c.nomeAluno}</Link>
                    <span className="block text-xs text-slate-500">{c.email}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{c.cursoNome} · {c.cargaHoraria}h</td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-500">{dataBR(c.emitidoEm)}</td>
                  <td className="px-5 py-3 text-slate-600">{pago.has(`${c.email}|${c.cursoId}`) ? "Pago" : "Grátis"}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right">
                    <a href={`/certificados/${c.codigo}/pdf`} target="_blank" rel="noopener" className="font-semibold text-marca-700 hover:underline">PDF</a>
                    <Link href={`/validar/${c.codigo}`} className="ml-4 font-semibold text-marca-700 hover:underline">Validar</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
