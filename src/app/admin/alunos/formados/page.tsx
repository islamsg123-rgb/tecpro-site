import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/lib/admin";
import { listarAlunos } from "@/lib/dados";
import { formatarPreco } from "@/lib/formatar";
import { listarFormados } from "@/lib/painel-resumo";
import { dataCurta, Numero, Titulo, Vazio } from "@/components/admin/Blocos";
import { BotaoExportar } from "@/components/admin/BotaoExportar";
import { Dica } from "@/components/admin/Dica";

export const metadata: Metadata = { title: "Formados" };
export const dynamic = "force-dynamic";

export default async function Formados() {
  await exigirAdmin("alunos");
  const [formados, alunos] = await Promise.all([listarFormados(), listarAlunos(5000)]);
  const nome = (email: string) => alunos.find((a) => a.email === email)?.nome ?? email;
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
      {!formados.length ? (
        <Vazio>Ninguém concluiu um curso ainda.</Vazio>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Aluno</th>
                <th className="px-5 py-3 font-semibold">Curso</th>
                <th className="px-5 py-3 font-semibold">Certificado</th>
                <th className="px-5 py-3 font-semibold">Emitido em</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
