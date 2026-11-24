import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/lib/admin";
import { listarMensagens, TIPOS_AJUDA, type MensagemAjuda } from "@/lib/dados/mensagens";
import { AvisoSql, Numero, Titulo, Vazio } from "@/components/admin/Blocos";
import { anotarMensagem, excluirMensagem, marcarResolvida } from "./acoes";

export const metadata: Metadata = { title: "Mensagens" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ status?: string; tipo?: string }> };

const corTipo: Record<string, string> = {
  video: "bg-purple-100 text-purple-800",
  erro: "bg-red-100 text-red-700",
  acesso: "bg-blue-100 text-blue-800",
  pagamento: "bg-emerald-100 text-emerald-800",
  certificado: "bg-amber-100 text-amber-900",
  duvida: "bg-sky-100 text-sky-800",
  outro: "bg-slate-100 text-slate-700",
};

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** "Chrome no Android", "Safari no iPhone"... só para dar uma ideia do aparelho. */
function aparelho(ua: string | null): string | null {
  if (!ua) return null;
  const so = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : null;
  const nav = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : null;
  return [nav, so].filter(Boolean).join(" no ") || null;
}

function linkWhats(tel: string) {
  const d = tel.replace(/\D/g, "");
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}`;
}

function Cartao({ m }: { m: MensagemAjuda }) {
  const assunto = encodeURIComponent(`Re: ${TIPOS_AJUDA[m.tipo]} · Tecpro Multi Ensino`);
  const corpo = encodeURIComponent(`Olá${m.nome ? `, ${m.nome.split(" ")[0]}` : ""}!\n\nRecebemos sua mensagem:\n"${m.mensagem.slice(0, 400)}"\n\n`);
  const ap = aparelho(m.navegador);
  return (
    <li id={`m${m.id}`} className={`rounded-2xl border bg-white p-5 ${m.status === "nova" ? "border-laranja-500/60 shadow-sm" : "border-slate-200 opacity-90"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${corTipo[m.tipo] ?? corTipo.outro}`}>{TIPOS_AJUDA[m.tipo]}</span>
            {m.status === "nova"
              ? <span className="rounded-full bg-laranja-500 px-2.5 py-1 text-xs font-bold text-marca-900">Nova</span>
              : <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">Resolvida</span>}
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${m.origem === "aluno" ? "bg-marca-50 text-marca-700" : "bg-slate-100 text-slate-600"}`}>
              {m.origem === "aluno" ? "Veio da Área do aluno" : m.logado ? "Veio da Loja virtual (com login)" : "Veio da Loja virtual"}
            </span>
            <span className="text-xs text-slate-500">{quando(m.criadoEm)}</span>
          </div>
          <p className="mt-2 font-semibold text-marca-900">
            {m.logado && m.email
              ? <Link href={`/admin/alunos/ficha?email=${encodeURIComponent(m.email)}`} className="hover:underline">{m.nome ?? m.email}</Link>
              : m.nome ?? "Sem nome"}
            {m.email && <span className="ml-2 break-all text-sm font-normal text-slate-500">{m.email}</span>}
            {m.telefone && <span className="ml-2 whitespace-nowrap text-sm font-normal text-slate-500">· {m.telefone}</span>}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {[
              m.cursoNome && `Curso: ${m.cursoNome}`,
              m.aulaTitulo && `Aula: ${m.aulaTitulo}`,
              ap,
            ].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-[15px] text-slate-800">{m.mensagem}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {m.pagina && <a href={m.pagina} target="_blank" rel="noopener noreferrer" className="text-marca-700 underline">Abrir a página onde estava</a>}
        {m.print && <a href={`/admin/mensagens/imagem/${m.id}`} target="_blank" rel="noopener noreferrer" className="text-marca-700 underline">Ver print anexado</a>}
      </div>

      {m.anotacao && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Anotação da equipe:</strong> {m.anotacao}</p>}
      {m.status === "resolvida" && m.resolvidaEm && <p className="mt-2 text-xs text-slate-500">Resolvida em {quando(m.resolvidaEm)}{m.resolvidaPor ? ` por ${m.resolvidaPor}` : ""}.</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <form action={marcarResolvida}>
          <input type="hidden" name="id" value={m.id} />
          {m.status === "resolvida" && <input type="hidden" name="reabrir" value="1" />}
          <button className={`rounded-full px-4 py-2 text-sm font-semibold ${m.status === "nova" ? "bg-marca-900 text-white hover:bg-marca-800" : "border border-slate-200 text-slate-600 hover:border-marca-900"}`}>
            {m.status === "nova" ? "✓ Marcar como resolvida" : "Reabrir"}
          </button>
        </form>
        {m.email && <a href={`mailto:${m.email}?subject=${assunto}&body=${corpo}`} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-marca-900 hover:border-marca-900">Responder por e-mail</a>}
        {m.telefone && <a href={linkWhats(m.telefone)} target="_blank" rel="noopener noreferrer" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-marca-900">Chamar no WhatsApp</a>}
        <details className="group">
          <summary className="cursor-pointer list-none rounded-full px-3 py-2 text-sm font-semibold text-slate-500 hover:text-marca-900">{m.anotacao ? "Editar anotação" : "Anotar"}</summary>
          <form action={anotarMensagem} className="mt-2 flex w-full flex-wrap gap-2 sm:w-[420px]">
            <input type="hidden" name="id" value={m.id} />
            <input name="anotacao" defaultValue={m.anotacao ?? ""} placeholder="Ex.: liguei para o aluno, vídeo trocado" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            <button className="rounded-full bg-marca-900 px-4 py-2 text-sm font-semibold text-white">Salvar</button>
          </form>
        </details>
        <form action={excluirMensagem} className="ml-auto">
          <input type="hidden" name="id" value={m.id} />
          <button className="text-xs text-slate-400 hover:text-red-600">Excluir</button>
        </form>
      </div>
    </li>
  );
}

export default async function Mensagens({ searchParams }: Props) {
  await exigirAdmin("mensagens");
  const { status = "novas", tipo = "" } = await searchParams;
  const { lista: todas, tabelaFaltando } = await listarMensagens();
  const novas = todas.filter((m) => m.status === "nova").length;
  const resolvidas = todas.length - novas;
  const lista = todas.filter((m) => (status === "todas" || (status === "resolvidas" ? m.status === "resolvida" : m.status === "nova")) && (!tipo || m.tipo === tipo));
  const filtro = (s: string, t = tipo) => `/admin/mensagens?status=${s}${t ? `&tipo=${t}` : ""}`;

  return (
    <>
      <Titulo descricao="Mensagens enviadas pelo botão de ajuda do site. Cada uma mostra de onde veio: da Área do aluno (já é aluno) ou da Loja virtual (vitrine, login, pagamento).">Mensagens</Titulo>
      {tabelaFaltando && <AvisoSql arquivo="mensagens-ajuda.sql" />}

      <div className="grid gap-4 sm:grid-cols-3">
        <Numero rotulo="Novas (para resolver)" valor={String(novas)} cor={novas ? "laranja" : "cinza"} href={filtro("novas", "")} />
        <Numero rotulo="Resolvidas" valor={String(resolvidas)} cor="verde" href={filtro("resolvidas", "")} />
        <Numero rotulo="Total recebidas" valor={String(todas.length)} href={filtro("todas", "")} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {[["novas", "Novas"], ["resolvidas", "Resolvidas"], ["todas", "Todas"]].map(([s, r]) => (
          <Link key={s} href={filtro(s)} className={`rounded-full px-4 py-2 text-sm font-semibold ${status === s ? "bg-marca-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-marca-900"}`}>{r}</Link>
        ))}
        <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
        <form className="flex items-center gap-2">
          <input type="hidden" name="status" value={status} />
          <select name="tipo" defaultValue={tipo} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="">Todos os assuntos</option>
            {Object.entries(TIPOS_AJUDA).map(([id, r]) => <option key={id} value={id}>{r}</option>)}
          </select>
          <button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:border-marca-900">Filtrar</button>
        </form>
      </div>

      <div className="mt-6">
        {!lista.length ? (
          <Vazio>{status === "novas" ? "Nenhuma mensagem nova. Tudo em dia!" : "Nenhuma mensagem aqui."}</Vazio>
        ) : (
          <ul className="space-y-3">{lista.map((m) => <Cartao key={m.id} m={m} />)}</ul>
        )}
      </div>
    </>
  );
}
