import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/lib/admin";
import { formatarPreco } from "@/lib/formatar";
import { agruparDevedores, cobrancasEmAtraso, cobrancasParaRelatorio, listarFormados } from "@/lib/painel-resumo";
import { listarCarrinhos } from "@/lib/dados/carrinhos";
import { listarAlunos, obterConfigLoja } from "@/lib/dados";
import { telefonesDosAlunos } from "@/lib/lembretes";
import { linkEmitirCertificado, mensagemCertificado } from "@/lib/whatsapp-certificado";
import { BotaoWhatsCertificado } from "@/components/admin/BotaoWhatsCertificado";
import { chaveChamada, listarChamadasCertificado } from "@/lib/whatsapp-chamadas";
import { dataHoraBR } from "@/lib/admin-relatorios";
import { Dica } from "@/components/admin/Dica";
import { nomeForma } from "@/components/admin/EtiquetaSituacao";
import { Caixa, dataCurta, Numero, Titulo, Vazio } from "@/components/admin/Blocos";
import { Itens, Recolhivel } from "@/components/ListaRecolhida";

export const metadata: Metadata = { title: "Recuperar vendas" };
export const dynamic = "force-dynamic";

function linkWhats(telefone: string, texto: string) {
  const n = telefone.replace(/\D/g, "");
  return `https://wa.me/${n.length <= 11 ? `55${n}` : n}?text=${encodeURIComponent(texto)}`;
}

export default async function Devedores() {
  await exigirAdmin("financeiro");
  const [cobrancas, formados, { lista: carrinhos }, telefones, loja, alunos, chamadas] = await Promise.all([
    cobrancasParaRelatorio(), listarFormados().catch(() => []), listarCarrinhos(2000),
    telefonesDosAlunos().catch(() => new Map<string, string>()), obterConfigLoja(), listarAlunos(5000),
    listarChamadasCertificado(),
  ]);
  const precos = { individual: loja.precoCertIndividual, essencial: loja.precoCertEssencial, profissional: loja.precoCertProfissional };
  const nomeAluno = (email: string) => alunos.find((a) => a.email === email)?.nome ?? email;
  const devedores = agruparDevedores(cobrancasEmAtraso(cobrancas));
  const total = devedores.reduce((s, d) => s + d.totalCentavos, 0);
  const pendentesCert = formados.filter((f) => f.faltaPagarCertificado);
  // Quem concluiu por último fica em cima. Quem já foi chamado no WhatsApp vai para a lista de baixo.
  const vezesChamado = (f: (typeof formados)[number]) => chamadas.get(chaveChamada(f.email, f.cursoId)) ?? [];
  const ultimaChamada = (f: (typeof formados)[number]) => vezesChamado(f).at(-1) ?? "";
  const naoChamados = pendentesCert.filter((f) => !vezesChamado(f).length)
    .sort((a, b) => String(b.concluidoEm ?? "").localeCompare(String(a.concluidoEm ?? "")));
  const jaChamados = pendentesCert.filter((f) => vezesChamado(f).length)
    .sort((a, b) => ultimaChamada(b).localeCompare(ultimaChamada(a)));
  const telefone = (email: string) => carrinhos.find((c) => c.email === email && c.telefone)?.telefone ?? null;

  function ListaCert({ lista }: { lista: typeof pendentesCert }) {
    return (
      <Recolhivel total={lista.length}><ul className="divide-y divide-slate-100 text-sm"><Itens>
        {lista.map((f) => {
          const fone = telefones.get(f.email.trim().toLowerCase()) ?? telefone(f.email);
          return (
            <li key={`${f.email}|${f.cursoId}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span>
                <Link href={`/admin/alunos/ficha?email=${encodeURIComponent(f.email)}`} className="font-semibold text-marca-900 underline decoration-laranja-500 underline-offset-4">{nomeAluno(f.email)}</Link>
                <span className="block text-xs text-slate-500">{f.cursoNome}{f.precoCertificadoCentavos ? ` · certificado ${formatarPreco(f.precoCertificadoCentavos)}` : ""}</span>
                <span className="block text-xs text-slate-400">{f.concluidoEm ? `Concluiu em ${dataHoraBR(f.concluidoEm)} · ` : ""}{f.email}</span>
              </span>
              <BotaoWhatsCertificado
                email={f.email} cursoId={f.cursoId} chamadas={vezesChamado(f)}
                url={fone ? linkWhats(fone, mensagemCertificado({ nome: nomeAluno(f.email), curso: f.cursoNome, link: linkEmitirCertificado(f.cursoSlug), precos })) : null}
              />
            </li>
          );
        })}
      </Itens></ul></Recolhivel>
    );
  }

  return (
    <>
      <Titulo descricao="Vendas quase feitas: quem gerou Pix ou boleto e não pagou, e quem concluiu um curso grátis e ainda não pagou o certificado. Um WhatsApp costuma resolver. Quem desistiu no meio do checkout está em Vendas > Carrinhos abandonados.">
        Recuperar vendas
      </Titulo>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Numero rotulo="Pix e boletos não pagos" valor={formatarPreco(total)} cor="vermelho" dica="Soma dos Pix e boletos gerados que passaram do prazo sem pagamento. Não é dívida: a pessoa só não concluiu a compra." />
        <Numero rotulo="Pessoas para chamar" valor={String(devedores.length)} cor="laranja" dica="Quantas pessoas geraram Pix ou boleto e não pagaram." />
        <Numero rotulo="Certificados a pagar" valor={String(pendentesCert.length)} detalhe="concluíram e ainda não pagaram" dica="Alunos que concluíram um curso grátis e ainda não pagaram o certificado. Não é dívida vencida: é uma venda que pode acontecer." />
      </div>

      <Caixa titulo="Pix e boletos não pagos">
        {!devedores.length ? (
          <Vazio>Nenhum Pix ou boleto esquecido.</Vazio>
        ) : (
          <Recolhivel total={devedores.length}><div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Pessoa</th>
                  <th className="py-2 pr-4 font-semibold">O que ia comprar</th>
                  <th className="py-2 pr-4 font-semibold">Prazo era</th>
                  <th className="py-2 pr-4 text-right font-semibold">Valor</th>
                  <th className="py-2 font-semibold"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100"><Itens>
                {devedores.map((d) => {
                  const fone = d.telefone || (d.email ? telefone(d.email) : null);
                  const fatura = d.cobrancas.find((c) => c.linkFatura)?.linkFatura;
                  return (
                    <tr key={d.chave} className="align-top">
                      <td className="py-3 pr-4">
                        {d.email ? (
                          <Link href={`/admin/alunos/ficha?email=${encodeURIComponent(d.email)}`} className="font-semibold text-marca-900 underline decoration-laranja-500 underline-offset-4">{d.nome}</Link>
                        ) : <span className="font-semibold text-marca-900">{d.nome}</span>}
                        <span className="block text-xs text-slate-500">{d.email ?? ""}{fone ? ` · ${fone}` : ""}</span>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {d.cobrancas.map((c) => <span key={c.id} className="block">{c.descricao ?? c.id} ({nomeForma[c.forma] ?? c.forma})</span>)}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 text-slate-600">{dataCurta(d.vencidoDesde)}</td>
                      <td className="whitespace-nowrap py-3 pr-4 text-right font-semibold text-red-700">{formatarPreco(d.totalCentavos)}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          {fone && (
                            <a
                              href={linkWhats(fone, `Oi, ${d.nome.split(" ")[0]}! Aqui é da Tecpro. Vimos que o pagamento de ${d.cobrancas[0].descricao ?? "seu curso"} venceu. Quer que a gente gere um novo Pix ou boleto? Se preferir, dá para pagar no cartão em até 12x.`)}
                              target="_blank" rel="noreferrer"
                              className="whitespace-nowrap rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                            >
                              WhatsApp
                            </a>
                          )}
                          {fatura && <a href={fatura} target="_blank" rel="noreferrer" className="whitespace-nowrap rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-marca-900">Ver cobrança</a>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </Itens></tbody>
            </table>
          </div></Recolhivel>
        )}
      </Caixa>

      <div id="certificados" className="scroll-mt-24" />
      <Caixa titulo="Concluíram e falta pagar o certificado" className="mt-6">
        {!pendentesCert.length ? (
          <Vazio>Ninguém nessa situação agora.</Vazio>
        ) : (
          <>
            <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-marca-900">
              <Dica texto="Quem concluiu um curso grátis, ainda não pagou o certificado e você ainda não chamou no WhatsApp. Quem concluiu por último fica em cima.">
                <span>Ainda não chamados</span>
              </Dica>
              <span className="rounded-full bg-laranja-500 px-2 py-0.5 text-xs font-bold text-white">{naoChamados.length}</span>
            </h3>
            {!naoChamados.length ? (
              <p className="py-3 text-sm text-slate-500">Você já chamou todo mundo. Quando alguém novo concluir um curso, aparece aqui.</p>
            ) : (
              <ListaCert lista={naoChamados} />
            )}

            {jaChamados.length > 0 && (
              <div className="mt-6 border-t border-slate-200 pt-5">
                <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-600">
                  <Dica texto="Quem você já chamou no WhatsApp e ainda não pagou. Quem foi chamado por último fica em cima. Quando a pessoa paga, ela sai desta lista sozinha.">
                    <span>Já chamados, aguardando pagamento</span>
                  </Dica>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">{jaChamados.length}</span>
                </h3>
                <ListaCert lista={jaChamados} />
              </div>
            )}
          </>
        )}
      </Caixa>
    </>
  );
}
