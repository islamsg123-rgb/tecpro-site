import { dataHoraBR } from "@/lib/admin-relatorios";
import { NOME_TIPO_EMAIL, type EmailEnviado } from "@/lib/dados/emails";
import { Dica } from "@/components/admin/Dica";
import { Itens, Recolhivel } from "@/components/ListaRecolhida";

/** Seção "E-mails enviados" da ficha do aluno: cada e-mail que a escola mandou e o que a pessoa fez com ele. */

const SITUACAO: Record<string, [string, string, string]> = {
  agendado: ["Agendado", "bg-slate-100 text-slate-600", "Ainda não saiu: o Resend guarda e entrega no horário marcado."],
  cancelado: ["Cancelado", "bg-slate-100 text-slate-500", "Estava agendado e foi cancelado antes de sair (ex.: o aluno pagou o certificado antes)."],
  enviado: ["Enviado", "bg-slate-100 text-slate-700", "Saiu do site. O aviso de entrega do Resend ainda não chegou (e-mails mandados antes do webhook ser cadastrado ficam assim)."],
  atrasado: ["Atrasando", "bg-amber-100 text-amber-800", "O provedor da pessoa ainda não aceitou. O Resend continua tentando."],
  entregue: ["Entregue", "bg-green-100 text-green-800", "Chegou na caixa de e-mail da pessoa (pode ter ido para Promoções ou Spam)."],
  voltou: ["Voltou", "bg-red-100 text-red-700", "O e-mail não chegou: o endereço não existe, está cheio ou recusou. Confira se o e-mail está escrito certo."],
  falhou: ["Não saiu", "bg-red-100 text-red-700", "O Resend não conseguiu mandar este e-mail."],
  erro: ["Não saiu", "bg-red-100 text-red-700", "O site tentou mandar e deu erro (veja o motivo abaixo)."],
  spam: ["Marcou como spam", "bg-red-100 text-red-700", "A pessoa marcou este e-mail como spam. O Resend não manda mais nada para ela."],
};

const pilula = "rounded-full px-2.5 py-1 text-xs font-semibold";

/**
 * Agendado com horário que já passou = o Resend já mandou no horário marcado.
 * (O aviso de entrega só chega se o webhook estava cadastrado naquela hora.)
 */
function situacao(m: EmailEnviado): string {
  if (m.status === "agendado" && m.agendadoPara && new Date(m.agendadoPara).getTime() < Date.now()) return "enviado";
  return m.status;
}

function Pilulas({ m }: { m: EmailEnviado }) {
  const st = situacao(m);
  const [rotulo, cls, explica] = SITUACAO[st] ?? [st, "bg-slate-100 text-slate-600", ""];
  const textoSituacao = st === "agendado" && m.agendadoPara ? `Agendado para ${dataHoraBR(m.agendadoPara)}` : rotulo;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Dica texto={explica}><span className={`${pilula} ${cls}`}>{textoSituacao}</span></Dica>
      {m.aberturas > 0 && (
        <Dica texto={`Abriu ${m.aberturas === 1 ? "1 vez" : `${m.aberturas} vezes`}. Primeira vez: ${dataHoraBR(m.abertoEm)}.`}>
          <span className={`${pilula} bg-blue-100 text-blue-800`}>Abriu{m.aberturas > 1 ? ` ${m.aberturas}x` : ""}</span>
        </Dica>
      )}
      {m.cliques > 0 && (
        <Dica texto={`Clicou ${m.cliques === 1 ? "1 vez" : `${m.cliques} vezes`} em links do e-mail. Primeira vez: ${dataHoraBR(m.clicadoEm)}.`}>
          <span className={`${pilula} bg-orange-100 text-orange-800`}>Clicou{m.cliques > 1 ? ` ${m.cliques}x` : ""}</span>
        </Dica>
      )}
    </span>
  );
}

/** Link clicado, em forma curta e legível (sem códigos de login). */
function linkCurto(l: string): string {
  try {
    const u = new URL(l);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return l.slice(0, 80);
  }
}

export function HistoricoEmails({ emails, endereco }: { emails: EmailEnviado[] | null; endereco: string }) {
  if (emails === null) {
    return (
      <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Para guardar o histórico de e-mails, falta rodar o SQL novo no Supabase (historico-emails.sql).
      </p>
    );
  }
  if (!emails.length) {
    return (
      <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        Nenhum e-mail anotado para {endereco} ainda. O histórico começa a contar a partir da publicação desta função.
      </p>
    );
  }
  const saiu = emails.filter((m) => !["agendado", "cancelado", "erro", "falhou"].includes(situacao(m)));
  const abertos = saiu.filter((m) => m.aberturas > 0).length;
  const clicados = saiu.filter((m) => m.cliques > 0).length;
  const problemas = emails.filter((m) => ["voltou", "spam", "falhou", "erro"].includes(m.status)).length;

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-slate-600">Recebeu <strong className="text-marca-900">{saiu.length}</strong></p>
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-slate-600">Abriu <strong className="text-marca-900">{abertos}</strong></p>
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-slate-600">Clicou em <strong className="text-marca-900">{clicados}</strong></p>
        {problemas > 0 && (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-red-700">Com problema <strong>{problemas}</strong></p>
        )}
      </div>
      <Recolhivel total={emails.length} mostrar={5} className="mt-3"><ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white text-sm"><Itens>
        {emails.map((m) => (
          <li key={m.id}>
            <details className="group px-5 py-3">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 [&::-webkit-details-marker]:hidden">
                <span className="w-full shrink-0 text-xs text-slate-400 sm:w-36 sm:text-sm">{dataHoraBR(m.criadoEm)}</span>
                <span className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                  <span className="font-semibold text-marca-900">{NOME_TIPO_EMAIL[m.tipo] ?? m.tipo}</span>
                  {m.cursoNome && <span className="text-slate-500"> · {m.cursoNome}</span>}
                  {m.assunto && <span className="block truncate text-xs text-slate-400">{m.assunto}</span>}
                </span>
                <Pilulas m={m} />
                <span className="ml-auto text-xs text-slate-400 group-open:rotate-180 sm:ml-0" aria-hidden>▾</span>
              </summary>
              <dl className="mt-3 grid gap-x-6 gap-y-2 rounded-xl bg-slate-50 p-4 text-xs sm:grid-cols-2">
                <div><dt className="text-slate-500">Assunto</dt><dd className="font-medium text-marca-900">{m.assunto ?? "—"}</dd></div>
                <div><dt className="text-slate-500">{situacao(m) === "agendado" ? "Vai sair em" : "Saiu em"}</dt><dd className="font-medium text-marca-900">{dataHoraBR(m.agendadoPara ?? m.criadoEm)}</dd></div>
                <div><dt className="text-slate-500">Entregue</dt><dd className="font-medium text-marca-900">{m.entregueEm ? dataHoraBR(m.entregueEm) : "—"}</dd></div>
                <div>
                  <dt className="text-slate-500">Aberto</dt>
                  <dd className="font-medium text-marca-900">
                    {m.aberturas ? `${m.aberturas === 1 ? "1 vez" : `${m.aberturas} vezes`} · primeira em ${dataHoraBR(m.abertoEm)}${m.ultimaAbertura && m.aberturas > 1 ? ` · última em ${dataHoraBR(m.ultimaAbertura)}` : ""}` : "não abriu (ou o aplicativo de e-mail não avisou)"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Cliques</dt>
                  <dd className="font-medium text-marca-900">
                    {m.cliques ? (
                      <>
                        {m.cliques === 1 ? "1 clique" : `${m.cliques} cliques`} · primeiro em {dataHoraBR(m.clicadoEm)}
                        {m.links.length > 0 && (
                          <ul className="mt-1 list-disc pl-5 font-normal text-slate-600">
                            {m.links.map((l) => <li key={l} className="break-all">{linkCurto(l)}</li>)}
                          </ul>
                        )}
                      </>
                    ) : "nenhum clique"}
                  </dd>
                </div>
                {m.detalhe && (
                  <div className="sm:col-span-2"><dt className="text-slate-500">Motivo</dt><dd className="font-medium text-red-700">{m.detalhe}</dd></div>
                )}
              </dl>
            </details>
          </li>
        ))}
      </Itens></ul></Recolhivel>
      <p className="mt-2 text-xs text-slate-400">
        Abertura é aproximada: o Mail do iPhone às vezes conta como aberto sozinho, e alguns aplicativos bloqueiam a contagem. Clique é mais confiável.
      </p>
    </>
  );
}
