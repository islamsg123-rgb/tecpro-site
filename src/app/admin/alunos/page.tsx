import type { Metadata } from "next";
import Link from "next/link";
import { eventosMatricula } from "@/lib/dados";
import { alunosComAtividade, diasDesde } from "@/lib/admin-relatorios";
import { BotaoExportar } from "@/components/admin/BotaoExportar";

export const metadata: Metadata = { title: "Alunos" };
export const dynamic = "force-dynamic";

function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium" });
}

function data(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
}

const filtros = [
  { id: "", rotulo: "Todos" },
  { id: "nunca", rotulo: "Nunca estudaram" },
  { id: "7", rotulo: "Parados há 7+ dias" },
  { id: "30", rotulo: "Parados há 30+ dias" },
];

type Props = { searchParams: Promise<{ filtro?: string; busca?: string }> };

export default async function Alunos({ searchParams }: Props) {
  const [todos, eventos, { filtro = "", busca = "" }] = await Promise.all([alunosComAtividade(), eventosMatricula(), searchParams]);
  const termo = busca.trim().toLowerCase();
  const alunos = todos.filter((a) => {
    const dias = diasDesde(a.ultimaAtividade);
    if (filtro === "nunca" && dias !== null) return false;
    if ((filtro === "7" || filtro === "30") && (dias === null || dias < Number(filtro))) return false;
    if (termo && !`${a.nome ?? ""} ${a.email}`.toLowerCase().includes(termo)) return false;
    return true;
  });
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-marca-900">Alunos</h1>
        <BotaoExportar tipo="alunos" />
      </div>
      <p className="mt-2 text-sm text-slate-500">
        Alunos matriculados pelo site ({todos.length}). Clique no nome para ver a ficha: cursos, progresso, provas e certificados.
      </p>
      <form className="mt-5 flex flex-wrap items-center gap-2">
        {filtros.map((f) => (
          <Link
            key={f.id}
            href={f.id ? `/admin/alunos?filtro=${f.id}` : "/admin/alunos"}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${filtro === f.id ? "bg-marca-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-marca-900"}`}
          >
            {f.rotulo}
          </Link>
        ))}
        <input type="hidden" name="filtro" value={filtro} />
        <input name="busca" defaultValue={busca} placeholder="Buscar nome ou e-mail" className="ml-auto w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm sm:w-64" />
      </form>
      {!alunos.length ? (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {todos.length ? "Nenhum aluno neste filtro." : "Nenhum aluno matriculado pelo site ainda."}
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
                <th className="px-5 py-3 font-semibold">Última atividade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {alunos.map((a) => (
                <tr key={a.email} className="hover:bg-marca-50/50">
                  <td className="px-5 py-3 font-medium">
                    <Link href={`/admin/alunos/ficha?email=${encodeURIComponent(a.email)}`} className="text-marca-900 underline decoration-laranja-500 underline-offset-4 hover:text-marca-700">
                      {a.nome ?? a.email}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{a.email}</td>
                  <td className="px-5 py-3">
                    <Link href={`/admin/diagnostico?aluno=${encodeURIComponent(a.eaUsuarioId)}`} className="text-marca-700 underline">
                      {a.eaUsuarioId}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-500">{data(a.criadoEm)}</td>
                  <td className="whitespace-nowrap px-5 py-3"><Atividade iso={a.ultimaAtividade} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 id="eventos" className="mt-12 text-xl font-bold text-marca-900">Últimas tentativas de matrícula</h2>
      <p className="mt-1 text-sm text-slate-500">
        O que aconteceu depois de cada pagamento: o aviso do Asaas e cada resposta da Escola Avançada. Mais recentes primeiro.
      </p>
      {!eventos.length ? (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          Nada registrado ainda. Se você fez uma compra e nada aparece aqui, o aviso do Asaas não chegou ao site
          (confira o webhook em Asaas &gt; Integrações &gt; Webhooks).
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white text-sm">
          {eventos.map((e, i) => (
            <li key={i} className="flex gap-3 px-5 py-3">
              <span className={e.ok ? "text-emerald-600" : "text-red-600"} aria-label={e.ok ? "ok" : "erro"}>
                {e.ok ? "✓" : "✕"}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-marca-900">
                  {e.etapa} <span className="font-normal text-slate-400">· {dataHora(e.quando)}</span>
                </p>
                <p className="break-words font-mono text-xs text-slate-600">{e.detalhe}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Atividade({ iso }: { iso: string | null }) {
  const dias = diasDesde(iso);
  if (dias === null) return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">nunca estudou</span>;
  const cor = dias >= 30 ? "bg-red-100 text-red-700" : dias >= 7 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cor}`}>{dias === 0 ? "hoje" : dias === 1 ? "ontem" : `há ${dias} dias`}</span>;
}
