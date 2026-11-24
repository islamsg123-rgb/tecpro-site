"use client";

import { useState, useTransition } from "react";
import { prepararPedidoClaude } from "@/app/admin/mensagens/acoes";

/**
 * "Preparar resposta no Claude" (gratuito): o painel monta um pedido com a dúvida,
 * a página de onde veio, os dados do curso e as regras da escola. A equipe abre o
 * Claude (claude.ai) na própria conta, envia o pedido e cola a resposta no Gmail.
 */
const LIMITE_LINK = 6000; // links muito longos podem não abrir; acima disso, só copia.

export function SugestaoIA({ id }: { id: number }) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [preparando, iniciar] = useTransition();

  function preparar() {
    setErro("");
    iniciar(async () => {
      const r = await prepararPedidoClaude(id);
      if (r.texto) setTexto(r.texto);
      else setErro(r.erro ?? "Não foi possível preparar.");
    });
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const campo = document.getElementById(`pedido-${id}`) as HTMLTextAreaElement | null;
      campo?.select();
      document.execCommand?.("copy");
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  }

  const q = encodeURIComponent(texto);
  const link = q.length <= LIMITE_LINK ? `https://claude.ai/new?q=${q}` : "https://claude.ai/new";

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
          onClick={preparar}
          disabled={preparando}
          title="Monta um pedido com a dúvida e os dados do curso para o Claude escrever a resposta (grátis, na sua conta do Claude)"
          className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-800 hover:border-violet-400 disabled:opacity-60"
        >
          {icone} {preparando ? "Preparando…" : "Preparar resposta no Claude"}
        </button>
        {erro && <p className="mt-2 text-sm text-red-700" role="alert">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-violet-900">{icone} Pedido pronto para o Claude</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
        <li>Clique em <b>Abrir o Claude</b>. O pedido já vai copiado{q.length <= LIMITE_LINK ? " e escrito lá" : ""}.</li>
        <li>Se a caixa do Claude estiver vazia, cole com <b>Ctrl+V</b> (no celular, toque e segure e escolha Colar). Depois envie.</li>
        <li>Copie a resposta do Claude, clique em <b>Responder pelo Gmail</b> e cole.</li>
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={copiar}
          className="rounded-full bg-violet-700 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-800"
        >
          Abrir o Claude ↗
        </a>
        <button type="button" onClick={copiar} className="rounded-full px-4 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-100">
          {copiado ? "Copiado ✓" : "Só copiar o pedido"}
        </button>
        <button type="button" onClick={() => setTexto("")} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">
          Fechar
        </button>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-violet-700/80">Ver o texto do pedido</summary>
        <textarea id={`pedido-${id}`} readOnly value={texto} rows={10} className="mt-2 block w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-700" />
      </details>
    </div>
  );
}
