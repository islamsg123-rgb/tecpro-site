"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconeMenu } from "./Icones";

/**
 * Menu do celular (três tracinhos).
 * Fecha ao tocar fora dele, ao tocar num link, ao trocar de página e com a tecla Esc.
 */
export function MenuCelular({ links }: { links: { href: string; rotulo: string }[] }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setAberto(false), [pathname]);

  useEffect(() => {
    if (!aberto) return;
    const tocouFora = (e: PointerEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("pointerdown", tocouFora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", tocouFora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const fechar = () => setAberto(false);

  return (
    <div ref={caixa} className="relative lg:hidden">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-label={aberto ? "Fechar menu" : "Abrir menu"}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/10"
      >
        <IconeMenu />
      </button>
      {aberto && (
        <div className="absolute right-0 top-12 w-60 overflow-hidden rounded-2xl border border-white/10 bg-marca-800 p-2 shadow-2xl">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={fechar} className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10">
              {l.rotulo}
            </Link>
          ))}
          <Link href="/minha-conta" onClick={fechar} className="mt-1 block rounded-xl bg-laranja-500 px-4 py-3 text-center text-sm font-bold text-marca-900">
            Área do aluno
          </Link>
        </div>
      )}
    </div>
  );
}
