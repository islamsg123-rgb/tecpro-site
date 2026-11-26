import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/lib/admin";
import { ultimaAtividadePorAluno } from "@/lib/dados";
import { emailConfigurado } from "@/lib/email";
import {
  descadastrados, etapaPara, faltaSqlTipos, linkContinuar, listarLembretes, listasDoPainel, NOME_TIPO, obterConfigLembretes, ultimaRodada,
  type AlunoParado, type ConfigLembretes, type PessoaSemAula, type RegistroLembrete, type TipoLembrete,
} from "@/lib/lembretes";
import { AvisoSql, Numero, Titulo, Vazio } from "@/components/admin/Blocos";
import { Dica } from "@/components/admin/Dica";
import { Itens, Recolhivel } from "@/components/ListaRecolhida";
import { rodarAgora, salvarLembretes, testeCertificado, testeNunca, testeParado } from "./acoes";
import {
  listarEmailsCertificado, NOME_EMAIL_CERTIFICADO, situacaoReal, type RegistroEmailCertificado, type TipoEmailCertificado,
} from "@/lib/lembrete-certificado";

export const metadata: Metadata = { title: "Lembretes de estudo" };
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Props = { searchParams: Promise<{ salvo?: string; erro?: string; teste?: string; erroTeste?: string; rodou?: string; }> };

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
/** Dia (AAAA-MM-DD) no horário de Belém. */
const diaBelem = (d: string | number) => new Date(d).toLocaleDateString("sv-SE", { timeZone: "America/Belem" });
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Belem", hour: "2-digit", minute: "2-digit" });

const campoNum = "w-20 rounded-xl border border-slate-300 px-3 py-2 text-center text-marca-900";
const ficha = (email: string) => `/admin/alunos/ficha?email=${encodeURIComponent(email)}`;

export default async function Lembretes({ searchParams }: Props) {
  await exigirAdmin("alunos");
  const q = await searchParams;
  const cfg = await obterConfigLembretes();
  const vazio = { parados: [] as AlunoParado[], nunca: [] as PessoaSemAula[] };
  const [listas, historico, sairam, atividade, rodada, faltaTipo] = await Promise.all([
    listasDoPainel(cfg).catch(() => vazio),
    listarLembretes(120),
    descadastrados().catch(() => new Set<string>()),
    ultimaAtividadePorAluno().catch(() => new Map<string, string>()),
    ultimaRodada().catch(() => null),
    faltaSqlTipos(),
  ]);
  const emailsCert = await listarEmailsCertificado(200);
  const { parados, nunca } = listas;
  const cronOk = Boolean(process.env.CRON_SECRET);
  const algumLigado = cfg.ligado || cfg.nuncaComecou.ligado;
  const enviados = historico.lista.filter((h) => h.status === "enviado");
  const voltou = (h: RegistroLembrete) => {
    const a = atividade.get(h.email);
    return Boolean(a && new Date(a).getTime() > new Date(h.enviadoEm).getTime());
  };
  const ultimos30 = enviados.filter((h) => Date.now() - new Date(h.enviadoEm).getTime() < 30 * 86_400_000);
  const alunos30 = new Set(ultimos30.map((h) => h.email));
  const voltaram30 = new Set(ultimos30.filter(voltou).map((h) => h.email));
  const ultimos7 = ultimos30.filter((h) => Date.now() - new Date(h.enviadoEm).getTime() < 7 * 86_400_000);
  const alunos7 = new Set(ultimos7.map((h) => h.email));
  const voltaram7 = new Set(ultimos7.filter(voltou).map((h) => h.email));
  // Voltaram HOJE: foram lembrados (30 dias) e a última aula estudada é de hoje (horário de Belém), depois do e-mail.
  const hoje = diaBelem(Date.now());
  const voltaramHoje: { email: string; nome: string | null; quando: string; lembrete: RegistroLembrete }[] = [];
  for (const h of ultimos30) {
    const a = atividade.get(h.email);
    if (!a || diaBelem(a) !== hoje || !voltou(h) || voltaramHoje.some((v) => v.email === h.email)) continue;
    voltaramHoje.push({ email: h.email, nome: h.nome, quando: a, lembrete: h });
  }
  voltaramHoje.sort((x, y) => y.quando.localeCompare(x.quando));
  const ultimoDoPar = new Map<string, RegistroLembrete>();
  for (const h of enviados) if (!ultimoDoPar.has(`${h.tipo}|${h.email}|${h.cursoId}`)) ultimoDoPar.set(`${h.tipo}|${h.email}|${h.cursoId}`, h);
  const enviadoDesta = (tipo: TipoLembrete, email: string, cursoId: string, ref: string) => {
    const u = ultimoDoPar.get(`${tipo}|${email}|${cursoId}`);
    return u && new Date(u.ultimaAtividade).getTime() === new Date(ref).getTime() ? u : null;
  };

  return (
    <>
      <Titulo
        descricao={<>O site manda sozinho, todo dia às 10h, e-mails chamando de volta dois tipos de aluno: quem <strong>parou de estudar</strong> no meio do curso e quem se <strong>matriculou e nunca abriu uma aula</strong>. Cada tipo liga separado, tem no máximo 3 lembretes e cada pessoa recebe no máximo um e-mail a cada 2 dias.</>}
      >
        Lembretes de estudo
      </Titulo>

      {historico.tabelaFaltando && <AvisoSql arquivo="lembretes-estudo.sql" />}
      {!historico.tabelaFaltando && faltaTipo && <AvisoSql arquivo="lembretes-novos-alunos.sql" />}
      {emailsCert.tabelaFaltando && <AvisoSql arquivo="emails-certificado.sql" />}
      {q.salvo && <Aviso cor="verde">Configuração salva.</Aviso>}
      {q.teste && <Aviso cor="verde">Mandamos os 3 modelos para <strong>{q.teste}</strong>. Confira a caixa de entrada (e o spam).</Aviso>}
      {q.erroTeste && <Aviso cor="vermelho">Não deu para mandar o teste: {q.erroTeste}</Aviso>}

      <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Dica texto={algumLigado ? "Os lembretes ligados saem sozinhos todo dia às 10h (horário de Brasília)." : "Nenhum lembrete é enviado. Ligue os tipos que quiser na Configuração abaixo e salve."}>
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${algumLigado ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>
              {algumLigado ? "● Ligado: todo dia às 10h" : "○ Desligado"}
            </span>
          </Dica>
          <Item ok={emailConfigurado} sim="E-mail (Resend) configurado" nao="Falta RESEND_API_KEY na Vercel" dica="O Resend é o serviço que entrega os e-mails do site." />
          <Item ok={cronOk} sim="Envio diário configurado" nao="Falta CRON_SECRET na Vercel" dica="CRON_SECRET é uma senha que a Vercel usa para disparar o envio diário. Sem ela, o envio automático não acontece (o botão Rodar agora funciona)." />
          {algumLigado && (
            <form action={rodarAgora} className="ml-auto">
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

      <VoltaramHoje lista={voltaramHoje} semana={voltaram7.size} lembrados7={alunos7.size} mes={voltaram30.size} lembrados30={alunos30.size} />

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Numero rotulo="Pararam de estudar" valor={String(new Set(parados.map((p) => p.email)).size)} cor="laranja" href="#parados" dica={`Alunos com curso começado e não concluído, há ${cfg.dias[0]} dias ou mais sem estudar.`} />
        <Numero rotulo="Nunca começaram" valor={String(new Set(nunca.map((p) => p.email)).size)} cor="laranja" href="#nunca" dica="Se matricularam pelo site, mas ainda não abriram nenhuma aula do curso." />
        <Numero rotulo="Lembrados (30 dias)" valor={String(alunos30.size)} detalhe={`${ultimos30.length} e-mails`} href="#enviados" dica="Pessoas que receberam pelo menos um lembrete nos últimos 30 dias." />
        <Numero rotulo="Não querem lembretes" valor={String(sairam.size)} cor="cinza" dica="Clicaram no link do fim do e-mail para não receber mais lembretes. O site respeita (LGPD)." />
      </div>

      <Config cfg={cfg} erro={q.erro} />

      <Secao id="parados" titulo="Pararam de estudar" texto={<>Quem está há {cfg.dias[0]} dias ou mais sem estudar um curso que começou.</>} total={parados.length}>
        {parados.map((p) => (
          <Linha
            key={`${p.email}|${p.cursoId}`} email={p.email} nome={p.nome} curso={p.cursoNome}
            detalhe={<Progresso pct={p.pct} feitas={p.feitas} total={p.total} />}
            dias={p.diasParado} rotuloDias="sem estudar"
            situacao={<SituacaoEmail tipo="parado" dias={p.diasParado} cfg={cfg} enviado={enviadoDesta("parado", p.email, p.cursoId, p.ultimaAtividade)} saiu={sairam.has(p.email)} />}
            whatsapp={p.telefone ? linkWhatsapp(p.telefone, cfg.mensagemWhatsapp, { nome: p.nome, curso: p.cursoNome, progresso: `${p.pct}%`, dias: p.diasParado, link: linkContinuar(p.cursoSlug) }) : null}
          />
        ))}
      </Secao>

      <Secao id="nunca" titulo="Matriculados que nunca começaram" texto="Se matricularam pelo site (pago ou gratuito) e não abriram nenhuma aula daquele curso. Os dias contam desde a matrícula." total={nunca.length}>
        {nunca.map((p) => (
          <Linha
            key={`${p.email}|${p.cursoId}`} email={p.email} nome={p.nome} curso={p.cursoNome}
            detalhe={<span className="text-xs text-slate-500">matriculado em {dataCurta(p.desde)}</span>}
            dias={p.dias} rotuloDias="desde a matrícula"
            situacao={<SituacaoEmail tipo="nunca" dias={p.dias} cfg={cfg} enviado={enviadoDesta("nunca", p.email, p.cursoId, p.desde)} saiu={sairam.has(p.email)} />}
            whatsapp={p.telefone ? linkWhatsapp(p.telefone, cfg.nuncaComecou.mensagemWhatsapp, { nome: p.nome, curso: p.cursoNome, progresso: "0%", dias: p.dias, link: linkContinuar(p.cursoSlug) }) : null}
          />
        ))}
      </Secao>

      <EmailsCertificado lista={emailsCert.lista} />

      <h2 id="enviados" className="mt-12 scroll-mt-24 text-xl font-bold text-marca-900">Lembretes enviados</h2>
      <p className="mt-1 text-sm text-slate-500">Os últimos 200 e-mails de lembrete, mais recentes primeiro.</p>
      {!historico.lista.length ? (
        <div className="mt-4"><Vazio>Nenhum lembrete enviado ainda.</Vazio></div>
      ) : (
        <Recolhivel total={Math.min(historico.lista.length, 200)} className="mt-4">
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Quando</th>
                <th className="px-5 py-3 font-semibold">Pessoa</th>
                <th className="px-5 py-3 font-semibold">Curso</th>
                <th className="px-5 py-3 font-semibold">Lembrete</th>
                <th className="px-5 py-3 font-semibold">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100"><Itens>
              {historico.lista.slice(0, 200).map((h) => (
                <tr key={h.id}>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-500">{dataHora(h.enviadoEm)}</td>
                  <td className="px-5 py-3">
                    <Link href={ficha(h.email)} className="text-marca-900 underline decoration-laranja-500 underline-offset-4">{h.nome ?? h.email}</Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{h.cursoNome}{h.tipo === "parado" && h.progressoPct !== null && <span className="text-slate-400"> · {h.progressoPct}%</span>}</td>
                  <td className="px-5 py-3 text-slate-600">
                    <span className="block whitespace-nowrap">{h.etapa}º ({h.diasParado} dias)</span>
                    <span className="block text-xs text-slate-400">{NOME_TIPO[h.tipo]}</span>
                  </td>
                  <td className="px-5 py-3">
                    {h.status === "erro" ? (
                      <Dica texto={h.detalhe ?? "Erro ao enviar."}><span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">não enviado</span></Dica>
                    ) : voltou(h) ? (
                      <Dica texto="A pessoa estudou alguma aula depois deste e-mail."><span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">voltou a estudar ✓</span></Dica>
                    ) : (
                      <Dica texto="E-mail entregue ao Resend. A pessoa ainda não estudou depois dele."><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">enviado</span></Dica>
                    )}
                  </td>
                </tr>
              ))}
            </Itens></tbody>
          </table>
        </div>
        </Recolhivel>
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

function Progresso({ pct, feitas, total }: { pct: number; feitas: number; total: number }) {
  return (
    <Dica texto={`${feitas} de ${total} aulas concluídas.`}>
      <span className="mt-1 flex items-center gap-2 text-xs text-slate-500">
        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200"><span className="block h-full bg-laranja-500" style={{ width: `${pct}%` }} /></span>
        {pct}%
      </span>
    </Dica>
  );
}

function Secao({ id, titulo, texto, total, children }: { id: string; titulo: string; texto: React.ReactNode; total: number; children: React.ReactNode }) {
  return (
    <>
      <h2 id={id} className="mt-12 scroll-mt-24 text-xl font-bold text-marca-900">{titulo} <span className="text-base font-normal text-slate-400">({total})</span></h2>
      <p className="mt-1 text-sm text-slate-500">{texto} Use <strong>Chamar no WhatsApp</strong> para mandar a mensagem pronta (abre o seu WhatsApp com o texto preenchido).</p>
      {!total ? (
        <div className="mt-4"><Vazio>Ninguém aqui agora. 🎉</Vazio></div>
      ) : (
        <Recolhivel total={total} className="mt-4">
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Pessoa</th>
                <th className="px-5 py-3 font-semibold">Curso</th>
                <th className="px-5 py-3 font-semibold">Dias</th>
                <th className="px-5 py-3 font-semibold">E-mail de lembrete</th>
                <th className="px-5 py-3 font-semibold">WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100"><Itens>{children}</Itens></tbody>
          </table>
        </div>
        </Recolhivel>
      )}
    </>
  );
}

function Linha({ email, nome, curso, detalhe, dias, rotuloDias, situacao, whatsapp }: {
  email: string; nome: string | null; curso: string; detalhe: React.ReactNode; dias: number; rotuloDias: string;
  situacao: React.ReactNode; whatsapp: string | null;
}) {
  return (
    <tr className="hover:bg-marca-50/50">
      <td className="px-5 py-3">
        <Link href={ficha(email)} className="font-medium text-marca-900 underline decoration-laranja-500 underline-offset-4">{nome ?? email}</Link>
        <span className="block text-xs text-slate-500">{email}</span>
      </td>
      <td className="px-5 py-3">
        <span className="block max-w-[240px] truncate" title={curso}>{curso}</span>
        {detalhe}
      </td>
      <td className="whitespace-nowrap px-5 py-3">
        <Dica texto={`${dias} dias ${rotuloDias}.`}>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${dias >= 30 ? "bg-red-100 text-red-700" : dias >= 7 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{dias} dias</span>
        </Dica>
      </td>
      <td className="px-5 py-3 text-xs text-slate-600">{situacao}</td>
      <td className="px-5 py-3">
        {whatsapp ? (
          <a href={whatsapp} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#25D366] px-3 py-2 text-xs font-bold text-white hover:bg-[#1ebe5a]">
            Chamar no WhatsApp
          </a>
        ) : (
          <Dica texto="Sem celular cadastrado."><span className="text-xs text-slate-400">sem celular</span></Dica>
        )}
      </td>
    </tr>
  );
}

function SituacaoEmail({ tipo, dias, cfg, enviado, saiu }: { tipo: TipoLembrete; dias: number; cfg: ConfigLembretes; enviado: RegistroLembrete | null; saiu: boolean }) {
  if (saiu) return <>pediu para não receber</>;
  const grupo = tipo === "parado" ? { ligado: cfg.ligado, dias: cfg.dias } : cfg.nuncaComecou;
  if (dias > cfg.limiteDias) {
    return <Dica texto={`Há mais de ${cfg.limiteDias} dias: o e-mail automático não vai para essa pessoa. Chame no WhatsApp.`}><span>faz muito tempo</span></Dica>;
  }
  const etapa = etapaPara(dias, cfg, tipo);
  const proximo = grupo.dias.find((d) => d > dias);
  return (
    <>
      {enviado ? <span className="block">{enviado.etapa}º enviado em {dataCurta(enviado.enviadoEm)}</span> : etapa ? <span className="block">{etapa}º sai {grupo.ligado ? "na próxima rodada" : "quando ligar"}</span> : null}
      {proximo ? <span className="block text-slate-400">próximo com {proximo} dias</span> : <span className="block text-slate-400">último lembrete</span>}
    </>
  );
}

function linkWhatsapp(telefone: string, modelo: string, d: { nome: string | null; curso: string; progresso: string; dias: number; link: string }) {
  const texto = modelo
    .replaceAll("{nome}", (d.nome ?? "").trim().split(/\s+/)[0] ?? "")
    .replaceAll("{curso}", d.curso)
    .replaceAll("{progresso}", d.progresso)
    .replaceAll("{dias}", String(d.dias))
    .replaceAll("{link}", d.link);
  const numero = telefone.replace(/\D/g, "");
  const comPais = numero.length <= 11 ? `55${numero}` : numero;
  return `https://wa.me/${comPais}?text=${encodeURIComponent(texto)}`;
}

/** Um bloco da configuração: ligar, 3 dias, prévias, teste e mensagem do WhatsApp. */
function Grupo({ tipo, titulo, explica, ligado, nomeLigado, prefixo, dias, rotuloDias, nomeMensagem, mensagem, variaveis }: {
  tipo: TipoLembrete; titulo: string; explica: string; ligado: boolean; nomeLigado: string; prefixo: string; dias: number[];
  rotuloDias: string; nomeMensagem: string; mensagem: string; variaveis: string;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 p-5">
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" name={nomeLigado} defaultChecked={ligado} className="mt-1 h-4 w-4 accent-marca-900" />
        <span>
          <span className="block font-semibold text-marca-900">{titulo}</span>
          <span className="block text-sm text-slate-500">{explica}</span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span>1º com</span><input name={`${prefixo}1`} type="number" min={1} max={120} defaultValue={dias[0]} className={campoNum} />
        <span>dias, 2º com</span><input name={`${prefixo}2`} type="number" min={1} max={120} defaultValue={dias[1]} className={campoNum} />
        <span>e 3º com</span><input name={`${prefixo}3`} type="number" min={1} max={120} defaultValue={dias[2]} className={campoNum} />
        <span>dias {rotuloDias}.</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map((n) => (
          <a key={n} href={`/admin/lembretes/previa?tipo=${tipo}&etapa=${n}`} target="_blank" rel="noopener" className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-marca-900 hover:border-marca-900">
            Ver {n}º e-mail
          </a>
        ))}
        <button formAction={tipo === "nunca" ? testeNunca : testeParado} formNoValidate className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-marca-900 hover:border-marca-900">
          Mandar os 3 para o meu e-mail
        </button>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-marca-700">Mensagem pronta do WhatsApp</summary>
        <span className="mt-2 block text-xs text-slate-500">O site troca {variaveis} pelos dados da pessoa.</span>
        <textarea name={nomeMensagem} rows={7} defaultValue={mensagem} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-marca-900" />
      </details>
    </div>
  );
}

function Config({ cfg, erro }: { cfg: ConfigLembretes; erro?: string }) {
  return (
    <form id="config" action={salvarLembretes} className="scroll-mt-24 space-y-5 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
      <h2 className="text-lg font-bold text-marca-900">Configuração</h2>
      {erro === "dias" && <p className="text-sm text-red-700">Os dias de cada tipo precisam ser crescentes (ex.: 3, 7 e 14).</p>}
      <Grupo
        tipo="parado" titulo="Quem parou de estudar no meio do curso" explica="Começou o curso, não terminou e ficou sem estudar."
        ligado={cfg.ligado} nomeLigado="ligado" prefixo="d" dias={cfg.dias} rotuloDias="sem estudar"
        nomeMensagem="mensagemWhatsapp" mensagem={cfg.mensagemWhatsapp} variaveis="{nome}, {curso}, {progresso}, {dias} e {link}"
      />
      <Grupo
        tipo="nunca" titulo="Quem se matriculou e nunca começou" explica="Fez a matrícula (paga ou gratuita), mas não abriu nenhuma aula. O botão do e-mail leva direto para o curso."
        ligado={cfg.nuncaComecou.ligado} nomeLigado="nLigado" prefixo="n" dias={cfg.nuncaComecou.dias} rotuloDias="depois da matrícula"
        nomeMensagem="nMensagem" mensagem={cfg.nuncaComecou.mensagemWhatsapp} variaveis="{nome}, {curso}, {dias} e {link}"
      />
      <ConfigCertificado cfg={cfg} erro={erro} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-600">
          <span className="font-semibold text-marca-900">Não mandar para quem está assim há mais de</span>
          <span className="mt-2 flex items-center gap-2"><input name="limite" type="number" min={1} max={365} defaultValue={cfg.limiteDias} className={campoNum} /> dias</span>
          <span className="mt-1 block text-xs text-slate-500">Evita mandar e-mail para quem sumiu há meses. Essas pessoas continuam nas listas abaixo para chamar no WhatsApp.</span>
          {erro === "limite" && <span className="mt-1 block text-red-700">Precisa ser igual ou maior que o dia do último lembrete.</span>}
        </label>
        <label className="block text-sm text-slate-600">
          <span className="font-semibold text-marca-900">Máximo de e-mails por dia</span>
          <span className="mt-2 flex items-center gap-2"><input name="maximo" type="number" min={1} max={1000} defaultValue={cfg.maximoPorDia} className={campoNum} /> e-mails</span>
          <span className="mt-1 block text-xs text-slate-500">O plano grátis do Resend manda até 100 e-mails por dia, somando todos os e-mails do site. No plano Pro, pode aumentar.</span>
          {erro === "maximo" && <span className="mt-1 block text-red-700">Informe um número entre 1 e 1000.</span>}
        </label>
      </div>
      <button className="rounded-full bg-marca-900 px-6 py-3 font-bold text-white hover:bg-marca-700">Salvar</button>
    </form>
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
  return (
    <div id="certificado" className="scroll-mt-24 space-y-4 rounded-2xl border border-slate-200 p-5">
      <p className="font-bold text-marca-900">E-mails do certificado</p>
      <p className="-mt-2 text-sm text-slate-500">Estes não esperam as 10h: saem sozinhos no horário certo. Cada um vai no máximo 1 vez por aluno e curso.</p>
      {caixa("cLigado", c.ligado, "Parabéns para quem concluiu e não comprou o certificado",
        <>Curso gratuito concluído, a pessoa viu a tela do certificado e não comprou. O e-mail dá os parabéns, fala da importância do certificado (sem preço) e tem o botão <strong>Emitir meu certificado</strong>. Se ela comprar antes, o e-mail é cancelado.</>)}
      <div className="flex flex-wrap items-center gap-2 pl-7 text-sm text-slate-600">
        <span>Mandar</span><input name="cHoras" type="number" min={1} max={72} defaultValue={c.horas} className={campoNum} />
        <span>{c.horas === 1 ? "hora" : "horas"} depois que a pessoa viu a tela do certificado.</span>
        {erro === "horas" && <span className="w-full text-red-700">Informe de 1 a 72 horas.</span>}
      </div>
      {caixa("cEntrega", c.entrega, "Mandar o certificado por e-mail quando for emitido",
        <>Na hora em que o certificado é emitido, a pessoa recebe o PDF anexo, o link para baixar de novo e o link de validação. Vale para todos os certificados (pagos e grátis).</>)}
      <div className="flex flex-wrap gap-2">
        {(["comprar", "entrega"] as TipoEmailCertificado[]).map((t) => (
          <a key={t} href={`/admin/lembretes/previa?certificado=${t}`} target="_blank" rel="noopener" className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-marca-900 hover:border-marca-900">
            Ver e-mail: {NOME_EMAIL_CERTIFICADO[t]}
          </a>
        ))}
        <button formAction={testeCertificado} formNoValidate className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-marca-900 hover:border-marca-900">
          Mandar os 2 para o meu e-mail
        </button>
      </div>
    </div>
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
      <h2 id="emails-certificado" className="mt-12 scroll-mt-24 text-xl font-bold text-marca-900">E-mails do certificado</h2>
      <p className="mt-1 text-sm text-slate-500">Os últimos 200: parabéns para quem não comprou e certificados mandados em PDF.</p>
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

/** Destaque do topo: quem voltou a estudar HOJE depois de um lembrete. */
function VoltaramHoje({ lista, semana, lembrados7, mes, lembrados30 }: {
  lista: { email: string; nome: string | null; quando: string; lembrete: RegistroLembrete }[];
  semana: number; lembrados7: number; mes: number; lembrados30: number;
}) {
  const n = lista.length;
  return (
    <section id="voltaram-hoje" className="mb-6 scroll-mt-24 rounded-3xl border border-green-200 bg-green-50 p-6">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p className="text-sm font-semibold text-green-800">Voltaram a estudar hoje</p>
          <p className="mt-1 font-display text-5xl font-extrabold text-green-900">{n}</p>
          <p className="mt-1 text-sm text-green-800">{n === 0 ? "Ninguém ainda hoje." : n === 1 ? "pessoa estudou hoje depois de receber um lembrete" : "pessoas estudaram hoje depois de receber um lembrete"}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Dica texto="Das pessoas lembradas nos últimos 7 dias, quantas estudaram alguma aula depois do e-mail.">
            <span className="rounded-full bg-white px-3 py-1.5 text-green-900"><strong>{semana}</strong> nos últimos 7 dias{lembrados7 ? ` (de ${lembrados7} lembrados)` : ""}</span>
          </Dica>
          <Dica texto="Das pessoas lembradas nos últimos 30 dias, quantas estudaram alguma aula depois do e-mail.">
            <span className="rounded-full bg-white px-3 py-1.5 text-green-900"><strong>{mes}</strong> nos últimos 30 dias{lembrados30 ? ` (de ${lembrados30} lembrados)` : ""}</span>
          </Dica>
        </div>
      </div>
      {n > 0 && (
        <Recolhivel total={n} mostrar={5} className="mt-5">
          <ul className="divide-y divide-green-100 overflow-hidden rounded-2xl bg-white text-sm">
            <Itens>
              {lista.map((v) => (
                <li key={v.email} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                  <span>
                    <Link href={ficha(v.email)} className="font-medium text-marca-900 underline decoration-laranja-500 underline-offset-4">{v.nome ?? v.email}</Link>
                    <span className="block text-xs text-slate-500">{v.lembrete.cursoNome} · recebeu o {v.lembrete.etapa}º lembrete em {dataCurta(v.lembrete.enviadoEm)}</span>
                  </span>
                  <span className="whitespace-nowrap rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">estudou às {hora(v.quando)}</span>
                </li>
              ))}
            </Itens>
          </ul>
        </Recolhivel>
      )}
    </section>
  );
}
