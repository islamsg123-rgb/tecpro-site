"use client";

import { useActionState, useState } from "react";
import { enviarPesquisa } from "@/app/minha-conta/acoes";

/** Botão discreto nas aulas: abre uma pesquisa curta de satisfação (opcional). */
export function BotaoPesquisa({ slug, aulaId }: { slug: string; aulaId: string }) {
  const [aberto, setAberto] = useState(false);
  const [nota, setNota] = useState(0);
  const [estado, enviar, enviando] = useActionState(enviarPesquisa, {});

  if (estado.ok) {
    return <p className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">Obrigado pela sua opinião! Ela ajuda a Tecpro a melhorar.</p>;
  }
  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-laranja-500 hover:text-marca-900">
        <span className="text-laranja-500" aria-hidden>★</span> Avaliar o curso
      </button>
    );
  }
  return (
    <form action={enviar} className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="aulaId" value={aulaId} />
      <input type="hidden" name="nota" value={nota || ""} />
      <div className="flex items-start justify-between gap-3">
        <p className="font-bold text-marca-900">Como está sendo o curso para você?</p>
        <button type="button" onClick={() => setAberto(false)} className="text-sm text-slate-400 hover:text-marca-900">Fechar</button>
      </div>
      <div className="mt-3 flex gap-1" role="radiogroup" aria-label="Nota de 1 a 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n} type="button" role="radio" aria-checked={nota === n} aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
            onClick={() => setNota(n)}
            className={`text-3xl leading-none transition-transform hover:scale-110 ${n <= nota ? "text-laranja-500" : "text-slate-300"}`}
          >
            ★
          </button>
        ))}
      </div>
      <label className="mt-4 block text-sm font-semibold text-marca-900">
        De 0 a 10, quanto você indicaria a Tecpro para um amigo? <span className="font-normal text-slate-400">(opcional)</span>
        <select name="recomenda" defaultValue="" className="mt-1 block rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal">
          <option value="">—</option>
          {Array.from({ length: 11 }, (_, i) => 10 - i).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <label className="mt-4 block text-sm font-semibold text-marca-900">
        Quer contar algo? <span className="font-normal text-slate-400">(opcional)</span>
        <textarea name="comentario" rows={3} maxLength={1500} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 font-normal" placeholder="O que você mais gostou, o que podemos melhorar…" />
      </label>
      {estado.erro && <p className="mt-3 text-sm text-red-700">{estado.erro}</p>}
      <button disabled={!nota || enviando} className="mt-4 rounded-full bg-laranja-500 px-6 py-2.5 font-bold text-marca-900 hover:bg-laranja-400 disabled:opacity-50">
        {enviando ? "Enviando…" : "Enviar"}
      </button>
    </form>
  );
}
