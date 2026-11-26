"use client";

import { Children, createContext, useContext, useRef, useState } from "react";

/**
 * Lista recolhida: mostra só os primeiros itens e um botão "Ver todos" embaixo.
 *
 * Uso (serve para tabela, lista ou cartões):
 *   <Recolhivel total={lista.length} mostrar={10}>
 *     <table>... <tbody><Itens>{lista.map(...)}</Itens></tbody></table>
 *   </Recolhivel>
 *
 * Tudo que estiver dentro de <Itens> é cortado; o resto (cabeçalho, bordas) fica como está.
 * Se a lista for pequena (até `mostrar` + 2 itens), mostra tudo e não aparece botão.
 */

type Estado = { aberto: boolean; mostrar: number };
const Contexto = createContext<Estado>({ aberto: true, mostrar: Infinity });

export function Recolhivel({ total, mostrar = 10, abertoInicial = false, children, className }: {
  total: number; mostrar?: number; abertoInicial?: boolean; children: React.ReactNode; className?: string;
}) {
  const [aberto, setAberto] = useState(abertoInicial);
  const ref = useRef<HTMLDivElement>(null);
  // Não vale a pena esconder 1 ou 2 itens: mostra tudo.
  const precisa = total > mostrar + 2;

  const alternar = () => {
    setAberto((a) => !a);
    // Ao recolher, volta a tela para o começo da lista (senão a pessoa fica "perdida" lá embaixo).
    if (aberto && ref.current && ref.current.getBoundingClientRect().top < 0) {
      ref.current.scrollIntoView({ block: "start" });
    }
  };

  return (
    <Contexto.Provider value={{ aberto: aberto || !precisa, mostrar }}>
      <div ref={ref} className={`scroll-mt-24 ${className ?? ""}`}>
        {children}
        {precisa && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
            {!aberto && <span className="text-slate-500">Mostrando {mostrar} de {total}</span>}
            <button
              type="button"
              onClick={alternar}
              aria-expanded={aberto}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 font-semibold text-marca-900 hover:border-marca-900"
            >
              {aberto ? "Mostrar menos" : `Ver todos (${total})`}
              <span aria-hidden className={`inline-block transition-transform ${aberto ? "rotate-180" : ""}`}>▾</span>
            </button>
          </div>
        )}
      </div>
    </Contexto.Provider>
  );
}

/** Os itens que podem ser escondidos. Fica dentro de <Recolhivel>. */
export function Itens({ children }: { children: React.ReactNode }) {
  const { aberto, mostrar } = useContext(Contexto);
  const lista = Children.toArray(children);
  return <>{aberto ? lista : lista.slice(0, mostrar)}</>;
}
