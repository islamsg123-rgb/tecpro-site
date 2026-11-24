"use client";

import { useState, useTransition } from "react";
import { sugerirResposta } from "@/app/admin/mensagens/acoes";

/**
 * Caixa "Resposta sugerida pela IA": gera um texto pronto para responder a pessoa,
 * que dá para ajustar e copiar para colar no Gmail.
 */
export function SugestaoIA({ id, ligada }: { id: number; ligada: boolean }) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [gerando, iniciar] = useTransition();

  function gerar() {
    setErro("");
    setCopiado(false);
    iniciar(async () => {
      const r = await sugerirResposta(id);
      if (r.texto) setTexto(r.texto);
      else setErro(r.erro ?? "Não foi possível gerar.");
    });
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Navegadores antigos: seleciona o texto para a pessoa copiar com Ctrl+C.
      (document.getElementById(`sugestao-${id}`) as HTMLTextAreaElement | null)?.select();
      document.execCommand?.("copy");
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  const icone = (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  );

  if (!texto) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={gerar}
          disabled={gerando}
          title={ligada ? "A IA lê a mensagem e a página de onde veio e escreve uma resposta para você revisar" : "Falta ligar a IA na Vercel"}
          className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-800 hover:border-violet-400 disabled:opacity-60"
        >
          {icone} {gerando ? "Escrevendo a resposta…" : "Sugerir resposta com IA"}
        </button>
        {erro && <p className="mt-2 text-sm text-red-700" role="alert">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-violet-900">{icone} Resposta sugerida pela IA</p>
        <span className="text-xs text-violet-700/80">Revise antes de enviar. Você pode editar aqui.</span>
      </div>
      <textarea
        id={`sugestao-${id}`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={Math.min(14, Math.max(6, texto.split("\n").length + 2))}
        className="mt-2 block w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-[15px] leading-relaxed text-slate-800"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={copiar} className="rounded-full bg-violet-700 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-800">
          {copiado ? "Copiado ✓" : "Copiar resposta"}
        </button>
        <button type="button" onClick={gerar} disabled={gerando} className="rounded-full px-4 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-60">
          {gerando ? "Escrevendo…" : "Gerar outra"}
        </button>
        {erro && <p className="text-sm text-red-700" role="alert">{erro}</p>}
      </div>
    </div>
  );
}
