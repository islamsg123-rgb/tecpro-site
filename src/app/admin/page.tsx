import Link from "next/link";
import { acessoPainel } from "@/lib/admin";
import { getCursos } from "@/lib/cursos";
import { formatarPreco } from "@/lib/formatar";
import {
  agruparDevedores, cobrancasEmAtraso, cobrancasParaRelatorio, listarFormados, pessoasDoPainel, resumoFinanceiro,
  ultimosAcontecimentos, DIAS_PARA_INATIVO, type Acontecimento,
} from "@/lib/painel-resumo";
import { Caixa, dataCurta, GraficoMensal, LinkVerTudo, Numero, PorForma, Vazio } from "@/components/admin/Blocos";
import type { Cobranca } from "@/lib/pagamentos/tipos";
import { contarNovas } from "@/lib/dados/mensagens";

export const dynamic = "force-dynamic";

const iconeEvento: Record<Acontecimento["tipo"], [string, string]> = {
  pagamento: ["R$", "bg-emerald-100 text-emerald-700"],
  matricula: ["+", "bg-marca-100 text-marca-700"],
  certificado: ["✓", "bg-laranja-300/40 text-marca-900"],
  interesse: ["?", "bg-blue-100 text-blue-700"],
  pesquisa: ["★", "bg-amber-100 text-amber-700"],
  atraso: ["!", "bg-red-100 text-red-700"],
};

function quandoFoi(iso: string) {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00-03:00` : iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (iso.length > 10 && min < 60) return min <= 1 ? "agora" : `há ${min} min`;
  if (iso.length > 10 && min < 24 * 60) return `há ${Math.round(min / 60)} h`;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short" });
}

type Props = { searchParams: Promise<{ "sem-permissao"?: string }> };

export default async function PainelRapido({ searchParams }: Props) {
  const acesso = (await acessoPainel())!;
  const verFinanceiro = acesso.permissoes.includes("financeiro");
  const verAlunos = acesso.permissoes.includes("alunos");
  const semPermissao = Boolean((await searchParams)["sem-permissao"]);

  const verMensagens = acesso.permissoes.includes("mensagens");
  const [cobrancas, pessoas, formados, cursos, novas] = await Promise.all([
    cobrancasParaRelatorio().catch(() => [] as Cobranca[]),
    pessoasDoPainel(),
    listarFormados().catch(() => []),
    getCursos(),
    verMensagens ? contarNovas().catch(() => ({ aluno: 0, loja: 0 })) : { aluno: 0, loja: 0 },
  ]);
  const acontecimentos = await ultimosAcontecimentos(verFinanceiro ? cobrancas : []);
  const fin = resumoFinanceiro(cobrancas);
  const devedores = agruparDevedores(cobrancasEmAtraso(cobrancas));
  const conta = (s: string) => pessoas.filter((p) => p.situacao === s).length;
  const alunos = pessoas.filter((p) => p.matriculado);
  const variacao = fin.recebidoMesAnteriorCentavos
    ? Math.round(((fin.recebidoMesCentavos - fin.recebidoMesAnteriorCentavos) / fin.recebidoMesAnteriorCentavos) * 100)
    : null;
  const ultimasMatriculas = cobrancas.filter((c) => c.situacao === "pago" && c.produto?.tipo === "curso").slice(0, 6);
  const nomeCurso = (id?: string) => cursos.find((c) => c.id === id)?.nome ?? "";
  const mesAtual = new Date().toLocaleDateString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-marca-900">Painel rápido</h1>
          <p className="mt-1 text-sm text-slate-500">Um apanhado geral da escola. Números de {mesAtual}, atualizados agora.</p>
        </div>
      </div>
      {semPermissao && (
        <p className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Seu acesso não inclui aquela parte do painel. Peça ao responsável para liberar em Funcionários.
        </p>
      )}

      {novas.aluno + novas.loja > 0 && (
        <Link
          href={novas.aluno ? "/admin/mensagens/aluno" : "/admin/mensagens/loja"}
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-laranja-500/50 bg-laranja-300/20 p-4 text-sm text-marca-900 hover:border-laranja-500"
        >
          <span>
            <strong>{novas.aluno + novas.loja === 1 ? "1 mensagem nova" : `${novas.aluno + novas.loja} mensagens novas`}</strong> no botão de ajuda
            {" "}({novas.aluno} da Área do aluno, {novas.loja} da Loja virtual).
          </span>
          <span className="font-semibold underline">Ver mensagens</span>
        </Link>
      )}

      {verFinanceiro && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Numero
            rotulo={`Recebido em ${mesAtual}`}
            valor={formatarPreco(fin.recebidoMesCentavos)}
            detalhe={variacao === null ? `líquido ${formatarPreco(fin.liquidoMesCentavos)}` : `${variacao >= 0 ? "+" : ""}${variacao}% em relação ao mês passado`}
            href="/admin/financeiro"
            cor="verde"
          />
          <Numero rotulo="A receber" valor={formatarPreco(fin.aReceberCentavos)} detalhe="Pix e boletos dentro do prazo" href="/admin/financeiro/recebimentos?situacao=aguardando" />
          <Numero rotulo="Em atraso" valor={formatarPreco(fin.emAtrasoCentavos)} detalhe={`${devedores.length} ${devedores.length === 1 ? "devedor" : "devedores"}`} href="/admin/financeiro/devedores" cor="vermelho" />
          <Numero rotulo="Matrículas pagas no mês" valor={String(fin.matriculasMes)} detalhe={`${fin.certificadosMes} certificados pagos · ticket médio ${formatarPreco(fin.ticketMedioCentavos)}`} href="/admin/financeiro/recebimentos" cor="laranja" />
        </div>
      )}

      <div className={`grid gap-4 sm:grid-cols-3 lg:grid-cols-5 ${verFinanceiro ? "mt-4" : ""}`}>
        <Numero rotulo="Alunos ativos" valor={String(conta("ativo"))} detalhe={`estudaram nos últimos ${DIAS_PARA_INATIVO} dias`} href={verAlunos ? "/admin/alunos?filtro=ativo" : undefined} cor="verde" />
        <Numero rotulo="Inativos" valor={String(conta("inativo"))} detalhe={`parados há ${DIAS_PARA_INATIVO}+ dias`} href={verAlunos ? "/admin/alunos?filtro=inativo" : undefined} cor="vermelho" />
        <Numero rotulo="Interessados" valor={String(conta("interessado"))} detalhe="cadastraram, mas não viram aula" href={verAlunos ? "/admin/alunos?filtro=interessado" : undefined} />
        <Numero rotulo="Devedores" valor={String(devedores.length)} detalhe={verFinanceiro ? formatarPreco(fin.emAtrasoCentavos) : "pagamentos vencidos"} href={verFinanceiro ? "/admin/financeiro/devedores" : undefined} cor="laranja" />
        <Numero rotulo="Formados" valor={String(new Set(formados.map((f) => f.email)).size)} detalhe={`${formados.filter((f) => f.certificado).length} certificados emitidos`} href={verAlunos ? "/admin/alunos/formados" : undefined} cor="cinza" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {verFinanceiro && (
          <Caixa titulo="Faturamento mensal" acao={<LinkVerTudo href="/admin/financeiro">Financeiro</LinkVerTudo>} className="lg:col-span-2">
            <GraficoMensal meses={fin.mensal} />
          </Caixa>
        )}
        {verFinanceiro && (
          <Caixa titulo={`Recebimentos de ${mesAtual}`}>
            <PorForma porForma={fin.porForma} />
          </Caixa>
        )}

        <Caixa titulo="Últimos acontecimentos" className="lg:col-span-2">
          {!acontecimentos.length ? (
            <Vazio>Nada por aqui ainda. Assim que alguém se cadastrar, pagar ou emitir um certificado, aparece nesta lista.</Vazio>
          ) : (
            <ul className="divide-y divide-slate-100">
              {acontecimentos.map((a, i) => {
                const [ic, cls] = iconeEvento[a.tipo];
                const corpo = (
                  <>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ${cls}`}>{ic}</span>
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

        <div className="space-y-6">
          {verFinanceiro && (
            <Caixa titulo="Últimas matrículas pagas" acao={<LinkVerTudo href="/admin/financeiro/recebimentos" />}>
              {!ultimasMatriculas.length ? (
                <p className="text-sm text-slate-500">Nenhuma matrícula paga ainda.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {ultimasMatriculas.map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-marca-900">{(c.cliente ?? "").split(" · ")[0] || "Cliente"}</span>
                        <span className="block truncate text-xs text-slate-500">{nomeCurso(c.produto?.cursoId) || c.descricao} · {dataCurta(c.pagoEm ?? c.criadoEm)}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-marca-900">{formatarPreco(c.valorCentavos)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Caixa>
          )}
          {verFinanceiro && (
            <Caixa titulo="Devedores" acao={<LinkVerTudo href="/admin/financeiro/devedores" />}>
              {!devedores.length ? (
                <p className="text-sm text-slate-500">Ninguém com pagamento em atraso. 🎉</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {devedores.slice(0, 5).map((d) => (
                    <li key={d.chave} className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-marca-900">{d.nome}</span>
                        <span className="block text-xs text-slate-500">venceu em {dataCurta(d.vencidoDesde)}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-red-700">{formatarPreco(d.totalCentavos)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Caixa>
          )}
          {verAlunos && (
            <Caixa titulo="Novos alunos" acao={<LinkVerTudo href="/admin/alunos" />}>
              {!alunos.length ? (
                <p className="text-sm text-slate-500">Nenhum aluno ainda.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {alunos.slice(0, 5).map((a) => (
                    <li key={a.email}>
                      <Link href={`/admin/alunos/ficha?email=${encodeURIComponent(a.email)}`} className="block truncate font-semibold text-marca-900 hover:text-marca-700">{a.nome ?? a.email}</Link>
                      <span className="text-xs text-slate-500">desde {dataCurta(a.desde)}</span>
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
