"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Dica que aparece ao deixar o mouse parado em cima (ou ao focar com o teclado).
 * No celular, abre com um toque e fecha ao tocar fora.
 * A caixinha é desenhada solta na tela (fora das tabelas), então nunca fica cortada.
 */
export function Dica({
  texto,
  children,
  className = "",
  bloco = false,
  temLink = false,
}: {
  texto: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** true quando a dica envolve um cartão inteiro (ocupa a largura toda). */
  bloco?: boolean;
  /** true quando o item já é um link ou botão (aí ele mesmo recebe o foco do teclado). */
  temLink?: boolean;
}) {
  const id = useId();
  const alvo = useRef<HTMLSpanElement>(null);
  const caixa = useRef<HTMLSpanElement>(null);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aberta, setAberta] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; seta: number; embaixo: boolean } | null>(null);
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const cancelar = () => {
    if (espera.current) clearTimeout(espera.current);
    espera.current = null;
  };
  const abrir = useCallback((atraso: number) => {
    cancelar();
    espera.current = setTimeout(() => setAberta(true), atraso);
  }, []);
  const fechar = useCallback(() => {
    cancelar();
    setAberta(false);
    setPos(null);
  }, []);

  // Calcula onde a caixinha cabe: em cima do item (ou embaixo, se não houver espaço), sem sair da tela.
  useLayoutEffect(() => {
    if (!aberta || !alvo.current || !caixa.current) return;
    const r = alvo.current.getBoundingClientRect();
    const c = caixa.current.getBoundingClientRect();
    const margem = 8;
    const embaixo = r.top - c.height - 10 < margem;
    const top = embaixo ? r.bottom + 10 : r.top - c.height - 10;
    const centro = r.left + r.width / 2;
    const left = Math.min(Math.max(margem, centro - c.width / 2), (window.visualViewport?.width ?? document.documentElement.clientWidth) - c.width - margem);
    setPos({ top, left, seta: Math.min(Math.max(12, centro - left), c.width - 12), embaixo });
  }, [aberta]);

  useEffect(() => {
    if (!aberta) return;
    const foraDaDica = (e: PointerEvent) => {
      if (!alvo.current?.contains(e.target as Node)) fechar();
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("pointerdown", foraDaDica);
    document.addEventListener("keydown", tecla);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("pointerdown", foraDaDica);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberta, fechar]);

  useEffect(() => cancelar, []);

  return (
    <span
      ref={alvo}
      aria-describedby={id}
      tabIndex={temLink ? undefined : 0}
      className={`${bloco ? "block" : "inline-flex"} ${temLink ? "" : "cursor-help"} rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-laranja-500 ${className}`}
      onPointerEnter={(e) => e.pointerType === "mouse" && abrir(400)}
      onPointerLeave={(e) => e.pointerType === "mouse" && fechar()}
      onPointerUp={(e) => {
        if (e.pointerType !== "mouse") (aberta ? fechar() : abrir(0));
      }}
      onFocus={() => abrir(0)}
      onBlur={fechar}
    >
      {children}
      {/* Texto sempre presente para leitores de tela; a caixinha visível vem logo abaixo. */}
      <span id={id} className="sr-only">{texto}</span>
      {montado && aberta &&
        createPortal(
          <span
            ref={caixa}
            role="tooltip"
            aria-hidden
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
            className={`pointer-events-none fixed z-[100] block w-max max-w-[17rem] rounded-xl bg-marca-900 px-3.5 py-2.5 text-left text-[13px] font-normal normal-case leading-snug tracking-normal text-white shadow-xl ring-1 ring-black/5 transition-opacity duration-150 ${pos ? "opacity-100" : "opacity-0"}`}
          >
            {texto}
            {pos && (
              <span
                className={`absolute h-2.5 w-2.5 rotate-45 bg-marca-900 ${pos.embaixo ? "-top-1" : "-bottom-1"}`}
                style={{ left: pos.seta - 5 }}
              />
            )}
          </span>,
          document.body,
        )}
    </span>
  );
}
