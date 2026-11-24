"use client";

/*
 * Barra de carregamento no topo da tela (azul-marinho e laranja).
 * Aparece no instante do clique em qualquer link interno do site e some
 * quando a página nova termina de abrir. Assim o aluno sabe que o clique
 * funcionou, mesmo quando a página demora alguns segundos.
 */
import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function linkInterno(e: MouseEvent): URL | null {
  // Escuta na fase de captura: o Link do Next ainda não cancelou o clique.
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as Element | null)?.closest?.("a");
  if (!a || !a.href || a.hasAttribute("download")) return null;
  if (a.target && a.target !== "_self") return null;
  const destino = new URL(a.href, location.href);
  if (destino.origin !== location.origin) return null;
  // Só muda o "#" (ex.: pular para uma seção da mesma página): não há carregamento.
  if (destino.pathname === location.pathname && destino.search === location.search) return null;
  // Arquivos baixados (PDF, Excel) não trocam de página.
  if (/\/(api|admin\/exportar)\//.test(destino.pathname) || /\.(pdf|xlsx?|csv|zip)$/i.test(destino.pathname)) return null;
  return destino;
}

function Barra() {
  const pathname = usePathname();
  const busca = useSearchParams()?.toString();
  const [pct, setPct] = useState(0);
  const [visivel, setVisivel] = useState(false);
  const ativo = useRef(false);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);
  const limite = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parar = () => {
    if (relogio.current) clearInterval(relogio.current);
    if (limite.current) clearTimeout(limite.current);
    relogio.current = limite.current = null;
  };

  const concluir = () => {
    if (!ativo.current) return;
    ativo.current = false;
    parar();
    setPct(100);
    setTimeout(() => {
      setVisivel(false);
      setTimeout(() => !ativo.current && setPct(0), 250);
    }, 220);
  };

  useEffect(() => {
    const iniciar = () => {
      parar();
      ativo.current = true;
      setVisivel(true);
      setPct(12);
      // Avança rápido no começo e cada vez mais devagar, sem nunca chegar a 100%.
      relogio.current = setInterval(() => setPct((p) => (p < 90 ? p + (90 - p) * 0.08 : p)), 200);
      // Segurança: se a página não trocar (ex.: erro de rede), a barra some sozinha.
      limite.current = setTimeout(concluir, 20000);
    };
    const aoClicar = (e: MouseEvent) => linkInterno(e) && iniciar();
    const aoVoltar = () => iniciar();
    document.addEventListener("click", aoClicar, true);
    window.addEventListener("popstate", aoVoltar);
    return () => {
      document.removeEventListener("click", aoClicar, true);
      window.removeEventListener("popstate", aoVoltar);
      parar();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A página nova abriu: completa a barra e esconde.
  useEffect(() => {
    concluir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, busca]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 transition-opacity duration-300"
      style={{ opacity: visivel ? 1 : 0 }}
    >
      <div
        className="h-full bg-gradient-to-r from-marca-700 via-laranja-500 to-laranja-400 shadow-[0_0_10px_rgba(255,165,0,0.7)]"
        style={{ width: `${pct}%`, transition: pct === 0 ? "none" : "width 200ms ease-out" }}
      />
    </div>
  );
}

export function BarraCarregamento() {
  return (
    <Suspense fallback={null}>
      <Barra />
    </Suspense>
  );
}
