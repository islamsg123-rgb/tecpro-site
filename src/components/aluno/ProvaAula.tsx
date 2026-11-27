"use client";

import { useActionState, useEffect, useState } from "react";
import { corrigirProva, reportarQuestao } from "@/app/minha-conta/acoes";
import type { PerguntaPublica, ResultadoProva } from "@/lib/provas";

const LETRAS = ["A", "B", "C", "D", "E", "F"];

export function ProvaAula({
  slug, aulaId, perguntas, jaAprovado = false, onAprovado,
}: { slug: string; aulaId: string; perguntas: PerguntaPublica[]; jaAprovado?: boolean; onAprovado?: () => void }) {
  const [resultado, enviar, enviando] = useActionState(corrigirProva, null);
  const [tentativa, setTentativa] = useState(0);
  const [descartado, setDescartado] = useState<ResultadoProva | null>(null);
  const r = resultado && resultado !== descartado ? resultado : null;
  const aprovado = r ? r.acertos === r.total : false;
  useEffect(() => {
    if (resultado && resultado.acertos === resultado.total) onAprovado?.();
  }, [resultado, onAprovado]);

  return (
    <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
      <h2 className="text-xl font-extrabold text-marca-900">Prova da aula</h2>
      <p className="mt-1 text-sm text-slate-500">
        {perguntas.length === 1 ? "1 pergunta" : `${perguntas.length} perguntas`}. Escolha uma alternativa em cada uma e clique em Corrigir.
        {jaAprovado ? " Você já acertou todas as questões desta prova." : " Para liberar a próxima aula, é preciso acertar todas."}
      </p>

      {r && (
        <div className={`mt-5 rounded-2xl p-4 font-semibold ${aprovado ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}>
          Você acertou {r.acertos} de {r.total}. {aprovado ? "Muito bem! Prova aprovada." : "Para liberar a próxima aula você precisa acertar todas. Reveja a aula e refaça a prova."}
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

      {r && !aprovado && <AvisarQuestao slug={slug} aulaId={aulaId} r={r} />}
    </section>
  );
}

/** Link discreto para o aluno avisar a escola que uma questão parece estar com a resposta errada. */
function AvisarQuestao({ slug, aulaId, r }: { slug: string; aulaId: string; r: ResultadoProva }) {
  const erradas = r.corretas.map((c, i) => (r.respostas[i] !== c ? i : -1)).filter((i) => i >= 0);
  const [aberto, setAberto] = useState(false);
  const [questao, setQuestao] = useState(erradas[0] ?? 0);
  const [estado, enviar, enviando] = useActionState(reportarQuestao, {});
  if (!erradas.length) return null;
  if (estado.ok) {
    return (
      <p className="mt-6 rounded-2xl bg-marca-50 p-4 text-sm text-marca-900">
        Obrigado pelo aviso! A equipe vai conferir a questão. Se ela estiver mesmo errada, liberamos a aula para você e avisamos.
      </p>
    );
  }
  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="mt-6 text-sm font-semibold text-slate-500 underline hover:text-marca-900">
        Acha que alguma questão está com a resposta errada? Avise a gente
      </button>
    );
  }
  return (
    <form action={enviar} className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="aulaId" value={aulaId} />
      <input type="hidden" name="marcada" value={r.respostas[questao] ?? -1} />
      <p className="font-semibold text-marca-900">Avisar questão com erro</p>
      <label className="block font-semibold text-marca-900">Qual questão?
        <select name="questao" value={questao + 1} onChange={(e) => setQuestao(Number(e.target.value) - 1)} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal sm:w-48">
          {erradas.map((i) => <option key={i} value={i + 1}>Questão {i + 1}</option>)}
        </select>
      </label>
      <label className="block font-semibold text-marca-900">Por que você acha que está errada? (opcional)
        <textarea name="comentario" maxLength={1000} rows={3} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal" />
      </label>
      {estado.erro && <p className="text-red-700">{estado.erro}</p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={enviando} className="rounded-full bg-marca-900 px-5 py-2 font-bold text-white hover:bg-marca-700 disabled:opacity-60">
          {enviando ? "Enviando..." : "Enviar aviso"}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="rounded-full px-4 py-2 font-semibold text-slate-500 hover:text-marca-900">Cancelar</button>
      </div>
    </form>
  );
}
