import type { Metadata } from "next";
import Link from "next/link";
import { eventosMatricula } from "@/lib/dados";
import { diasDesde } from "@/lib/admin-relatorios";
import { exigirAdmin } from "@/lib/admin";
import { getCursos } from "@/lib/cursos";
import { DIAS_PARA_INATIVO, pessoasDoPainel } from "@/lib/painel-resumo";
import { EtiquetaAluno, Numero, Titulo } from "@/components/admin/Blocos";
import { BotaoExportar } from "@/components/admin/BotaoExportar";
import { Dica } from "@/components/admin/Dica";

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
  { id: "ativo", rotulo: "Ativos" },
  { id: "inativo", rotulo: "Inativos" },
  { id: "interessado", rotulo: "Interessados" },
  { id: "7", rotulo: "Parados há 7+ dias" },
];

type Props = { searchParams: Promise<{ filtro?: string; busca?: string; excluido?: string; ea?: string; certs?: string; pedidos?: string }> };

export default async function Alunos({ searchParams }: Props) {
  await exigirAdmin("alunos");
  const [todos, eventos, cursos, { filtro = "", busca = "", excluido, ea, certs, pedidos }] = await Promise.all([pessoasDoPainel(), eventosMatricula(), getCursos(), searchParams]);
  const termo = busca.trim().toLowerCase();
  const nomeCurso = (id: string | null) => (id ? cursos.find((c) => c.id === id)?.nome ?? "" : "");
  const conta = (s: string) => todos.filter((p) => p.situacao === s).length;
  const alunos = todos.filter((a) => {
    const dias = diasDesde(a.ultimaAtividade);
    if (["ativo", "inativo", "interessado"].includes(filtro) && a.situacao !== filtro) return false;
    if (filtro === "7" && (dias === null || dias < 7)) return false;
    if (filtro === "nunca" && (dias !== null || !a.matriculado)) return false;
    if (termo && !`${a.nome ?? ""} ${a.email} ${a.telefone ?? ""}`.toLowerCase().includes(termo)) return false;
    return true;
  });
  return (
    <>
      <Titulo
        acao={<div className="flex flex-wrap gap-2"><Link href="/admin/alunos/novo" className="rounded-full bg-laranja-500 px-4 py-2 text-sm font-bold text-marca-900 hover:bg-laranja-400">+ Cadastrar aluno</Link><BotaoExportar tipo="alunos" /></div>}
        descricao={<>Clique no nome para abrir a ficha completa: dados, pagamentos, cursos (adicionar ou remover), progresso e certificados. <strong>Ativo</strong> = estudou nos últimos {DIAS_PARA_INATIVO} dias; <strong>inativo</strong> = parou há mais tempo; <strong>interessado</strong> = se cadastrou, mas ainda não viu nenhuma aula.</>}
      >
        Alunos
      </Titulo>
      {excluido && (
        <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p><strong>{excluido === "1" ? "Aluno excluído" : `Aluno excluído: ${excluido}`}.</strong> O login e os dados pessoais foram apagados do site.
            {Number(pedidos) > 0 && ` ${pedidos} ${Number(pedidos) === 1 ? "pagamento continua" : "pagamentos continuam"} no Financeiro como "Aluno excluído".`}
            {Number(certs) > 0 && ` ${certs} ${Number(certs) === 1 ? "certificado emitido continua válido" : "certificados emitidos continuam válidos"} na validação.`}
          </p>
          <p className="mt-1">Na Escola Avançada o aluno continua cadastrado{ea ? ` (código ${ea})` : ""}. Se quiser, remova por lá.</p>
        </div>
      )}
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <Numero rotulo="Total" valor={String(todos.length)} detalhe={`${todos.filter((p) => p.matriculado).length} matriculados`} dica="Todas as pessoas cadastradas no site. Matriculados são os que têm pelo menos um curso." />
        <Numero rotulo="Ativos" valor={String(conta("ativo"))} cor="verde" href="/admin/alunos?filtro=ativo" dica={`Estudaram alguma aula nos últimos ${DIAS_PARA_INATIVO} dias.`} />
        <Numero rotulo="Inativos" valor={String(conta("inativo"))} cor="vermelho" href="/admin/alunos?filtro=inativo" dica={`Têm curso, mas não estudam há ${DIAS_PARA_INATIVO} dias ou mais.`} />
        <Numero rotulo="Interessados" valor={String(conta("interessado"))} cor="laranja" href="/admin/alunos?filtro=interessado" dica="Se cadastraram, mas ainda não abriram nenhuma aula." />
      </div>
      <form className="flex flex-wrap items-center gap-2">
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
        <input name="busca" defaultValue={busca} placeholder="Buscar nome, e-mail ou telefone" className="ml-auto w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm sm:w-72" />
      </form>
      {!alunos.length ? (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {todos.length ? "Ninguém neste filtro." : "Nenhum aluno ainda."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Nome</th>
                <th className="px-5 py-3 font-semibold">Contato</th>
                <th className="px-5 py-3 font-semibold">Situação</th>
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
                    {!a.matriculado && a.cursoInteresse && <span className="block text-xs font-normal text-slate-500">olhou: {nomeCurso(a.cursoInteresse)}</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{a.email}{a.telefone && <span className="block text-xs text-slate-500">{a.telefone}</span>}</td>
                  <td className="px-5 py-3"><EtiquetaAluno s={a.situacao} />{!a.matriculado && <Dica texto="Ainda não tem nenhum curso liberado. Pode ter começado uma compra sem terminar." className="ml-1"><span className="text-xs text-slate-400">sem matrícula</span></Dica>}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-500">{data(a.desde)}</td>
                  <td className="whitespace-nowrap px-5 py-3">{a.matriculado ? <Atividade iso={a.ultimaAtividade} /> : <span className="text-xs text-slate-400">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 id="eventos" className="mt-12 text-xl font-bold text-marca-900">Últimas tentativas de matrícula</h2>
      <p className="mt-1 text-sm text-slate-500">
        O que aconteceu depois de cada pagamento: o aviso do Mercado Pago (ou do Asaas) e cada resposta da Escola Avançada. Mais recentes primeiro.
      </p>
      {!eventos.length ? (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          Nada registrado ainda. Se você fez uma compra e nada aparece aqui, o aviso de pagamento não chegou ao site
          (abra a tela do pedido: ela também libera o acesso quando vê o pagamento aprovado).
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white text-sm">
          {eventos.map((e, i) => (
            <li key={i} className="flex gap-3 px-5 py-3">
              <Dica texto={e.ok ? "Esta etapa deu certo." : "Esta etapa deu erro. Veja o detalhe ao lado."} className="self-start rounded-full">
                <span className={e.ok ? "text-emerald-600" : "text-red-600"} aria-label={e.ok ? "ok" : "erro"}>
                  {e.ok ? "✓" : "✕"}
                </span>
              </Dica>
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
  if (dias === null) return <Dica texto="Tem curso, mas ainda não abriu nenhuma aula."><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">nunca estudou</span></Dica>;
  const cor = dias >= 30 ? "bg-red-100 text-red-700" : dias >= 7 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800";
  const explica = dias >= 30 ? "Parado há 30 dias ou mais (vermelho)." : dias >= 7 ? "Parado há 7 dias ou mais (amarelo). Vale um lembrete." : "Estudou nos últimos 7 dias (verde).";
  return <Dica texto={`Última vez que estudou uma aula. ${explica}`}><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cor}`}>{dias === 0 ? "hoje" : dias === 1 ? "ontem" : `há ${dias} dias`}</span></Dica>;
}
