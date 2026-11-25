"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ChavePaineis } from "./ChavePaineis";
import { AvisoVendas } from "./AvisoVendas";
import { NOME_AREA, areaDoCaminho, temDuasAreas, type Contadores, type Secao } from "./MenuLateral";
import { definirModoAluno } from "../VoltarAoPainel";

/**
 * Barra preta no topo do painel: deixa claro que você está no painel, não no site.
 * Tem a chave Gestão | Financeiro, o som de nova venda e o botão "Ver como aluno".
 * A linha colorida embaixo muda com a área: laranja na Gestão, verde no Financeiro.
 */
export function BarraPainel({ secoes, contadores, veFinanceiro }: { secoes: Secao[]; contadores: Contadores; veFinanceiro: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const area = areaDoCaminho(pathname);
  const duas = temDuasAreas(secoes);
  // Voltou ao painel: sai do modo "ver como aluno".
  useEffect(() => definirModoAluno(false), []);

  function verComoAluno() {
    definirModoAluno(true);
    router.push("/");
  }

  return (
    <header className={`sticky top-0 z-40 border-b-[3px] bg-neutral-950 print:hidden ${area === "financeiro" && duas ? "border-emerald-400" : "border-laranja-500"}`}>
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
        <Link href="/admin" className="flex shrink-0 items-center gap-3" aria-label="Painel, início">
          <Image src="/logo-tecpro-transparente.png" alt="Tecpro" width={88} height={32} className="hidden h-8 w-auto sm:block" priority />
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-laranja-500 text-sm font-extrabold text-marca-900 sm:hidden">T</span>
          <span className="hidden rounded-md border border-white/25 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-white/80 lg:inline">Painel</span>
        </Link>

        <div className="flex min-w-0 flex-1 justify-center">
          {duas ? (
            <ChavePaineis secoes={secoes} contadores={contadores} />
          ) : (
            <span className="truncate text-sm font-bold uppercase tracking-wider text-white">{NOME_AREA[area]}</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {veFinanceiro && <AvisoVendas />}
          <button
            type="button"
            onClick={verComoAluno}
            title="Abre o site como um aluno vê, sem nada do painel. Um botão no canto traz você de volta."
            className="flex items-center gap-2 rounded-full border border-white/25 px-3 py-2 text-sm font-semibold text-white hover:border-white hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden>
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="hidden md:inline">Ver como aluno</span>
          </button>
        </div>
      </div>
    </header>
  );
}
