"use client";

import { useActionState, useState } from "react";
import { corrigirProva } from "@/app/minha-conta/acoes";
import type { PerguntaPublica, ResultadoProva } from "@/lib/provas";

const LETRAS = ["A", "B", "C", "D", "E", "F"];

export function ProvaAula({ slug, aulaId, perguntas }: { slug: string; aulaId: string; perguntas: PerguntaPublica[] }) {
  const [resultado, enviar, enviando] = useActionState(corrigirProva, null);
  const [tentativa, setTentativa] = useState(0);
  const [descartado, setDescartado] = useState<ResultadoProva | null>(null);
  const r = resultado && resultado !== descartado ? resultado : null;
  const aprovado = r ? r.acertos / r.total >= 0.7 : false;

  return (
    <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
      <h2 className="text-xl font-extrabold text-marca-900">Prova da aula</h2>
      <p className="mt-1 text-sm text-slate-500">
        {perguntas.length === 1 ? "1 pergunta" : `${perguntas.length} perguntas`}. Escolha uma alternativa em cada uma e clique em Corrigir.
      </p>

      {r && (
        <div className={`mt-5 rounded-2xl p-4 font-semibold ${aprovado ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}>
          Você acertou {r.acertos} de {r.total}. {aprovado ? "Muito bem!" : "Reveja a aula e tente de novo."}
        </div>
      )}

      <form key={tentativa} action={enviar} className="mt-6 space-y-8">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="aulaId" value={aulaId} />
        <input type="hidden" name="total" value={perguntas.length} />
        {perguntas.map((p, i) => (
          <fieldset key={i}>
            <legend className="font-semibold text-marca-900">
              {i + 1}. {p.pergunta}
            </legend>
            <div className="mt-3 space-y-2">
              {p.alternativas.map((a, j) => {
                const certa = r && r.corretas[i] === j;
                const errada = r && r.respostas[i] === j && r.corretas[i] !== j;
                return (
                  <label
                    key={j}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                      certa ? "border-green-500 bg-green-50" : errada ? "border-red-400 bg-red-50" : "border-slate-200 hover:border-marca-900"
                    }`}
                  >
                    <input type="radio" name={`q${i}`} value={j} required disabled={!!r} defaultChecked={r?.respostas[i] === j} className="mt-0.5 accent-laranja-500" />
                    <span><b>{LETRAS[j]})</b> {a}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
        {r ? (
          <button type="button" onClick={() => { setDescartado(resultado); setTentativa((t) => t + 1); }} className="rounded-full border-2 border-marca-900 px-6 py-3 font-bold text-marca-900 hover:bg-marca-50">
            Refazer a prova
          </button>
        ) : (
          <button disabled={enviando} className="rounded-full bg-laranja-500 px-6 py-3 font-bold text-marca-900 hover:bg-laranja-400 disabled:opacity-60">
            {enviando ? "Corrigindo..." : "Corrigir"}
          </button>
        )}
      </form>
    </section>
  );
}
