"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Menu do painel: uma barra fina com ícones na lateral, que abre ao passar o mouse.
 * No celular, vira um botão "Menu" que abre a lista por cima da página.
 * Também mostra as abas da seção aberta no topo da página.
 */

type Secao = "painel" | "financeiro" | "vendas" | "alunos" | "cursos" | "loja" | "funcionarios" | "mensagens" | "sistema";
/** Números de "novas" mostrados ao lado do item do menu, pelo endereço (ex.: mensagens novas). */
export type Contadores = Record<string, number>;

interface Item {
  secao: Secao;
  rotulo: string;
  href: string;
  icone: React.ReactNode;
  sub?: { rotulo: string; href: string }[];
}

const svg = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 shrink-0" aria-hidden>
    {d}
  </svg>
);

export const MENU: Item[] = [
  { secao: "painel", rotulo: "Painel rápido", href: "/admin", icone: svg(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>) },
  {
    secao: "financeiro", rotulo: "Financeiro", href: "/admin/financeiro",
    icone: svg(<><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9.5v5M18 9.5v5" /></>),
    sub: [
      { rotulo: "Resumo", href: "/admin/financeiro" },
      { rotulo: "Matrículas e recebimentos", href: "/admin/financeiro/recebimentos" },
      { rotulo: "Devedores", href: "/admin/financeiro/devedores" },
    ],
  },
  {
    secao: "vendas", rotulo: "Vendas", href: "/admin/carrinhos",
    icone: svg(<><path d="M3 4h2l2.4 11h10.2L20 8H6.2" /><circle cx="9" cy="19.5" r="1.3" /><circle cx="17" cy="19.5" r="1.3" /></>),
    sub: [
      { rotulo: "Carrinhos abandonados", href: "/admin/carrinhos" },
      { rotulo: "Cupons de desconto", href: "/admin/cupons" },
      { rotulo: "Pesquisa de satisfação", href: "/admin/pesquisa" },
    ],
  },
  {
    secao: "alunos", rotulo: "Alunos", href: "/admin/alunos",
    icone: svg(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14.5c2.3 0 4 1.5 4.5 4" /></>),
    sub: [
      { rotulo: "Todos os alunos", href: "/admin/alunos" },
      { rotulo: "Ranking", href: "/admin/alunos/ranking" },
      { rotulo: "Lembretes de estudo", href: "/admin/lembretes" },
      { rotulo: "Formados", href: "/admin/alunos/formados" },
      { rotulo: "Certificados", href: "/admin/certificados" },
      { rotulo: "Cadastrar aluno", href: "/admin/alunos/novo" },
    ],
  },
  { secao: "cursos", rotulo: "Cursos", href: "/admin/cursos", icone: svg(<><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /><path d="M9 7.5h7" /></>) },
  {
    secao: "loja", rotulo: "Loja virtual", href: "/admin/loja/depoimentos",
    icone: svg(<><path d="M3 9.5 4.5 4h15L21 9.5" /><path d="M3 9.5c0 1.4 1.1 2.5 2.5 2.5S8 10.9 8 9.5c0 1.4 1.1 2.5 2.5 2.5h3c1.4 0 2.5-1.1 2.5-2.5 0 1.4 1.1 2.5 2.5 2.5S21 10.9 21 9.5" /><path d="M5 12v8h14v-8M10 20v-4h4v4" /></>),
    sub: [
      { rotulo: "Depoimentos", href: "/admin/loja/depoimentos" },
      { rotulo: "Configurações da loja", href: "/admin/configuracoes" },
    ],
  },
  {
    secao: "mensagens", rotulo: "Mensagens", href: "/admin/mensagens",
    icone: svg(<><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A1.5 1.5 0 0 1 4 14.5z" /><path d="M8 8.5h8M8 11.5h5" /></>),
  },
  { secao: "funcionarios", rotulo: "Funcionários", href: "/admin/funcionarios", icone: svg(<><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="10" r="2.8" /><path d="M7.5 17.5c.7-2 2.5-3.2 4.5-3.2s3.8 1.2 4.5 3.2" /></>) },
  { secao: "sistema", rotulo: "Integrações", href: "/admin/integracoes", icone: svg(<><path d="M9 15 15 9" /><path d="M11 6.5 12.5 5a3.5 3.5 0 0 1 5 5L16 11.5M13 17.5 11.5 19a3.5 3.5 0 0 1-5-5L8 12.5" /></>) },
  { secao: "sistema", rotulo: "Conexão (API)", href: "/admin/diagnostico", icone: svg(<><path d="M9 7 4 12l5 5M15 7l5 5-5 5" /></>) },
];

/** Item (e sub-item) que corresponde à página aberta. */
function ativo(pathname: string, itens: Item[]) {
  let melhor: { item: Item; href: string } | null = null;
  for (const item of itens) {
    for (const h of [item.href, ...(item.sub?.map((s) => s.href) ?? [])]) {
      const casa = h === "/admin" ? pathname === "/admin" : pathname === h || pathname.startsWith(`${h}/`);
      if (casa && (!melhor || h.length > melhor.href.length)) melhor = { item, href: h };
    }
  }
  return melhor;
}

const Bolinha = ({ n, className = "" }: { n?: number; className?: string }) =>
  n ? <span className={`grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white ${className}`} aria-label={`${n} novas`}>{n > 99 ? "99+" : n}</span> : null;

export function MenuLateral({ secoes, email, sair, contadores = {} }: { secoes: Secao[]; email: string; sair: React.ReactNode; contadores?: Contadores }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  useEffect(() => setAberto(false), [pathname]);
  // Celular: a tecla Esc também fecha o menu
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aberto]);
  const itens = MENU.filter((m) => secoes.includes(m.secao));
  const atual = ativo(pathname, itens);

  const lista = (expandido: boolean) => (
    <ul className="space-y-1" onClick={(e) => (e.target as HTMLElement).closest("a") && setAberto(false)}>
      {itens.map((m) => {
        const eAtual = atual?.item === m;
        const total = m.sub ? m.sub.reduce((t, x) => t + (contadores[x.href] ?? 0), 0) : contadores[m.href] ?? 0;
        return (
          <li key={m.href}>
            <Link
              href={m.href}
              title={m.rotulo}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${eAtual ? "bg-laranja-500 text-marca-900" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
            >
              <span className="relative">
                {m.icone}
                {!expandido && <Bolinha n={total} className="absolute -right-2 -top-2 group-hover:hidden" />}
              </span>
              <span className={`flex flex-1 items-center justify-between gap-2 whitespace-nowrap ${expandido ? "" : "opacity-0 transition-opacity duration-150 group-hover:opacity-100"}`}>
                {m.rotulo}
                <Bolinha n={total} />
              </span>
            </Link>
            {m.sub && (
              <ul className={`ml-12 mt-1 space-y-0.5 ${expandido ? "" : "hidden group-hover:block"}`}>
                {m.sub.map((s) => (
                  <li key={s.href}>
                    <Link
                      href={s.href}
                      className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${atual?.href === s.href ? "text-laranja-400" : "text-white/60 hover:text-white"}`}
                    >
                      {s.rotulo}
                      <Bolinha n={contadores[s.href]} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {/* Computador: barra recolhida que abre ao passar o mouse */}
      <aside className="sticky top-[72px] z-20 hidden h-[calc(100vh-72px)] w-[72px] shrink-0 md:block print:hidden">
        <nav
          aria-label="Menu do painel"
          className="group absolute inset-y-0 left-0 flex w-[72px] flex-col overflow-y-auto overflow-x-hidden bg-marca-900 px-3 py-4 transition-[width,box-shadow] duration-200 hover:w-72 hover:shadow-2xl focus-within:w-72"
        >
          <div className="mb-5 flex h-9 items-center gap-3 px-1">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-laranja-500 text-sm font-extrabold text-marca-900">T</span>
            <span className="whitespace-nowrap text-sm font-bold uppercase tracking-wider text-white opacity-0 transition-opacity group-hover:opacity-100">Painel Tecpro</span>
          </div>
          {lista(false)}
          <div className="mt-auto pt-6 opacity-0 transition-opacity group-hover:opacity-100">
            <p className="truncate px-3 text-xs text-white/50">{email}</p>
            <div className="mt-2 px-3">{sair}</div>
          </div>
        </nav>
      </aside>

      {/* Celular: botão que abre o menu */}
      <div className="sticky top-[72px] z-20 flex items-center justify-between border-t border-white/10 bg-marca-800 px-4 py-3 md:hidden print:hidden">
        <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-laranja-500">Painel <Bolinha n={Object.values(contadores).reduce((a, b) => a + b, 0)} /></span>
        <button onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-white">
          {aberto ? "Fechar" : "Menu"}
        </button>
      </div>
      {aberto && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-marca-900 px-4 py-4 md:hidden">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-bold uppercase tracking-wider text-laranja-500">Painel Tecpro</span>
            <button onClick={() => setAberto(false)} className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-white">Fechar</button>
          </div>
          {lista(true)}
          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="truncate px-3 text-xs text-white/50">{email}</p>
            <div className="mt-2 px-3">{sair}</div>
          </div>
        </div>
      )}
    </>
  );
}

/** Abas da seção aberta (ex.: Financeiro > Resumo | Matrículas e recebimentos | Devedores). */
export function AbasSecao({ secoes, contadores = {} }: { secoes: Secao[]; contadores?: Contadores }) {
  const pathname = usePathname();
  const atual = ativo(pathname, MENU.filter((m) => secoes.includes(m.secao)));
  if (!atual?.item.sub) return null;
  return (
    <nav aria-label={atual.item.rotulo} className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 print:hidden">
      {atual.item.sub.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${atual.href === s.href ? "border-laranja-500 text-marca-900" : "border-transparent text-slate-500 hover:text-marca-900"}`}
        >
          {s.rotulo}
          <Bolinha n={contadores[s.href]} />
        </Link>
      ))}
    </nav>
  );
}
