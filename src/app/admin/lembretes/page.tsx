import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/lib/admin";
import { ultimaAtividadePorAluno } from "@/lib/dados";
import { emailConfigurado } from "@/lib/email";
import {
  cursosParados, descadastrados, etapaPara, linkContinuar, listarLembretes, obterConfigLembretes, ultimaRodada,
  type AlunoParado, type ConfigLembretes, type RegistroLembrete,
} from "@/lib/lembretes";
import { AvisoSql, Numero, Titulo, Vazio } from "@/components/admin/Blocos";
import { Dica } from "@/components/admin/Dica";
import { enviarTeste, rodarAgora, salvarLembretes } from "./acoes";

export const metadata: Metadata = { title: "Lembretes de estudo" };
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Props = { searchParams: Promise<{ salvo?: string; erro?: string; teste?: string; erroTeste?: string; rodou?: string; ver?: string }> };

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

const campoNum = "w-20 rounded-xl border border-slate-300 px-3 py-2 text-center text-marca-900";

export default async function Lembretes({ searchParams }: Props) {
  await exigirAdmin("alunos");
  const q = await searchParams;
  const cfg = await obterConfigLembretes();
  const [parados, historico, sairam, atividade, rodada] = await Promise.all([
    cursosParados(Math.min(...cfg.dias)).catch(() => [] as AlunoParado[]),
    listarLembretes(120),
    descadastrados().catch(() => new Set<string>()),
    ultimaAtividadePorAluno().catch(() => new Map<string, string>()),
    ultimaRodada().catch(() => null),
  ]);
  const cronOk = Boolean(process.env.CRON_SECRET);
  const enviados = historico.lista.filter((h) => h.status === "enviado");
  const voltou = (h: RegistroLembrete) => {
    const a = atividade.get(h.email);
    return Boolean(a && new Date(a).getTime() > new Date(h.enviadoEm).getTime());
  };
  const ultimos30 = enviados.filter((h) => Date.now() - new Date(h.enviadoEm).getTime() < 30 * 86_400_000);
  const alunos30 = new Set(ultimos30.map((h) => h.email));
  const voltaram30 = new Set(ultimos30.filter(voltou).map((h) => h.email));
  const ultimoDoPar = new Map<string, RegistroLembrete>();
  for (const h of enviados) if (!ultimoDoPar.has(`${h.email}|${h.cursoId}`)) ultimoDoPar.set(`${h.email}|${h.cursoId}`, h);
  const mostrar = q.ver === "todos" ? parados : parados.slice(0, 100);

  return (
    <>
      <Titulo
        descricao={<>Quando um aluno começa um curso, não termina e fica alguns dias sem estudar, o site manda sozinho um e-mail chamando ele de volta, com o progresso e um botão <strong>Continuar de onde parei</strong>. São no máximo 3 lembretes; se o aluno voltar a estudar, a contagem recomeça. Quem concluiu o curso não recebe.</>}
      >
        Lembretes de estudo
      </Titulo>

      {historico.tabelaFaltando && <AvisoSql arquivo="lembretes-estudo.sql" />}
      {q.salvo && <Aviso cor="verde">Configuração salva.</Aviso>}
      {q.teste && <Aviso cor="verde">Mandamos os 3 modelos de lembrete para <strong>{q.teste}</strong>. Confira a caixa de entrada (e o spam).</Aviso>}
      {q.erroTeste && <Aviso cor="vermelho">Não deu para mandar o teste: {q.erroTeste}</Aviso>}

      <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Dica texto={cfg.ligado ? "Os lembretes saem sozinhos todo dia às 10h (horário de Brasília)." : "Nenhum lembrete é enviado. Marque “Ligar os lembretes automáticos” abaixo e salve."}>
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${cfg.ligado ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>
              {cfg.ligado ? "● Ligado: todo dia às 10h" : "○ Desligado"}
            </span>
          </Dica>
          <Item ok={emailConfigurado} sim="E-mail (Resend) configurado" nao="Falta RESEND_API_KEY na Vercel" dica="O Resend é o serviço que entrega os e-mails do site." />
          <Item ok={cronOk} sim="Envio diário configurado" nao="Falta CRON_SECRET na Vercel" dica="CRON_SECRET é uma senha que a Vercel usa para disparar o envio diário. Sem ela, o envio automático não acontece (o botão Rodar agora funciona)." />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {[1, 2, 3].map((n) => (
            <a key={n} href={`/admin/lembretes/previa?etapa=${n}`} target="_blank" rel="noopener" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-marca-900 hover:border-marca-900">
              Ver {n}º e-mail
            </a>
          ))}
          <form action={enviarTeste}>
            <button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-marca-900 hover:border-marca-900">Mandar os 3 para o meu e-mail</button>
          </form>
          {cfg.ligado && (
            <form action={rodarAgora}>
              <Dica texto="Manda agora os lembretes de hoje, sem esperar as 10h. Quem já recebeu não recebe de novo." temLink>
                <button className="rounded-full bg-laranja-500 px-4 py-2 text-sm font-bold text-marca-900 hover:bg-laranja-400">Rodar agora</button>
              </Dica>
            </form>
          )}
        </div>
        {rodada && (
          <div id="rodada" className={`mt-5 rounded-2xl p-4 text-sm ${rodada.erroGeral ? "bg-red-50 text-red-800" : "bg-slate-50 text-slate-700"}`}>
            <p>
              <strong>Última rodada</strong> ({rodada.origem === "painel" ? "pelo botão" : "automática"}, {dataHora(rodada.quando)}):{" "}
              {rodada.erroGeral ? `deu erro: ${rodada.erroGeral}` : `${rodada.enviados} ${rodada.enviados === 1 ? "e-mail enviado" : "e-mails enviados"}${rodada.erros ? `, ${rodada.erros} com erro` : ""}.`}
            </p>
            {rodada.pulados.map((p) => <p key={p} className="mt-1 text-slate-500">{p}</p>)}
            {rodada.detalhes.map((d) => <p key={d} className="mt-1 break-words font-mono text-xs text-red-700">{d}</p>)}
          </div>
        )}
      </section>

      <div className="mb-8 grid gap-3 sm:grid-cols-4">
        <Numero rotulo="Parados agora" valor={String(new Set(parados.map((p) => p.email)).size)} cor="laranja" href="#parados" dica={`Alunos com curso começado e não concluído, há ${cfg.dias[0]} dias ou mais sem estudar.`} />
        <Numero rotulo="Lembrados (30 dias)" valor={String(alunos30.size)} detalhe={`${ultimos30.length} e-mails`} href="#enviados" dica="Alunos que receberam pelo menos um lembrete nos últimos 30 dias." />
        <Numero rotulo="Voltaram a estudar" valor={String(voltaram30.size)} cor="verde" detalhe={alunos30.size ? `${Math.round((voltaram30.size / alunos30.size) * 100)}% dos lembrados` : undefined} dica="Dos alunos lembrados nos últimos 30 dias, quantos estudaram alguma aula depois do e-mail." />
        <Numero rotulo="Não querem lembretes" valor={String(sairam.size)} cor="cinza" dica="Clicaram no link do fim do e-mail para não receber mais lembretes. O site respeita (LGPD)." />
      </div>

      <Config cfg={cfg} erro={q.erro} />

      <h2 id="parados" className="mt-12 scroll-mt-24 text-xl font-bold text-marca-900">Alunos parados agora</h2>
      <p className="mt-1 text-sm text-slate-500">
        Quem está há {cfg.dias[0]} dias ou mais sem estudar um curso que começou. Use <strong>Chamar no WhatsApp</strong> para mandar a mensagem pronta (abre o seu WhatsApp com o texto preenchido).
      </p>
      {!parados.length ? (
        <div className="mt-4"><Vazio>Ninguém parado agora. 🎉</Vazio></div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Aluno</th>
                <th className="px-5 py-3 font-semibold">Curso</th>
                <th className="px-5 py-3 font-semibold">Sem estudar</th>
                <th className="px-5 py-3 font-semibold">E-mail de lembrete</th>
                <th className="px-5 py-3 font-semibold">WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mostrar.map((p) => {
                const ultimo = ultimoDoPar.get(`${p.email}|${p.cursoId}`);
                const desta = ultimo && new Date(ultimo.ultimaAtividade).getTime() === new Date(p.ultimaAtividade).getTime() ? ultimo : null;
                return (
                  <tr key={`${p.email}|${p.cursoId}`} className="hover:bg-marca-50/50">
                    <td className="px-5 py-3">
                      <Link href={`/admin/alunos/ficha?email=${encodeURIComponent(p.email)}`} className="font-medium text-marca-900 underline decoration-laranja-500 underline-offset-4">{p.nome ?? p.email}</Link>
                      <span className="block text-xs text-slate-500">{p.email}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="block max-w-[240px] truncate" title={p.cursoNome}>{p.cursoNome}</span>
                      <Dica texto={`${p.feitas} de ${p.total} aulas concluídas.`}>
                        <span className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200"><span className="block h-full bg-laranja-500" style={{ width: `${p.pct}%` }} /></span>
                          {p.pct}%
                        </span>
                      </Dica>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.diasParado >= 30 ? "bg-red-100 text-red-700" : p.diasParado >= 7 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
                        {p.diasParado} dias
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600"><SituacaoEmail p={p} cfg={cfg} enviado={desta} saiu={sairam.has(p.email)} /></td>
                    <td className="px-5 py-3">
                      {p.telefone ? (
                        <a href={linkWhatsapp(p, cfg)} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#25D366] px-3 py-2 text-xs font-bold text-white hover:bg-[#1ebe5a]">
                          Chamar no WhatsApp
                        </a>
                      ) : (
                        <Dica texto="Este aluno não tem celular cadastrado. Dá para incluir na ficha do aluno."><span className="text-xs text-slate-400">sem celular</span></Dica>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {parados.length > mostrar.length && (
            <p className="border-t border-slate-100 p-4 text-center text-sm"><Link href="/admin/lembretes?ver=todos#parados" className="font-semibold text-marca-700">Ver todos os {parados.length}</Link></p>
          )}
        </div>
      )}

      <h2 id="enviados" className="mt-12 scroll-mt-24 text-xl font-bold text-marca-900">Lembretes enviados</h2>
      <p className="mt-1 text-sm text-slate-500">Os últimos 200 e-mails de lembrete, mais recentes primeiro.</p>
      {!historico.lista.length ? (
        <div className="mt-4"><Vazio>Nenhum lembrete enviado ainda.</Vazio></div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Quando</th>
                <th className="px-5 py-3 font-semibold">Aluno</th>
                <th className="px-5 py-3 font-semibold">Curso</th>
                <th className="px-5 py-3 font-semibold">Lembrete</th>
                <th className="px-5 py-3 font-semibold">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historico.lista.slice(0, 200).map((h) => (
                <tr key={h.id}>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-500">{dataHora(h.enviadoEm)}</td>
                  <td className="px-5 py-3">
                    <Link href={`/admin/alunos/ficha?email=${encodeURIComponent(h.email)}`} className="text-marca-900 underline decoration-laranja-500 underline-offset-4">{h.nome ?? h.email}</Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{h.cursoNome}{h.progressoPct !== null && <span className="text-slate-400"> · {h.progressoPct}%</span>}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-600">{h.etapa}º ({h.diasParado} dias)</td>
                  <td className="px-5 py-3">
                    {h.status === "erro" ? (
                      <Dica texto={h.detalhe ?? "Erro ao enviar."}><span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">não enviado</span></Dica>
                    ) : voltou(h) ? (
                      <Dica texto="O aluno estudou alguma aula depois deste e-mail."><span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">voltou a estudar ✓</span></Dica>
                    ) : (
                      <Dica texto="E-mail entregue ao Resend. O aluno ainda não voltou a estudar."><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">enviado</span></Dica>
                    )}
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

function Aviso({ cor, children }: { cor: "verde" | "vermelho"; children: React.ReactNode }) {
  const c = cor === "verde" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800";
  return <p className={`mb-5 rounded-2xl border p-4 text-sm ${c}`}>{children}</p>;
}

function Item({ ok, sim, nao, dica }: { ok: boolean; sim: string; nao: string; dica: string }) {
  return (
    <Dica texto={dica}>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ok ? "bg-green-50 text-green-700" : "bg-amber-100 text-amber-800"}`}>
        {ok ? `✓ ${sim}` : `! ${nao}`}
      </span>
    </Dica>
  );
}

function SituacaoEmail({ p, cfg, enviado, saiu }: { p: AlunoParado; cfg: ConfigLembretes; enviado: RegistroLembrete | null; saiu: boolean }) {
  if (saiu) return <>pediu para não receber</>;
  if (p.diasParado > cfg.limiteDias) {
    return <Dica texto={`Parado há mais de ${cfg.limiteDias} dias: o e-mail automático não vai para ele. Chame no WhatsApp.`}><span>parado há muito tempo</span></Dica>;
  }
  const etapa = etapaPara(p.diasParado, cfg);
  const proximo = cfg.dias.find((d) => d > p.diasParado);
  return (
    <>
      {enviado ? <span className="block">{enviado.etapa}º enviado em {new Date(enviado.enviadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span> : etapa ? <span className="block">{etapa}º sai {cfg.ligado ? "na próxima rodada" : "quando ligar"}</span> : null}
      {proximo ? <span className="block text-slate-400">próximo com {proximo} dias</span> : <span className="block text-slate-400">último lembrete</span>}
    </>
  );
}

function linkWhatsapp(p: AlunoParado, cfg: ConfigLembretes) {
  const texto = cfg.mensagemWhatsapp
    .replaceAll("{nome}", (p.nome ?? "").trim().split(/\s+/)[0] ?? "")
    .replaceAll("{curso}", p.cursoNome)
    .replaceAll("{progresso}", `${p.pct}%`)
    .replaceAll("{dias}", String(p.diasParado))
    .replaceAll("{link}", linkContinuar(p.cursoSlug));
  const numero = (p.telefone ?? "").replace(/\D/g, "");
  const comPais = numero.length <= 11 ? `55${numero}` : numero;
  return `https://wa.me/${comPais}?text=${encodeURIComponent(texto)}`;
}

function Config({ cfg, erro }: { cfg: ConfigLembretes; erro?: string }) {
  return (
    <form id="config" action={salvarLembretes} className="scroll-mt-24 space-y-5 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
      <h2 className="text-lg font-bold text-marca-900">Configuração</h2>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 has-[:checked]:border-marca-900 has-[:checked]:bg-marca-50">
        <input type="checkbox" name="ligado" defaultChecked={cfg.ligado} className="mt-1 h-4 w-4 accent-marca-900" />
        <span>
          <span className="block font-semibold text-marca-900">Ligar os lembretes automáticos por e-mail</span>
          <span className="block text-sm text-slate-500">Todo dia às 10h (horário de Brasília) o site procura quem parou de estudar e manda o e-mail.</span>
        </span>
      </label>
      <div>
        <p className="font-semibold text-marca-900">Quando mandar</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span>1º lembrete com</span><input name="d1" type="number" min={1} max={60} defaultValue={cfg.dias[0]} className={campoNum} />
          <span>dias, 2º com</span><input name="d2" type="number" min={1} max={90} defaultValue={cfg.dias[1]} className={campoNum} />
          <span>e 3º com</span><input name="d3" type="number" min={1} max={120} defaultValue={cfg.dias[2]} className={campoNum} />
          <span>dias sem estudar. Depois do 3º, para.</span>
        </div>
        {erro === "dias" && <p className="mt-2 text-sm text-red-700">Os dias precisam ser crescentes (ex.: 3, 7 e 14).</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-600">
          <span className="font-semibold text-marca-900">Não mandar para quem parou há mais de</span>
          <span className="mt-2 flex items-center gap-2"><input name="limite" type="number" min={1} max={365} defaultValue={cfg.limiteDias} className={campoNum} /> dias</span>
          <span className="mt-1 block text-xs text-slate-500">Evita mandar e-mail para quem sumiu há meses. Esses aparecem na lista abaixo para chamar no WhatsApp.</span>
          {erro === "limite" && <span className="mt-1 block text-red-700">Precisa ser igual ou maior que o dia do 3º lembrete.</span>}
        </label>
        <label className="block text-sm text-slate-600">
          <span className="font-semibold text-marca-900">Máximo de e-mails por dia</span>
          <span className="mt-2 flex items-center gap-2"><input name="maximo" type="number" min={1} max={1000} defaultValue={cfg.maximoPorDia} className={campoNum} /> e-mails</span>
          <span className="mt-1 block text-xs text-slate-500">O plano grátis do Resend manda até 100 e-mails por dia, somando todos os e-mails do site.</span>
          {erro === "maximo" && <span className="mt-1 block text-red-700">Informe um número entre 1 e 1000.</span>}
        </label>
      </div>
      <label className="block">
        <span className="font-semibold text-marca-900">Mensagem pronta do WhatsApp</span>
        <span className="mt-1 block text-xs text-slate-500">
          Usada no botão Chamar no WhatsApp. O site troca <code>{"{nome}"}</code>, <code>{"{curso}"}</code>, <code>{"{progresso}"}</code>, <code>{"{dias}"}</code> e <code>{"{link}"}</code> pelos dados do aluno.
        </span>
        <textarea name="mensagemWhatsapp" rows={8} defaultValue={cfg.mensagemWhatsapp} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-marca-900" />
      </label>
      <button className="rounded-full bg-marca-900 px-6 py-3 font-bold text-white hover:bg-marca-700">Salvar</button>
    </form>
  );
}
