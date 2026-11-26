"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Plaquinha no canto do painel, em todas as telas: "Online agora · 8 na loja · 4 no portal".
 * Bem por cima, sem detalhes; o botão "Ver no Analytics" abre a página com os detalhes.
 * Atualiza a cada 30 segundos (2 minutos com a aba escondida).
 */
const INTERVALO = 30_000;
const INTERVALO_ESCONDIDA = 120_000;

export function OnlinePlaquinha() {
  const pathname = usePathname();
  const [n, setN] = useState<{ loja: number; aluno: number } | null>(null);

  useEffect(() => {
    let parado = false;
    let t: ReturnType<typeof setTimeout>;
    const buscar = async () => {
      try {
        const r = await fetch("/api/admin/online?resumo=1", { cache: "no-store" });
        if (r.ok && !parado) setN(await r.json());
      } catch {
        /* tenta de novo na próxima */
      }
      if (!parado) t = setTimeout(buscar, document.visibilityState === "visible" ? INTERVALO : INTERVALO_ESCONDIDA);
    };
    buscar();
    const aoVoltar = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(t);
        buscar();
      }
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      parado = true;
      clearTimeout(t);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, []);

  if (pathname === "/admin/online") return null;
  const total = n ? n.loja + n.aluno : 0;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-neutral-950 py-1.5 pl-3.5 pr-1.5 text-xs text-white shadow-2xl ring-1 ring-white/15 print:hidden">
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
        {total > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${total > 0 ? "bg-emerald-400" : "bg-white/30"}`} />
      </span>
      <span className="hidden font-semibold sm:inline">Online agora</span>
      <span className="text-white/80">
        <strong className="text-white">{n ? n.loja : "–"}</strong> na loja · <strong className="text-white">{n ? n.aluno : "–"}</strong> no portal
      </span>
      <Link href="/admin/online" className="rounded-full bg-laranja-500 px-3 py-1.5 font-bold text-marca-900 hover:bg-laranja-400">
        Ver no Analytics
      </Link>
    </div>
  );
}
