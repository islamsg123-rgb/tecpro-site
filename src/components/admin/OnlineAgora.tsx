"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PaginaOnline, PessoaNoCheckout, RespostaOnline } from "@/lib/online";

/**
 * Quadro "Online agora" do Painel rápido: quantas pessoas estão no site neste momento e onde.
 * Atualiza sozinho a cada 20 segundos (1 minuto se a aba do painel estiver escondida).
 */

const INTERVALO = 20_000;
const INTERVALO_ESCONDIDA = 60_000;

const PAGINAS_LOJA: { k: PaginaOnline; rotulo: string }[] = [
  { k: "inicio", rotulo: "Página inicial" },
  { k: "catalogo", rotulo: "Catálogo de cursos" },
  { k: "curso", rotulo: "Página de um curso" },
  { k: "cadastro", rotulo: "Cadastro em curso grátis" },
  { k: "checkout", rotulo: "Pagamento de curso pago" },
  { k: "pagando", rotulo: "Esperando Pix ou boleto" },
  { k: "outra", rotulo: "Outras páginas (entrar, ajuda...)" },
];

const pessoas = (n: number) => (n === 1 ? "1 pessoa" : `${n} pessoas`);

export function OnlineAgora() {
  const [dados, setDados] = useState<RespostaOnline | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let parado = false;
    let t: ReturnType<typeof setTimeout>;
    const buscar = async () => {
      try {
        const r = await fetch("/api/admin/online", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const d = (await r.json()) as RespostaOnline;
        if (!parado) {
          setDados(d);
          setErro(false);
        }
      } catch {
        if (!parado) setErro(true);
      }
      if (!parado) t = setTimeout(buscar, document.visibilityState === "visible" ? INTERVALO : INTERVALO_ESCONDIDA);
    };
    buscar();
    const aoVoltar = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(t);
        buscar();
      }
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      parado = true;
      clearTimeout(t);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, []);

  const total = dados ? dados.loja.total + dados.aluno.total : 0;

  return (
    <section className="mb-6 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-base font-bold text-marca-900">
          <span className="relative flex h-3 w-3" aria-hidden>
            {total > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
            <span className={`relative inline-flex h-3 w-3 rounded-full ${total > 0 ? "bg-emerald-500" : "bg-slate-300"}`} />
          </span>
          Online agora
          {dados && <span className="font-display text-2xl font-bold text-marca-900">{total}</span>}
          {dados && <span className="text-sm font-normal text-slate-500">{total === 1 ? "pessoa no site" : "pessoas no site"}</span>}
        </h2>
        <span className="text-xs text-slate-400">
          {erro ? "Sem conexão, tentando de novo..." : dados ? `Atualiza sozinho · ${new Date(dados.atualizadoEm).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}` : "Carregando..."}
        </span>
      </div>

      {dados?.tabelaFaltando && (
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Falta um passo no banco:</strong> rode o arquivo <code>online-agora.sql</code> no Supabase (SQL Editor &gt; New query &gt; colar &gt; Run). Até lá, este quadro fica zerado.
        </p>
      )}

      {dados && (
        <>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {/* Loja */}
            <div className="min-w-0 rounded-xl bg-slate-50 p-4">
              <p className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-marca-900">Na loja</span>
                <span className="text-sm text-slate-500"><strong className="text-lg text-marca-900">{dados.loja.total}</strong> {dados.loja.total === 1 ? "pessoa" : "pessoas"}</span>
              </p>
              {dados.loja.total === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Ninguém olhando a loja neste momento.</p>
              ) : (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {PAGINAS_LOJA.filter((p) => dados.loja.paginas[p.k]).map((p) => {
                    const destaque = p.k === "checkout" || p.k === "pagando";
                    const gratis = p.k === "cadastro";
                    return (
                      <li key={p.k} className={`flex justify-between gap-3 ${destaque ? "font-semibold text-laranja-600" : gratis ? "font-semibold text-marca-700" : "text-slate-600"}`}>
                        <span>{p.rotulo}</span>
                        <span>{dados.loja.paginas[p.k]}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {dados.loja.cursosVistos.length > 0 && (
                <p className="mt-3 text-xs text-slate-500">
                  <span className="font-semibold text-slate-600">Cursos sendo vistos: </span>
                  {dados.loja.cursosVistos.map((c) => `${c.nome}${c.n > 1 ? ` (${c.n})` : ""}`).join(" · ")}
                </p>
              )}
              <ListaPessoas
                titulo="No pagamento agora"
                explica="Curso pago, Pix ou boleto, ou aluno pagando o certificado."
                pessoas={dados.loja.noCheckout}
                cor="laranja"
              />
              <ListaPessoas
                titulo="Se cadastrando em curso grátis"
                explica="Não pagam nada agora: só preenchem os dados para começar."
                pessoas={dados.loja.cadastroGratis}
                cor="azul"
              />
            </div>

            {/* Área do aluno */}
            <div className="min-w-0 rounded-xl bg-slate-50 p-4">
              <p className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-marca-900">Na área do aluno</span>
                <span className="text-sm text-slate-500"><strong className="text-lg text-marca-900">{dados.aluno.total}</strong> {dados.aluno.total === 1 ? "aluno" : "alunos"}</span>
              </p>
              {dados.aluno.total === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Nenhum aluno estudando neste momento.</p>
              ) : (
                <>
                  <p className="mt-3 text-sm text-slate-600">
                    <strong className="text-emerald-700">{pessoas(dados.aluno.assistindo)}</strong> assistindo aula
                    {dados.aluno.total > dados.aluno.assistindo && <> · {dados.aluno.total - dados.aluno.assistindo} em Meus cursos ou certificado</>}
                  </p>
                  {dados.aluno.porCurso.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {dados.aluno.porCurso.map((c) => (
                        <li key={c.nome} className="text-sm">
                          <div className="flex justify-between gap-3">
                            <span className="truncate text-slate-700">{c.nome}</span>
                            <span className="shrink-0 font-semibold text-marca-900">{c.n}</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-slate-200">
                            <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${Math.max(8, (c.n / Math.max(1, dados.aluno.assistindo)) * 100)}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>

          {/* De onde vieram os que estão online */}
          {total > 0 && dados.origemAgora?.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-bold text-marca-900">Chegaram por:</span>
              {dados.origemAgora.map((o) => (
                <span key={o.nome} className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  {o.nome.replace(" (digitou o endereço)", "")} <strong className="text-marca-900">{o.n}</strong>
                </span>
              ))}
            </div>
          )}

          {/* Hoje */}
          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
            <span className="font-bold text-marca-900">Hoje:</span>
            <span title="Navegadores diferentes que abriram o site hoje (a mesma pessoa no celular e no computador conta 2).">
              <strong className="text-marca-900">{dados.hoje.visitas}</strong> {dados.hoje.visitas === 1 ? "visitante" : "visitantes"}
            </span>
            {dados.hoje.cadastros !== null && (
              <span title="Pessoas que se matricularam pela primeira vez hoje (curso grátis ou pago).">
                <strong className="text-marca-900">{dados.hoje.cadastros}</strong> {dados.hoje.cadastros === 1 ? "cadastro novo" : "cadastros novos"}
              </span>
            )}
            {dados.hoje.vendas !== null && (
              <Link href="/admin/financeiro" className="hover:text-marca-700" title="Pagamentos confirmados hoje. Os valores ficam no Financeiro.">
                <strong className="text-marca-900">{dados.hoje.vendas}</strong> {dados.hoje.vendas === 1 ? "venda" : "vendas"} <span className="text-xs text-slate-400">(valores no Financeiro)</span>
              </Link>
            )}
          </div>
        </>
      )}
    </section>
  );
}

const SITUACAO: Record<PessoaNoCheckout["pagina"], [string, string]> = {
  checkout: ["na tela de pagamento", "preenchendo nome e e-mail"],
  pagando: ["esperando Pix ou boleto", "esperando Pix ou boleto"],
  certificado: ["pagando o certificado", "pagando o certificado"],
  cadastro: ["no cadastro grátis", "no cadastro grátis"],
};

function ListaPessoas({ titulo, explica, pessoas, cor }: { titulo: string; explica: string; pessoas: PessoaNoCheckout[]; cor: "laranja" | "azul" }) {
  if (!pessoas.length) return null;
  const borda = cor === "laranja" ? "border-laranja-500/40" : "border-marca-700/30";
  const texto = cor === "laranja" ? "text-laranja-600" : "text-marca-700";
  return (
    <div className={`mt-4 rounded-xl border ${borda} bg-white p-3`}>
      <p className={`text-xs font-bold uppercase tracking-wide ${texto}`}>{titulo} ({pessoas.length})</p>
      <p className="text-xs text-slate-400">{explica}</p>
      <ul className="mt-2 divide-y divide-slate-100">
        {pessoas.map((p, i) => (
          <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-marca-900">
                {p.ficha ? <Link href={p.ficha} className="hover:text-marca-700">{p.nome ?? p.email}</Link> : p.nome ?? p.email ?? "Visitante (ainda não digitou os dados)"}
              </span>
              <span className="block text-xs text-slate-500">
                {p.curso ?? "Curso"} · {SITUACAO[p.pagina][p.email ? 0 : 1]}
              </span>
            </span>
            {p.whatsapp && (
              <a href={p.whatsapp} target="_blank" rel="noreferrer" className="shrink-0 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">
                WhatsApp
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
