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
import { nomeForma } from "@/components/admin/EtiquetaSituacao";
import { Caixa, dataCurta, Numero, Titulo, Vazio } from "@/components/admin/Blocos";

export const metadata: Metadata = { title: "Devedores" };
export const dynamic = "force-dynamic";

function linkWhats(telefone: string, texto: string) {
  const n = telefone.replace(/\D/g, "");
  return `https://wa.me/${n.length <= 11 ? `55${n}` : n}?text=${encodeURIComponent(texto)}`;
}

export default async function Devedores() {
  await exigirAdmin("financeiro");
  const [cobrancas, formados, { lista: carrinhos }, telefones, loja, alunos] = await Promise.all([
    cobrancasParaRelatorio(), listarFormados().catch(() => []), listarCarrinhos(2000),
    telefonesDosAlunos().catch(() => new Map<string, string>()), obterConfigLoja(), listarAlunos(5000),
  ]);
  const precos = { individual: loja.precoCertIndividual, essencial: loja.precoCertEssencial, profissional: loja.precoCertProfissional };
  const nomeAluno = (email: string) => alunos.find((a) => a.email === email)?.nome ?? email;
  const devedores = agruparDevedores(cobrancasEmAtraso(cobrancas));
  const total = devedores.reduce((s, d) => s + d.totalCentavos, 0);
  const pendentesCert = formados.filter((f) => f.faltaPagarCertificado);
  const telefone = (email: string) => carrinhos.find((c) => c.email === email && c.telefone)?.telefone ?? null;

  return (
    <>
      <Titulo descricao="Quem gerou Pix ou boleto e deixou vencer. Abaixo, quem concluiu um curso com certificado pago e ainda não pagou a emissão.">
        Devedores
      </Titulo>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Numero rotulo="Total em atraso" valor={formatarPreco(total)} cor="vermelho" dica="Soma dos pagamentos que venceram e não foram pagos." />
        <Numero rotulo="Pessoas devendo" valor={String(devedores.length)} cor="laranja" dica="Quantas pessoas têm pelo menos um pagamento vencido." />
        <Numero rotulo="Certificados a pagar" valor={String(pendentesCert.length)} detalhe="concluíram e ainda não pagaram" dica="Alunos que concluíram um curso grátis e ainda não pagaram o certificado. Não é dívida vencida: é uma venda que pode acontecer." />
      </div>

      <Caixa titulo="Pagamentos vencidos">
        {!devedores.length ? (
          <Vazio>Ninguém com pagamento vencido.</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Pessoa</th>
                  <th className="py-2 pr-4 font-semibold">O que deve</th>
                  <th className="py-2 pr-4 font-semibold">Venceu em</th>
                  <th className="py-2 pr-4 text-right font-semibold">Valor</th>
                  <th className="py-2 font-semibold"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
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
              </tbody>
            </table>
          </div>
        )}
      </Caixa>

      <Caixa titulo="Concluíram e falta pagar o certificado" className="mt-6">
        {!pendentesCert.length ? (
          <Vazio>Ninguém nessa situação agora.</Vazio>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {pendentesCert.map((f) => {
              const fone = telefones.get(f.email.trim().toLowerCase()) ?? telefone(f.email);
              return (
                <li key={`${f.email}|${f.cursoId}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span>
                    <Link href={`/admin/alunos/ficha?email=${encodeURIComponent(f.email)}`} className="font-semibold text-marca-900 underline decoration-laranja-500 underline-offset-4">{nomeAluno(f.email)}</Link>
                    <span className="block text-xs text-slate-500">{f.email} · {f.cursoNome} · certificado {f.precoCertificadoCentavos ? formatarPreco(f.precoCertificadoCentavos) : ""}</span>
                  </span>
                  <BotaoWhatsCertificado url={fone ? linkWhats(fone, mensagemCertificado({ nome: nomeAluno(f.email), curso: f.cursoNome, link: linkEmitirCertificado(f.cursoSlug), precos })) : null} />
                </li>
              );
            })}
          </ul>
        )}
      </Caixa>
    </>
  );
}
