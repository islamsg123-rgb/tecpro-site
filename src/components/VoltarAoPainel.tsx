"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * "Ver como aluno": quem é do painel e clicou nesse botão navega pelo site normal, como um aluno.
 * Esta pílula discreta no canto leva de volta ao painel. O sinal é só um cookie de tela (não dá acesso a nada:
 * o painel continua conferindo o login).
 */
export const COOKIE_MODO_ALUNO = "tecpro_modo_aluno";

export function lerModoAluno(): boolean {
  return typeof document !== "undefined" && document.cookie.split("; ").some((c) => c === `${COOKIE_MODO_ALUNO}=1`);
}

export function definirModoAluno(ligado: boolean) {
  document.cookie = ligado ? `${COOKIE_MODO_ALUNO}=1; path=/; max-age=86400; samesite=lax` : `${COOKIE_MODO_ALUNO}=; path=/; max-age=0`;
}

export function VoltarAoPainel() {
  const pathname = usePathname();
  const [ativo, setAtivo] = useState(false);
  useEffect(() => setAtivo(lerModoAluno()), [pathname]);
  if (!ativo || pathname.startsWith("/admin")) return null;
  return (
    <div className="fixed bottom-5 left-4 z-40 flex items-center gap-1 rounded-full bg-neutral-950 p-1 pl-4 text-sm text-white shadow-2xl ring-1 ring-white/20 print:hidden">
      <span className="hidden text-xs text-white/70 sm:inline">Vendo como aluno</span>
      <Link href="/admin" onClick={() => definirModoAluno(false)} className="ml-2 rounded-full bg-laranja-500 px-4 py-2 font-bold text-marca-900 hover:bg-laranja-400">
        ← Voltar ao painel
      </Link>
    </div>
  );
}
