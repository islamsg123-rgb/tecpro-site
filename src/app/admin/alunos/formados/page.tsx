import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/lib/admin";
import { listarAlunos, obterConfigLoja } from "@/lib/dados";
import { telefonesDosAlunos } from "@/lib/lembretes";
import { linkEmitirCertificado, linkWhatsapp, mensagemCertificado } from "@/lib/whatsapp-certificado";
import { BotaoWhatsCertificado } from "@/components/admin/BotaoWhatsCertificado";
import { formatarPreco } from "@/lib/formatar";
import { listarFormados } from "@/lib/painel-resumo";
import { dataCurta, Numero, Titulo, Vazio } from "@/components/admin/Blocos";
import { BotaoExportar } from "@/components/admin/BotaoExportar";
import { Dica } from "@/components/admin/Dica";

export const metadata: Metadata = { title: "Formados" };
export const dynamic = "force-dynamic";

export default async function Formados() {
  await exigirAdmin("alunos");
  const [formados, alunos, telefones, loja] = await Promise.all([
    listarFormados(), listarAlunos(5000), telefonesDosAlunos().catch(() => new Map<string, string>()), obterConfigLoja(),
  ]);
  const nome = (email: string) => alunos.find((a) => a.email === email)?.nome ?? email;
  const precos = { individual: loja.precoCertIndividual, essencial: loja.precoCertEssencial, profissional: loja.precoCertProfissional };
  const mensagemPara = (f: (typeof formados)[number]) =>
    mensagemCertificado({ nome: nome(f.email), curso: f.cursoNome, link: linkEmitirCertificado(f.cursoSlug), precos });
  const exemplo = formados.find((f) => f.faltaPagarCertificado);
  const emitidos = formados.filter((f) => f.certificado).length;
  const faltaPagar = formados.filter((f) => f.faltaPagarCertificado).length;

  return (
    <>
      <Titulo acao={<BotaoExportar tipo="certificados" />} descricao="Quem concluiu todas as aulas de um curso. Um aluno aparece uma vez para cada curso concluído.">
        Formados
      </Titulo>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Numero rotulo="Cursos concluídos" valor={String(formados.length)} detalhe={`${new Set(formados.map((f) => f.email)).size} pessoas`} dica="Quantos cursos foram terminados (todas as aulas feitas). Embaixo, quantas pessoas diferentes concluíram." />
        <Numero rotulo="Certificados emitidos" valor={String(emitidos)} cor="verde" dica="Certificados que já foram gerados e têm código de validação." />
        <Numero rotulo="Falta pagar o certificado" valor={String(faltaPagar)} cor="laranja" href="/admin/financeiro/devedores" dica="Alunos que concluíram um curso grátis e ainda não pagaram o certificado." />
      </div>
      {exemplo && (
        <details className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-emerald-900">Ver a mensagem que vai no botão Chamar no WhatsApp</summary>
          <p className="mt-2 text-xs text-emerald-900/80">Aparece em quem está com <strong>falta pagar</strong>. O nome, o curso e o link mudam para cada aluno. O link leva direto para a página de emitir o certificado daquele curso (se o aluno não estiver logado, ele entra e volta para lá).</p>
          <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-4 font-sans text-[13px] leading-relaxed text-slate-700 ring-1 ring-emerald-100">{mensagemPara(exemplo)}</pre>
        </details>
      )}
      {!formados.length ? (
        <Vazio>Ninguém concluiu um curso ainda.</Vazio>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Aluno</th>
                <th className="px-5 py-3 font-semibold">Curso</th>
                <th className="px-5 py-3 font-semibold">Certificado</th>
                <th className="px-5 py-3 font-semibold">Emitido em</th>
                <th className="px-5 py-3 font-semibold">Chamar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {formados.map((f) => (
                <tr key={`${f.email}|${f.cursoId}`} className="hover:bg-marca-50/50">
                  <td className="px-5 py-3">
                    <Link href={`/admin/alunos/ficha?email=${encodeURIComponent(f.email)}`} className="font-medium text-marca-900 underline decoration-laranja-500 underline-offset-4">{f.certificado?.nomeAluno ?? nome(f.email)}</Link>
                    <span className="block text-xs text-slate-500">{f.email}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-700">{f.cursoNome}</td>
                  <td className="px-5 py-3">
                    {f.certificado ? (
                      <Dica temLink texto="Certificado já emitido. Este é o código de validação. Clique para abrir a página que confirma que ele é verdadeiro.">
                        <Link href={`/validar/${f.certificado.codigo}`} className="rounded-full bg-green-100 px-2.5 py-1 font-mono text-xs font-semibold text-green-800">{f.certificado.codigo}</Link>
                      </Dica>
                    ) : f.faltaPagarCertificado ? (
                      <Dica texto="Concluiu um curso grátis. O certificado é pago e o aluno ainda não pagou. Aparece aqui mesmo que ele não tenha clicado em emitir.">
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">falta pagar {f.precoCertificadoCentavos ? formatarPreco(f.precoCertificadoCentavos) : ""}</span>
                      </Dica>
                    ) : (
                      <Dica texto="Certificado liberado (curso pago ou certificado já pago), mas o aluno ainda não clicou para gerar.">
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">pode emitir</span>
                      </Dica>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-500">{dataCurta(f.certificado?.emitidoEm)}</td>
                  <td className="px-5 py-3">
                    {f.faltaPagarCertificado ? (
                      <BotaoWhatsCertificado url={telefones.get(f.email.trim().toLowerCase()) ? linkWhatsapp(telefones.get(f.email.trim().toLowerCase())!, mensagemPara(f)) : null} />
                    ) : null}
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
