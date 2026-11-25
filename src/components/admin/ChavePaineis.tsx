"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MENU, areaDaSecao, areaDoCaminho, temDuasAreas, type Area, type Contadores, type Secao } from "./MenuLateral";

/** Chave no topo do painel: [ Gestão | Financeiro ]. Só aparece para quem tem acesso às duas áreas. */
export function ChavePaineis({ secoes, contadores = {} }: { secoes: Secao[]; contadores?: Contadores }) {
  const pathname = usePathname();
  if (!temDuasAreas(secoes)) return null;
  const area = areaDoCaminho(pathname);
  // Primeira página de cada área que a pessoa pode abrir.
  const inicio = (a: Area) => MENU.find((m) => secoes.includes(m.secao) && areaDaSecao(m.secao) === a)?.href ?? "/admin";
  // Número de "novas" (ex.: mensagens) da outra área, para não passar despercebido.
  const novas = (a: Area) =>
    MENU.filter((m) => secoes.includes(m.secao) && areaDaSecao(m.secao) === a)
      .flatMap((m) => [m.href, ...(m.sub?.map((s) => s.href) ?? [])])
      .reduce((t, h) => t + (contadores[h] ?? 0), 0);

  const botao = (a: Area, rotulo: string) => {
    const n = novas(a);
    return (
      <Link
        href={inicio(a)}
        aria-current={area === a ? "page" : undefined}
        className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-colors ${area === a ? "bg-marca-900 text-white shadow" : "text-marca-900 hover:bg-white"}`}
      >
        {rotulo}
        {n > 0 && area !== a && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-[11px] leading-none text-white">{n > 99 ? "99+" : n}</span>}
      </Link>
    );
  };

  return (
    <nav aria-label="Trocar de painel" className="inline-flex rounded-full border border-slate-300 bg-slate-100 p-1">
      {botao("gestao", "Gestão")}
      {botao("financeiro", "Financeiro")}
    </nav>
  );
}
