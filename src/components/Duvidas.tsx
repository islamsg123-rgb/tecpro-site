import { IconeChevron } from "./Icones";

export type Pergunta = { p: string; r: string };

export function Duvidas({ perguntas }: { perguntas: Pergunta[] }) {
  return (
    <div className="divide-y divide-slate-200 overflow-hidden rounded-3xl border border-slate-200 bg-white">
      {perguntas.map((q) => (
        <details key={q.p} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-semibold text-marca-900 hover:bg-marca-50/60">
            {q.p}
            <IconeChevron className="seta h-5 w-5 shrink-0 text-slate-400 transition" />
          </summary>
          <p className="px-6 pb-6 text-sm leading-relaxed text-slate-600">{q.r}</p>
        </details>
      ))}
    </div>
  );
}
