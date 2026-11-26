import Link from "next/link";
import { acessoPainel } from "@/lib/admin";
import { getCursos } from "@/lib/cursos";
import {
  listarFormados, pessoasDoPainel, ultimosAcontecimentos, DIAS_PARA_INATIVO, type Acontecimento,
} from "@/lib/painel-resumo";
import { Caixa, dataCurta, LinkVerTudo, Numero, Vazio } from "@/components/admin/Blocos";
import { contarNovas } from "@/lib/dados/mensagens";
import { Dica } from "@/components/admin/Dica";
import { inicioUltimosDias } from "@/lib/dias";

export const dynamic = "force-dynamic";

const iconeEvento: Record<Acontecimento["tipo"], [string, string, string]> = {
  pagamento: ["R$", "bg-emerald-100 text-emerald-700", "Pagamento confirmado."],
  matricula: ["+", "bg-marca-100 text-marca-700", "Nova matrícula em um curso."],
  certificado: ["✓", "bg-laranja-300/40 text-marca-900", "Certificado emitido."],
  interesse: ["?", "bg-blue-100 text-blue-700", "Alguém começou uma compra (curso ou certificado) e ainda não terminou."],
  pesquisa: ["★", "bg-amber-100 text-amber-700", "Aluno respondeu a pesquisa de satisfação."],
  atraso: ["!", "bg-red-100 text-red-700", "Pagamento passou do vencimento sem ser pago."],
};

function quandoFoi(iso: string) {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00-03:00` : iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (iso.length > 10 && min < 60) return min <= 1 ? "agora" : `há ${min} min`;
  if (iso.length > 10 && min < 24 * 60) return `há ${Math.round(min / 60)} h`;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short" });
}

type Props = { searchParams: Promise<{ "sem-permissao"?: string }> };

/**
 * Painel rápido da GESTÃO: só pessoas (alunos, mensagens, quem está terminando).
 * Nenhum valor em dinheiro aqui; tudo de dinheiro fica no Painel Financeiro.
 */
export default async function PainelRapido({ searchParams }: Props) {
  const acesso = (await acessoPainel())!;
  const verAlunos = acesso.permissoes.includes("alunos");
  const semPermissao = Boolean((await searchParams)["sem-permissao"]);

  const verMensagens = acesso.permissoes.includes("mensagens");
  const [pessoas, formados, novas] = await Promise.all([
    pessoasDoPainel(),
    listarFormados().catch(() => []),
    verMensagens ? contarNovas().catch(() => 0) : 0,
  ]);
  // Sem pagamentos: os acontecimentos da Gestão são matrículas, certificados, interesse e pesquisa.
  const acontecimentos = (await ultimosAcontecimentos([])).filter((a) => a.tipo !== "pagamento" && a.tipo !== "atraso");
  const conta = (s: string) => pessoas.filter((p) => p.situacao === s).length;
  const alunos = pessoas.filter((p) => p.matriculado);
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const diaDe = (iso: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00-03:00` : iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) : "");
  const novosHoje = alunos.filter((a) => diaDe(a.desde) === hoje).length;
  const seteDias = inicioUltimosDias(7);
  const novos7 = alunos.filter((a) => a.desde && new Date(a.desde.length === 10 ? `${a.desde}T12:00:00-03:00` : a.desde).toISOString() >= seteDias).length;
  const semCertificado = formados.filter((f) => f.faltaPagarCertificado);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-marca-900">Painel rápido</h1>
          <p className="mt-1 text-sm text-slate-500">Como estão os alunos hoje. Valores em dinheiro ficam no Painel Financeiro.</p>
        </div>
      </div>
      {semPermissao && (
        <p className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Seu acesso não inclui aquela parte do painel. Peça ao responsável para liberar em Funcionários.
        </p>
      )}

      {novas > 0 && (
        <Link
          href="/admin/mensagens"
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-laranja-500/50 bg-laranja-300/20 p-4 text-sm text-marca-900 hover:border-laranja-500"
        >
          <span>
            <strong>{novas === 1 ? "1 mensagem nova" : `${novas} mensagens novas`}</strong> no botão de ajuda do site.
          </span>
          <span className="font-semibold underline">Ver mensagens</span>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Numero rotulo="Alunos novos hoje" valor={String(novosHoje)} detalhe={`${novos7} nos últimos 7 dias`} href={verAlunos ? "/admin/alunos" : undefined} cor="laranja" dica="Pessoas que se matricularam hoje (curso grátis ou pago). Embaixo, quantas nos últimos 7 dias." />
        <Numero rotulo="Alunos ativos" valor={String(conta("ativo"))} detalhe={`estudaram nos últimos ${DIAS_PARA_INATIVO} dias`} href={verAlunos ? "/admin/alunos?filtro=ativo" : undefined} cor="verde" dica={`Alunos que estudaram alguma aula nos últimos ${DIAS_PARA_INATIVO} dias.`} />
        <Numero rotulo="Parados" valor={String(conta("inativo"))} detalhe={`sem estudar há ${DIAS_PARA_INATIVO}+ dias`} href={verAlunos ? "/admin/alunos?filtro=inativo" : undefined} cor="vermelho" dica={`Alunos com curso que não estudam há ${DIAS_PARA_INATIVO} dias ou mais. Vale um lembrete.`} />
        <Numero rotulo="Nunca abriram aula" valor={String(conta("interessado"))} detalhe="cadastraram, mas não começaram" href={verAlunos ? "/admin/alunos?filtro=interessado" : undefined} dica="Pessoas que se cadastraram, mas ainda não abriram nenhuma aula." />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Numero rotulo="Formados" valor={String(new Set(formados.map((f) => f.email)).size)} detalhe={`${formados.filter((f) => f.certificado).length} certificados emitidos`} href={verAlunos ? "/admin/alunos/formados" : undefined} cor="cinza" dica="Pessoas que concluíram pelo menos um curso. Embaixo, quantos certificados já foram gerados." />
        <Numero rotulo="Concluíram sem certificado" valor={String(semCertificado.length)} detalhe="ainda não emitiram" href={verAlunos ? "/admin/alunos/ranking" : undefined} cor="laranja" dica="Alunos que terminaram um curso grátis e ainda não emitiram o certificado. Um lembrete pode ajudar." />
        <Numero rotulo="Mensagens novas" valor={String(novas)} detalhe="no botão de ajuda" href={verMensagens ? "/admin/mensagens" : undefined} cor={novas ? "vermelho" : "cinza"} dica="Mensagens enviadas pelo botão de ajuda do site que ninguém abriu ainda." />
        <Numero rotulo="Total de alunos" valor={String(alunos.length)} detalhe="matriculados pelo site" href={verAlunos ? "/admin/alunos" : undefined} dica="Todas as pessoas com pelo menos um curso pelo site." />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Caixa titulo="Últimos acontecimentos" className="lg:col-span-2">
          {!acontecimentos.length ? (
            <Vazio>Nada por aqui ainda. Assim que alguém se matricular, emitir um certificado ou responder a pesquisa, aparece nesta lista.</Vazio>
          ) : (
            <ul className="divide-y divide-slate-100">
              {acontecimentos.map((a, i) => {
                const [ic, cls, explica] = iconeEvento[a.tipo];
                const corpo = (
                  <>
                    <Dica texto={explica} className="shrink-0 rounded-full"><span className={`grid h-9 w-9 place-items-center rounded-full text-xs font-bold ${cls}`}>{ic}</span></Dica>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-marca-900">{a.titulo}</span>
                      <span className="block truncate text-xs text-slate-500">{a.detalhe}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">{quandoFoi(a.quando)}</span>
                  </>
                );
                return (
                  <li key={i}>
                    {a.link ? <Link href={a.link} className="flex items-center gap-3 py-3 hover:bg-marca-50/50">{corpo}</Link> : <div className="flex items-center gap-3 py-3">{corpo}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </Caixa>

        <div className="min-w-0 space-y-6">
          {verAlunos && (
            <Caixa titulo="Novos alunos" acao={<LinkVerTudo href="/admin/alunos" />}>
              {!alunos.length ? (
                <p className="text-sm text-slate-500">Nenhum aluno ainda.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {alunos.slice(0, 6).map((a) => (
                    <li key={a.email}>
                      <Link href={`/admin/alunos/ficha?email=${encodeURIComponent(a.email)}`} className="block truncate font-semibold text-marca-900 hover:text-marca-700">{a.nome ?? a.email}</Link>
                      <span className="text-xs text-slate-500">desde {dataCurta(a.desde)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Caixa>
          )}
          {verAlunos && (
            <Caixa titulo="Concluíram sem certificado" acao={<LinkVerTudo href="/admin/alunos/formados" />}>
              {!semCertificado.length ? (
                <p className="text-sm text-slate-500">Ninguém nessa situação agora.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {semCertificado.slice(0, 5).map((f) => (
                    <li key={`${f.email}|${f.cursoId}`}>
                      <Link href={`/admin/alunos/ficha?email=${encodeURIComponent(f.email)}`} className="block truncate font-semibold text-marca-900 hover:text-marca-700">{f.email}</Link>
                      <span className="block truncate text-xs text-slate-500">{f.cursoNome}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Caixa>
          )}
        </div>
      </div>
    </>
  );
}
