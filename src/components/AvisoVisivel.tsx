"use client";

import { useEffect, useRef } from "react";

/**
 * Caixa de aviso que, ao aparecer, rola a tela até ela.
 * Usado quando um formulário comprido vira uma mensagem curta ("Confira seu e-mail", "Matrícula feita!"):
 * sem isso a página ficava parada lá embaixo e a pessoa via só o rodapé, principalmente no celular.
 */
export function AvisoVisivel({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Fecha o teclado do celular (que empurra a tela) antes de rolar.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: "start", behavior: reduzir ? "auto" : "smooth" });
      el.focus({ preventScroll: true });
    });
  }, []);
  return (
    <div ref={ref} tabIndex={-1} className={`scroll-mt-24 outline-none ${className ?? ""}`}>
      {children}
    </div>
  );
}
