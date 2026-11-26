import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/lib/admin";
import { emailConfigurado } from "@/lib/email";
import { obterConfigLembretes, type ConfigLembretes } from "@/lib/lembretes";
import {
  listarEmailsCertificado, NOME_EMAIL_CERTIFICADO, sequenciaCertificadoPronta, situacaoReal, type RegistroEmailCertificado, type TipoEmailCertificado,
} from "@/lib/lembrete-certificado";
import { AvisoSql, Titulo, Vazio } from "@/components/admin/Blocos";
import { Dica } from "@/components/admin/Dica";
import { Itens, Recolhivel } from "@/components/ListaRecolhida";
import { salvarEmailsCertificado, testeCertificado } from "./acoes";

/**
 * Mensagens > E-mails: os 3 avisos para quem concluiu e não emitiu o certificado
 * e o e-mail com o certificado em PDF. (Antes ficava em Lembretes de estudo.)
 */
export const metadata: Metadata = { title: "E-mails" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ salvo?: string; erro?: string; teste?: string; erroTeste?: string }> };

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const campoNum = "w-20 rounded-xl border border-slate-300 px-3 py-2 text-center text-marca-900";
const ficha = (email: string) => `/admin/alunos/ficha?email=${encodeURIComponent(email)}`;

function Aviso({ cor, children }: { cor: "verde" | "vermelho"; children: React.ReactNode }) {
  const c = cor === "verde" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800";
  return <p className={`mb-5 rounded-2xl border p-4 text-sm ${c}`}>{children}</p>;
}

export default async function EmailsPage({ searchParams }: Props) {
  await exigirAdmin("mensagens");
  const q = await searchParams;
  const [cfg, emailsCert, sequenciaOk] = await Promise.all([
    obterConfigLembretes(), listarEmailsCertificado(200), sequenciaCertificadoPronta().catch(() => true),
  ]);
  return (
    <>
      <Titulo descricao="E-mails automáticos que o site manda para os alunos sobre o certificado.">Mensagens</Titulo>
      {!emailConfigurado && <Aviso cor="vermelho">O Resend não está configurado na Vercel (RESEND_API_KEY): nenhum e-mail pode sair.</Aviso>}
      {emailsCert.tabelaFaltando && <AvisoSql arquivo="emails-certificado.sql" />}
      {!emailsCert.tabelaFaltando && !sequenciaOk && <AvisoSql arquivo="emails-certificado-3.sql" />}
      {q.salvo && <Aviso cor="verde">Configuração salva.</Aviso>}
      {q.teste && <Aviso cor="verde">Mandamos os 4 e-mails de exemplo para <strong>{q.teste}</strong>. Confira a caixa de entrada (e o spam).</Aviso>}
      {q.erroTeste && <Aviso cor="vermelho">Não deu para mandar o teste: {q.erroTeste}</Aviso>}
      <ConfigCertificado cfg={cfg} erro={q.erro} />
      <EmailsCertificado lista={emailsCert.lista} />
    </>
  );
}

/** Bloco da configuração: e-mails do certificado (saem pelo agendamento do Resend, não pela rodada das 10h). */
function ConfigCertificado({ cfg, erro }: { cfg: ConfigLembretes; erro?: string }) {
  const c = cfg.certificado;
  const caixa = (nome: string, ligado: boolean, titulo: string, explica: React.ReactNode) => (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" name={nome} defaultChecked={ligado} className="mt-1 h-4 w-4 accent-marca-900" />
      <span>
        <span className="block font-semibold text-marca-900">{titulo}</span>
        <span className="block text-sm text-slate-500">{explica}</span>
      </span>
    </label>
  );
  const etapa = (n: number, cor: string, titulo: string, prever: TipoEmailCertificado, filhos: React.ReactNode) => (
    <div className={`rounded-2xl border p-4 ${cor}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-marca-900"><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-marca-900 text-xs text-white">{n}</span>{titulo}</p>
        <a href={`/admin/lembretes/previa?certificado=${prever}`} target="_blank" rel="noopener" className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-marca-900 hover:border-marca-900">
          Ver e-mail
        </a>
      </div>
      <div className="mt-3 space-y-3">{filhos}</div>
    </div>
  );
  const tempoDias = (nome: string, valor: number) => (
    <div className="flex flex-wrap items-center gap-2 pl-7 text-sm text-slate-600">
      <span>Mandar</span><input name={nome} type="number" min={1} max={60} defaultValue={valor} className={campoNum} />
      <span>{valor === 1 ? "dia" : "dias"} depois que a pessoa concluiu o curso (se ainda não emitiu).</span>
    </div>
  );
  return (
    <form id="certificado" action={salvarEmailsCertificado} className="scroll-mt-24 space-y-4 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
      <h2 className="text-lg font-bold text-marca-900">E-mails do certificado</h2>
      <p className="-mt-2 text-sm text-slate-500">
        Três avisos para quem concluiu um curso gratuito e ainda não emitiu o certificado. Saem sozinhos no horário certo,
        cada um no máximo 1 vez por aluno e curso. <strong>Se a pessoa comprar, os que faltam são cancelados.</strong>
      </p>
      {etapa(1, "border-slate-200 bg-white", "Parabéns", "comprar", <>
        {caixa("cLigado", c.ligado, "Ligado",
          <>Dá os parabéns, fala da importância do certificado (sem preço) e tem o botão <strong>Emitir meu certificado</strong>.</>)}
        <div className="flex flex-wrap items-center gap-2 pl-7 text-sm text-slate-600">
          <span>Mandar</span><input name="cHoras" type="number" min={1} max={72} defaultValue={c.horas} className={campoNum} />
          <span>{c.horas === 1 ? "hora" : "horas"} depois que a pessoa concluiu o curso.</span>
          {erro === "horas" && <span className="w-full text-red-700">Informe de 1 a 72 horas.</span>}
        </div>
      </>)}
      {etapa(2, "border-orange-200 bg-orange-50/40", "Convite para emitir (mais firme)", "comprar2", <>
        {caixa("c2Ligado", c.segundo.ligado, "Ligado",
          <>Lembra que ela já fez a parte difícil e mostra onde o certificado faz diferença: currículo, LinkedIn, entrevista, horas complementares.</>)}
        {tempoDias("c2Dias", c.segundo.dias)}
      </>)}
      {etapa(3, "border-red-200 bg-red-50/40", "Último aviso (o mais firme)", "comprar3", <>
        {caixa("c3Ligado", c.terceiro.ligado, "Ligado",
          <>Selo <strong>ÚLTIMO AVISO</strong>: o esforço fica sem comprovação, uma vaga pode aparecer amanhã, e é o último e-mail sobre este certificado. Não ameaça apagar nada (o acesso é vitalício).</>)}
        {tempoDias("c3Dias", c.terceiro.dias)}
      </>)}
      {erro === "diasCert" && <p className="text-sm text-red-700">Informe de 1 a 60 dias, e o 3º precisa sair depois do 2º.</p>}
      <p className="text-xs text-slate-500">O 2º e o 3º são preparados na rodada diária das 10h e guardados no Resend para sair no horário exato. Quem concluiu há muito tempo não recebe e-mails atrasados.</p>
      <div className="border-t border-slate-100 pt-4">
        {caixa("cEntrega", c.entrega, "Mandar o certificado por e-mail quando for emitido",
          <>Separado dos avisos: na hora em que o certificado é emitido, a pessoa recebe o PDF anexo, o link para baixar de novo e o link de validação. Vale para todos os certificados (pagos e grátis).</>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <a href="/admin/lembretes/previa?certificado=entrega" target="_blank" rel="noopener" className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-marca-900 hover:border-marca-900">
          Ver e-mail: {NOME_EMAIL_CERTIFICADO.entrega}
        </a>
        <button formAction={testeCertificado} formNoValidate className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-marca-900 hover:border-marca-900">
          Mandar os 4 para o meu e-mail
        </button>
      </div>
      <button className="rounded-full bg-marca-900 px-6 py-3 font-bold text-white hover:bg-marca-700">Salvar</button>
    </form>
  );
}

const ROTULO_STATUS: Record<RegistroEmailCertificado["status"], { texto: string; cor: string; dica: string }> = {
  reservado: { texto: "preparando", cor: "bg-slate-100 text-slate-600", dica: "O site está preparando este e-mail." },
  agendado: { texto: "agendado", cor: "bg-blue-100 text-blue-800", dica: "Guardado no Resend: sai sozinho no horário mostrado." },
  cancelado: { texto: "cancelado ✓", cor: "bg-green-100 text-green-800", dica: "Não precisou: a pessoa comprou antes do horário." },
  enviado: { texto: "enviado", cor: "bg-slate-100 text-slate-600", dica: "E-mail entregue ao Resend." },
  erro: { texto: "não enviado", cor: "bg-red-100 text-red-700", dica: "Deu erro ao enviar." },
};

function EmailsCertificado({ lista }: { lista: RegistroEmailCertificado[] }) {
  return (
    <>
      <h2 id="emails-certificado" className="mt-12 scroll-mt-24 text-xl font-bold text-marca-900">Últimos e-mails do certificado</h2>
      <p className="mt-1 text-sm text-slate-500">Os últimos 200: os 3 avisos para quem não emitiu e os certificados mandados em PDF.</p>
      {!lista.length ? (
        <div className="mt-4"><Vazio>Nenhum e-mail do certificado ainda.</Vazio></div>
      ) : (
        <Recolhivel total={lista.length} className="mt-4">
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Sai / saiu em</th>
                <th className="px-5 py-3 font-semibold">Pessoa</th>
                <th className="px-5 py-3 font-semibold">Curso</th>
                <th className="px-5 py-3 font-semibold">E-mail</th>
                <th className="px-5 py-3 font-semibold">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100"><Itens>
              {lista.map((r) => {
                const st = ROTULO_STATUS[situacaoReal(r)];
                return (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500">{dataHora(r.agendadoPara ?? r.criadoEm)}</td>
                    <td className="px-5 py-3">
                      <Link href={ficha(r.email)} className="text-marca-900 underline decoration-laranja-500 underline-offset-4">{r.nome ?? r.email}</Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{r.cursoNome ?? r.cursoId}</td>
                    <td className="px-5 py-3 text-slate-600">{NOME_EMAIL_CERTIFICADO[r.tipo]}</td>
                    <td className="px-5 py-3">
                      <Dica texto={r.detalhe ?? st.dica}><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.cor}`}>{st.texto}</span></Dica>
                    </td>
                  </tr>
                );
              })}
            </Itens></tbody>
          </table>
        </div>
        </Recolhivel>
      )}
    </>
  );
}

